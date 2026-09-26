import { assert } from "../helpers/assert"
import { compareLayoutNumbers, isArrayEqual, layoutNumbersEqual } from "./layout_numbers"
import { validatePanelSize } from "./validate_panel_size"

// The heart of resizing: moves the boundary between the two pivot panels by
// `delta` percent and works out what every other panel has to give up to make
// room. Everything is in percentages; pixel values are converted beforehand.
//
// A negative delta grows the panels after the boundary, a positive one the
// panels before it. The side that shrinks gives up space one panel at a time,
// starting next to the boundary, until the delta is used up or every panel is
// at its limit. The pivot on the other side then grows by exactly what was
// freed. If that cannot add up to 100, the previous layout is returned — which
// is how a drag past a panel's limit comes to be ignored.
export function adjustLayoutByDelta({
  delta,
  initialLayout: initialLayoutProp,
  panelConstraints: panelConstraintsArray,
  pivotIndices,
  prevLayout: prevLayoutProp,
  trigger
}) {
  if (layoutNumbersEqual(delta, 0)) return initialLayoutProp

  const overrideDisabledPanels = trigger === "imperative-api"

  const initialLayout = panelConstraintsArray.map(({ panelId }) => initialLayoutProp[panelId])
  const prevLayout = panelConstraintsArray.map(({ panelId }) => prevLayoutProp[panelId])
  const nextLayout = [ ...initialLayout ]

  const [ firstPivotIndex, secondPivotIndex ] = pivotIndices
  assert(firstPivotIndex != null, "Invalid first pivot index")
  assert(secondPivotIndex != null, "Invalid second pivot index")

  let deltaApplied = 0

  if (trigger === "keyboard") {
    // A key press moves in fixed steps, so the halfway threshold a drag uses
    // could stop a collapsed panel from ever opening. Instead a step that
    // touches a collapsible panel sitting at its collapsed or minimum size jumps
    // the whole gap in one go.
    {
      const index = delta < 0 ? secondPivotIndex : firstPivotIndex
      const panelConstraints = panelConstraintsArray[index]
      assert(panelConstraints, `Panel constraints not found for index ${index}`)

      const { collapsedSize = 0, collapsible, minSize = 0 } = panelConstraints

      if (collapsible) {
        const prevSize = initialLayout[index]
        assert(prevSize != null, `Previous layout not found for panel index ${index}`)

        if (layoutNumbersEqual(prevSize, collapsedSize)) {
          const localDelta = minSize - prevSize
          if (compareLayoutNumbers(localDelta, Math.abs(delta)) > 0) {
            delta = delta < 0 ? 0 - localDelta : localDelta
          }
        }
      }
    }

    {
      const index = delta < 0 ? firstPivotIndex : secondPivotIndex
      const panelConstraints = panelConstraintsArray[index]
      assert(panelConstraints, `No panel constraints found for index ${index}`)

      const { collapsedSize = 0, collapsible, minSize = 0 } = panelConstraints

      if (collapsible) {
        const prevSize = initialLayout[index]
        assert(prevSize != null, `Previous layout not found for panel index ${index}`)

        if (layoutNumbersEqual(prevSize, minSize)) {
          const localDelta = prevSize - collapsedSize
          if (compareLayoutNumbers(localDelta, Math.abs(delta)) > 0) {
            delta = delta < 0 ? 0 - localDelta : localDelta
          }
        }
      }
    }
  } else {
    // Dragging a collapsed panel open has to pass its threshold before anything
    // moves; once it does, the delta jumps straight to the panel's minimum size
    // so the rest of the algorithm sees an ordinary expand.
    const index = delta < 0 ? secondPivotIndex : firstPivotIndex
    const panelConstraints = panelConstraintsArray[index]
    assert(panelConstraints, `Panel constraints not found for index ${index}`)

    const prevSize = initialLayout[index]
    const { collapsedSize, collapsedThreshold, collapsible, minSize } = panelConstraints

    if (collapsible && compareLayoutNumbers(prevSize, minSize) < 0) {
      const gapSize = minSize - collapsedSize
      const threshold = collapsedThreshold ?? gapSize / 2
      const nextSize = prevSize + Math.abs(delta)

      if (compareLayoutNumbers(nextSize, minSize) < 0) {
        const comparison = compareLayoutNumbers(Math.abs(delta), threshold)
        // Without an explicit threshold, a drag that lands exactly on the
        // boundary keeps expanding in one direction, as it always has.
        const expandAtBoundary = collapsedThreshold === undefined && delta < 0
        if (comparison > 0 || (comparison === 0 && expandAtBoundary)) {
          delta = delta < 0 ? -gapSize : gapSize
        } else {
          delta = 0
        }
      }
    }
  }

  {
    // How much could the growing side take in total? Asking for more than that
    // is trimmed here, so the shrinking side never gives up space nobody uses.
    const increment = delta < 0 ? 1 : -1

    let index = delta < 0 ? secondPivotIndex : firstPivotIndex
    let maxAvailableDelta = 0

    while (true) {
      const prevSize = initialLayout[index]
      assert(prevSize != null, `Previous layout not found for panel index ${index}`)

      const maxSafeSize = validatePanelSize({
        overrideDisabledPanels,
        panelConstraints: panelConstraintsArray[index],
        prevSize,
        size: 100
      })

      maxAvailableDelta += maxSafeSize - prevSize
      index += increment

      if (index < 0 || index >= panelConstraintsArray.length) break
    }

    const minAbsDelta = Math.min(Math.abs(delta), Math.abs(maxAvailableDelta))
    delta = delta < 0 ? 0 - minAbsDelta : minAbsDelta
  }

  {
    // Take the space from the shrinking side, nearest panel first.
    const pivotIndex = delta < 0 ? firstPivotIndex : secondPivotIndex
    let index = pivotIndex

    while (index >= 0 && index < panelConstraintsArray.length) {
      const deltaRemaining = Math.abs(delta) - Math.abs(deltaApplied)

      const prevSize = initialLayout[index]
      assert(prevSize != null, `Previous layout not found for panel index ${index}`)

      const safeSize = validatePanelSize({
        overrideDisabledPanels,
        panelConstraints: panelConstraintsArray[index],
        prevSize,
        size: prevSize - deltaRemaining
      })

      if (!layoutNumbersEqual(prevSize, safeSize)) {
        deltaApplied += prevSize - safeSize
        nextLayout[index] = safeSize

        if (deltaApplied.toFixed(3).localeCompare(Math.abs(delta).toFixed(3), undefined, { numeric: true }) >= 0) break
      }

      if (delta < 0) {
        index--
      } else {
        index++
      }
    }
  }

  if (isArrayEqual(prevLayout, nextLayout)) return prevLayoutProp

  {
    // Give the freed space to the pivot on the growing side.
    const pivotIndex = delta < 0 ? secondPivotIndex : firstPivotIndex

    const prevSize = initialLayout[pivotIndex]
    assert(prevSize != null, `Previous layout not found for panel index ${pivotIndex}`)

    const unsafeSize = prevSize + deltaApplied
    const safeSize = validatePanelSize({
      overrideDisabledPanels,
      panelConstraints: panelConstraintsArray[pivotIndex],
      prevSize,
      size: unsafeSize
    })

    nextLayout[pivotIndex] = safeSize

    // The pivot could not take all of it — it hit its maximum, or snapped to a
    // collapsed or minimum size — so the leftover spills to its neighbours.
    if (!layoutNumbersEqual(safeSize, unsafeSize)) {
      let deltaRemaining = unsafeSize - safeSize
      let index = pivotIndex

      while (index >= 0 && index < panelConstraintsArray.length) {
        const prevSize = nextLayout[index]
        assert(prevSize != null, `Previous layout not found for panel index ${index}`)

        const safeSize = validatePanelSize({
          overrideDisabledPanels,
          panelConstraints: panelConstraintsArray[index],
          prevSize,
          size: prevSize + deltaRemaining
        })

        if (!layoutNumbersEqual(prevSize, safeSize)) {
          deltaRemaining -= safeSize - prevSize
          nextLayout[index] = safeSize
        }

        if (layoutNumbersEqual(deltaRemaining, 0)) break

        if (delta > 0) {
          index--
        } else {
          index++
        }
      }
    }
  }

  // A small tolerance, or three-panel layouts made of thirds would never add up.
  const totalSize = nextLayout.reduce((total, size) => size + total, 0)
  if (!layoutNumbersEqual(totalSize, 100, 0.1)) return prevLayoutProp

  return nextLayout.reduce((accumulated, current, index) => {
    accumulated[panelConstraintsArray[index].panelId] = current
    return accumulated
  }, {})
}
