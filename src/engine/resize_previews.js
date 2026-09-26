import { calculateHitRegions } from "../dom/hit_regions"
import { layoutNumbersEqual } from "../layout/layout_numbers"

// In separator preview mode the panels stay put during a drag and a copy of
// every boundary slides instead. This lays out one preview per boundary — the
// same boundaries hit testing uses, disabled ones included, since they can
// still move indirectly — in coordinates relative to the group.
export function calculateResizePreviews(group, hitRegions) {
  const { element, orientation, panels } = group

  const groupRect = element.getBoundingClientRect()
  const horizontal = orientation === "horizontal"

  const boundaries = calculateHitRegions({ expandHitTargets: false, group, includeDisabled: true })

  return boundaries.map(({ panels: boundaryPanels, rect, separator }, index) => {
    const panelIndex = panels.indexOf(boundaryPanels[0])
    const center = horizontal ? rect.left + rect.width / 2 : rect.top + rect.height / 2

    const active = hitRegions.some(region => {
      if (region.group !== group || region.panels[0] !== boundaryPanels[0]) return false
      if (separator || region.separator) return region.separator === separator

      const regionCenter = horizontal ? region.rect.left + region.rect.width / 2 : region.rect.top + region.rect.height / 2
      return layoutNumbersEqual(center, regionCenter)
    })

    return {
      active,
      group,
      key: separator ? `separator-${separator.id}` : `panel-${boundaryPanels[0].id}-${index}`,
      offset: 0,
      panelIndex,
      rect: new DOMRect(
        (horizontal && !separator ? center : rect.left) - groupRect.left - element.clientLeft + element.scrollLeft,
        (!horizontal && !separator ? center : rect.top) - groupRect.top - element.clientTop + element.scrollTop,
        horizontal && !separator ? 0 : rect.width,
        !horizontal && !separator ? 0 : rect.height
      ),
      separator
    }
  })
}
