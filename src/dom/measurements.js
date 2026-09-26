import { formatLayoutNumber } from "../layout/layout_numbers"
import { sizeStyleToPixels } from "../sizes/parse_size"

// The space the panels share is the sum of the panels themselves, so
// separators and any static content between them are left out.
export function calculateAvailableGroupSize({ group }) {
  const { orientation, panels } = group

  return panels.reduce((totalSize, panel) => {
    return totalSize + (orientation === "horizontal" ? panel.element.offsetWidth : panel.element.offsetHeight)
  }, 0)
}

// Converts every panel's size constraints — which may be pixels, ems, viewport
// units or percentages — into percentages of the group as it measures right
// now. It runs again whenever the group resizes, because a 200px minimum is a
// different percentage of every width.
export function calculatePanelConstraints(group) {
  const { panels } = group

  const groupSize = calculateAvailableGroupSize({ group })
  if (groupSize === 0) {
    // Nothing meaningful can be measured at zero size, which usually means the
    // group sits inside a hidden subtree.
    return panels.map(current => ({
      groupResizeBehavior: current.panelConstraints.groupResizeBehavior,
      collapsedSize: 0,
      collapsible: current.panelConstraints.collapsible === true,
      defaultSize: undefined,
      disabled: current.panelConstraints.disabled,
      minSize: 0,
      maxSize: 100,
      panelId: current.id
    }))
  }

  return panels.map(panel => {
    const { element, panelConstraints } = panel

    function toPercentage(styleProp) {
      const pixels = sizeStyleToPixels({ groupSize, panelElement: element, styleProp })
      return formatLayoutNumber((pixels / groupSize) * 100)
    }

    return {
      groupResizeBehavior: panelConstraints.groupResizeBehavior,
      collapsedSize: panelConstraints.collapsedSize !== undefined ? toPercentage(panelConstraints.collapsedSize) : 0,
      collapsedThreshold: panelConstraints.collapsedThreshold !== undefined ? toPercentage(panelConstraints.collapsedThreshold) : undefined,
      collapsible: panelConstraints.collapsible === true,
      defaultSize: panelConstraints.defaultSize !== undefined ? toPercentage(panelConstraints.defaultSize) : undefined,
      disabled: panelConstraints.disabled,
      minSize: panelConstraints.minSize !== undefined ? toPercentage(panelConstraints.minSize) : 0,
      maxSize: panelConstraints.maxSize !== undefined ? toPercentage(panelConstraints.maxSize) : 100,
      panelId: panel.id
    }
  })
}
