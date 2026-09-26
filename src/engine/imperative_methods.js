import { adjustLayoutByDelta } from "../layout/adjust_layout_by_delta"
import { calculateAvailableGroupSize } from "../dom/measurements"
import { formatLayoutNumber, layoutNumbersEqual, layoutsEqual } from "../layout/layout_numbers"
import { getMountedGroups, updateMountedGroup } from "./groups_state"
import { sizeStyleToPixels } from "../sizes/parse_size"
import { validateGroupLayout } from "../layout/validate_group_layout"

function findGroup(groupId) {
  for (const [ group, value ] of getMountedGroups()) {
    if (group.id === groupId) return { group, ...value }
  }

  throw Error(`Could not find Group with id "${groupId}"`)
}

export function getImperativeGroupMethods({ groupId }) {
  return {
    getLayout() {
      const { defaultLayoutDeferred, layout } = findGroup(groupId)

      // A group mounted inside a hidden subtree has not validated its layout
      // yet, so there is nothing trustworthy to hand out.
      if (defaultLayoutDeferred) return {}

      return layout
    },

    setLayout(unsafeLayout) {
      const { defaultLayoutDeferred, derivedPanelConstraints, group, groupSize, layout: prevLayout, separatorToPanels } = findGroup(groupId)

      // Validated even when it cannot be applied, so a layout with the wrong
      // number of panels still throws.
      const nextLayout = validateGroupLayout({ layout: unsafeLayout, panelConstraints: derivedPanelConstraints })

      if (defaultLayoutDeferred) return prevLayout

      if (!layoutsEqual(prevLayout, nextLayout)) {
        updateMountedGroup(group, { defaultLayoutDeferred, derivedPanelConstraints, groupSize, layout: nextLayout, separatorToPanels })
      }

      return nextLayout
    }
  }
}

export function getImperativePanelMethods({ groupId, panelId }) {
  function find() {
    return findGroup(groupId)
  }

  function getPanelConstraints() {
    const match = find().derivedPanelConstraints.find(current => current.panelId === panelId)
    if (match !== undefined) return match

    throw Error(`Panel constraints not found for Panel ${panelId}`)
  }

  function getPanel() {
    const match = find().group.panels.find(current => current.id === panelId)
    if (match !== undefined) return match

    throw Error(`Layout not found for Panel ${panelId}`)
  }

  function getPanelSize() {
    const match = find().layout[panelId]
    if (match !== undefined) return match

    throw Error(`Layout not found for Panel ${panelId}`)
  }

  // Resizing the last panel moves the boundary before it rather than after it,
  // and two cases need special care:
  // 1. it is the only panel, so there is no pair of pivots at all
  // 2. every panel before it is collapsed, where the usual reversed delta would
  //    push the freed space into the first panel; the last panel keeps it
  //    instead, so it stays the largest
  function computeLayout({ nextSize, panels, prevLayout, derivedPanelConstraints }) {
    const prevSize = getPanelSize()

    const index = panels.findIndex(current => current.id === panelId)
    const isFirstPanel = index === 0
    const isLastPanel = index === panels.length - 1

    const allPreviousCollapsed =
      isLastPanel &&
      nextSize < prevSize &&
      (isFirstPanel ||
        panels.slice(0, index).every((_panel, panelIndex) => {
          const constraints = derivedPanelConstraints[panelIndex]
          return constraints?.collapsible && layoutNumbersEqual(constraints.collapsedSize, prevLayout[constraints.panelId])
        }))

    if (allPreviousCollapsed) {
      const occupiedByPrevious = panels.slice(0, index).reduce((total, panel) => total + prevLayout[panel.id], 0)
      return { ...prevLayout, [panelId]: formatLayoutNumber(100 - occupiedByPrevious) }
    }

    return adjustLayoutByDelta({
      delta: isLastPanel ? prevSize - nextSize : nextSize - prevSize,
      initialLayout: prevLayout,
      panelConstraints: derivedPanelConstraints,
      pivotIndices: isLastPanel ? [ index - 1, index ] : [ index, index + 1 ],
      prevLayout,
      trigger: "imperative-api"
    })
  }

  function setPanelSize(nextSize) {
    const prevSize = getPanelSize()
    if (nextSize === prevSize) return

    const { defaultLayoutDeferred, derivedPanelConstraints, group, groupSize, layout: prevLayout, separatorToPanels } = find()

    const unsafeLayout = computeLayout({ nextSize, panels: group.panels, prevLayout, derivedPanelConstraints })
    const nextLayout = validateGroupLayout({ layout: unsafeLayout, panelConstraints: derivedPanelConstraints })

    if (!layoutsEqual(prevLayout, nextLayout)) {
      updateMountedGroup(group, { defaultLayoutDeferred, derivedPanelConstraints, groupSize, layout: nextLayout, separatorToPanels })
    }
  }

  return {
    collapse() {
      const { collapsible, collapsedSize } = getPanelConstraints()
      const { mutableValues } = getPanel()
      const size = getPanelSize()

      if (collapsible && size !== collapsedSize) {
        // Remembered so that expand() can go back to it.
        mutableValues.expandToSize = size
        setPanelSize(collapsedSize)
      }
    },

    expand() {
      const { collapsible, collapsedSize, minSize } = getPanelConstraints()
      const { mutableValues } = getPanel()
      const size = getPanelSize()

      if (collapsible && size === collapsedSize) {
        let nextSize = mutableValues.expandToSize ?? minSize

        // A minimum of 0 would "expand" to nothing, so pick something visible.
        if (nextSize === 0) nextSize = 1

        setPanelSize(nextSize)
      }
    },

    getSize() {
      const { group } = find()
      const asPercentage = getPanelSize()
      const { element } = getPanel()

      return {
        asPercentage,
        inPixels: group.orientation === "horizontal" ? element.offsetWidth : element.offsetHeight
      }
    },

    isCollapsed() {
      const { collapsible, collapsedSize } = getPanelConstraints()
      return collapsible && layoutNumbersEqual(collapsedSize, getPanelSize())
    },

    resize(size) {
      const { group } = find()
      const { element } = getPanel()
      const groupSize = calculateAvailableGroupSize({ group })

      const asPixels = sizeStyleToPixels({ groupSize, panelElement: element, styleProp: size })

      setPanelSize(formatLayoutNumber((asPixels / groupSize) * 100))
    }
  }
}
