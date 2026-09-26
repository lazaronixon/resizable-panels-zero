import { assert } from "../helpers/assert"
import { layoutNumbersEqual } from "./layout_numbers"
import { validatePanelSize } from "./validate_panel_size"

// Makes any proposed layout safe to apply: scales it to add up to 100, clamps
// every panel to its constraints, and hands whatever that frees up to the first
// panels able to take it. One pass is enough in practice; spreading the
// remainder evenly is not worth more.
export function validateGroupLayout({ layout, panelConstraints }) {
  const prevLayout = panelConstraints.map(({ panelId }) => layout[panelId])
  const nextLayout = [ ...prevLayout ]

  const nextLayoutTotalSize = nextLayout.reduce((accumulated, current) => accumulated + current, 0)

  if (Object.keys(layout).length !== panelConstraints.length) {
    throw Error(`Invalid ${panelConstraints.length} panel layout: ${Object.values(layout).map(size => `${size}%`).join(", ")}`)
  } else if (!layoutNumbersEqual(nextLayoutTotalSize, 100) && nextLayout.length > 0) {
    for (let index = 0; index < panelConstraints.length; index++) {
      const unsafeSize = nextLayout[index]
      assert(unsafeSize != null, `No layout data found for index ${index}`)
      nextLayout[index] = (100 / nextLayoutTotalSize) * unsafeSize
    }
  }

  let remainingSize = 0

  for (let index = 0; index < panelConstraints.length; index++) {
    const prevSize = prevLayout[index]
    assert(prevSize != null, `No layout data found for index ${index}`)

    const unsafeSize = nextLayout[index]
    assert(unsafeSize != null, `No layout data found for index ${index}`)

    const safeSize = validatePanelSize({
      overrideDisabledPanels: true,
      panelConstraints: panelConstraints[index],
      prevSize,
      size: unsafeSize
    })

    if (unsafeSize != safeSize) {
      remainingSize += unsafeSize - safeSize
      nextLayout[index] = safeSize
    }
  }

  if (!layoutNumbersEqual(remainingSize, 0)) {
    for (let index = 0; index < panelConstraints.length; index++) {
      const prevSize = nextLayout[index]
      assert(prevSize != null, `No layout data found for index ${index}`)

      const safeSize = validatePanelSize({
        overrideDisabledPanels: true,
        panelConstraints: panelConstraints[index],
        prevSize,
        size: prevSize + remainingSize
      })

      if (prevSize !== safeSize) {
        remainingSize -= safeSize - prevSize
        nextLayout[index] = safeSize

        if (layoutNumbersEqual(remainingSize, 0)) break
      }
    }
  }

  return nextLayout.reduce((accumulated, current, index) => {
    accumulated[panelConstraints[index].panelId] = current
    return accumulated
  }, {})
}
