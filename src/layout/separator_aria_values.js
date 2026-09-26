import { adjustLayoutByDelta } from "./adjust_layout_by_delta"
import { validateGroupLayout } from "./validate_group_layout"

// A separator reports the size of the panel before it. Its minimum and maximum
// are not simply that panel's constraints: the neighbours' constraints limit how
// far the boundary can really travel, so both ends are found by trying the move.
export function calculateSeparatorAriaValues({ layout, panelConstraints, panelId, panelIndex }) {
  let valueMax
  let valueMin

  const panelSize = layout[panelId]
  const constraints = panelConstraints.find(current => current.panelId === panelId)

  if (constraints) {
    const maxSize = constraints.maxSize
    const minSize = constraints.collapsible ? constraints.collapsedSize : constraints.minSize
    const pivotIndices = [ panelIndex, panelIndex + 1 ]

    const minSizeLayout = validateGroupLayout({
      layout: adjustLayoutByDelta({ delta: minSize - panelSize, initialLayout: layout, panelConstraints, pivotIndices, prevLayout: layout }),
      panelConstraints
    })
    valueMin = minSizeLayout[panelId]

    const maxSizeLayout = validateGroupLayout({
      layout: adjustLayoutByDelta({ delta: maxSize - panelSize, initialLayout: layout, panelConstraints, pivotIndices, prevLayout: layout }),
      panelConstraints
    })
    valueMax = maxSizeLayout[panelId]
  }

  return {
    valueControls: panelId,
    valueMax,
    valueMin,
    valueNow: panelSize
  }
}
