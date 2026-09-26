import { compareLayoutNumbers, formatLayoutNumber } from "./layout_numbers"

// Clamps one panel's proposed size to its constraints. Sizes are percentages;
// anything given in another unit has already been converted.
//
// A collapsible panel below its minimum snaps either to its collapsed size or
// back up to its minimum, depending on which side of the threshold it is on —
// and the threshold is measured from wherever the panel started, so a collapsed
// panel has to be dragged out further than an open one has to be pushed in.
export function validatePanelSize({ overrideDisabledPanels, panelConstraints, prevSize, size }) {
  const {
    collapsedSize = 0,
    collapsedThreshold,
    collapsible,
    disabled,
    maxSize = 100,
    minSize = 0
  } = panelConstraints

  if (disabled && !overrideDisabledPanels) return prevSize

  if (compareLayoutNumbers(size, minSize) < 0) {
    if (collapsible) {
      const threshold = collapsedThreshold ?? (minSize - collapsedSize) / 2
      const wasCollapsed = compareLayoutNumbers(prevSize, collapsedSize) <= 0
      const boundary = wasCollapsed ? collapsedSize + threshold : minSize - threshold
      const comparison = compareLayoutNumbers(size, boundary)

      if (
        compareLayoutNumbers(size, collapsedSize) <= 0 ||
        comparison < 0 ||
        (collapsedThreshold !== undefined && wasCollapsed && comparison === 0)
      ) {
        size = collapsedSize
      } else {
        size = minSize
      }
    } else {
      size = minSize
    }
  }

  size = Math.min(maxSize, size)

  return formatLayoutNumber(size)
}
