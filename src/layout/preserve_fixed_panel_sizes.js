import { formatLayoutNumber } from "./layout_numbers"

// When the group itself changes size, panels that asked to keep their pixel
// size are converted to the percentage that is the same number of pixels in the
// new size, and the remaining panels share what is left in their old
// proportions.
export function preserveFixedPanelSizes({ group, nextGroupSize, prevGroupSize, prevLayout }) {
  if (prevGroupSize <= 0 || nextGroupSize <= 0 || prevGroupSize === nextGroupSize) return prevLayout

  let fixedPanelsTotalSize = 0
  let flexiblePanelsTotalPrevSize = 0
  let hasPreservePixelSizePanels = false

  const fixedPanels = new Map()
  const flexiblePanelIds = []

  for (const panel of group.panels) {
    const prevPanelSize = prevLayout[panel.id] ?? 0

    if (panel.panelConstraints.groupResizeBehavior === "preserve-pixel-size") {
      hasPreservePixelSizePanels = true

      const prevPanelSizeInPixels = (prevPanelSize / 100) * prevGroupSize
      const nextPanelSize = formatLayoutNumber((prevPanelSizeInPixels / nextGroupSize) * 100)

      fixedPanels.set(panel.id, nextPanelSize)
      fixedPanelsTotalSize += nextPanelSize
    } else {
      flexiblePanelIds.push(panel.id)
      flexiblePanelsTotalPrevSize += prevPanelSize
    }
  }

  if (!hasPreservePixelSizePanels || flexiblePanelIds.length === 0) return prevLayout

  const remainingSize = 100 - fixedPanelsTotalSize
  const nextLayout = { ...prevLayout }

  fixedPanels.forEach((size, panelId) => {
    nextLayout[panelId] = size
  })

  if (flexiblePanelsTotalPrevSize > 0) {
    for (const panelId of flexiblePanelIds) {
      const prevSize = prevLayout[panelId] ?? 0
      nextLayout[panelId] = formatLayoutNumber((prevSize / flexiblePanelsTotalPrevSize) * remainingSize)
    }
  } else {
    const evenSize = formatLayoutNumber(remainingSize / flexiblePanelIds.length)
    for (const panelId of flexiblePanelIds) {
      nextLayout[panelId] = evenSize
    }
  }

  return nextLayout
}
