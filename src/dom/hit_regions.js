import { assert } from "../helpers/assert"
import { calculateAvailableGroupSize } from "./measurements"
import { compare } from "./stacking_order"
import { doRectsIntersect, getDistanceBetweenPointAndRect, isHTMLElement, isModal } from "../helpers/dom_helper"
import { isCoarsePointer } from "../helpers/platform_helper"
import { sortByElementOffset } from "./sort_by_offset"

// A hit region is somewhere a drag can start: an explicit separator, or — when
// there is none — the gap or shared edge between two neighbouring panels.
// Separators are optional; they exist for keyboard users and for styling.
//
// Each region is widened to the group's minimum target size so that a hairline
// separator is still easy to grab, more so under a finger than under a mouse.
export function calculateHitRegions({ expandHitTargets = true, group, includeDisabled = false }) {
  const { element: groupElement, orientation, panels, separators } = group

  const sortedChildElements = sortByElementOffset(
    orientation,
    Array.from(groupElement.children)
      .filter(isHTMLElement)
      .filter(element => !element.hasAttribute("data-resize-preview") && !element.hasAttribute("data-separator-overlay-source"))
      .map(element => ({ element }))
  ).map(({ element }) => element)

  const hitRegions = []

  let disabledSeparator = false
  let hasInterleavedStaticContent = false
  let firstEnabledPanelIndex = -1
  let groupSize
  let lastEnabledPanelIndex = -1
  let numEnabledPanels = 0
  let prevPanel
  let pendingSeparators = []

  {
    let currentPanelIndex = -1

    for (const childElement of sortedChildElements) {
      if (!childElement.hasAttribute("data-panel")) continue

      currentPanelIndex++

      if (!childElement.hasAttribute("data-disabled")) {
        numEnabledPanels++
        if (firstEnabledPanelIndex === -1) firstEnabledPanelIndex = currentPanelIndex
        lastEnabledPanelIndex = currentPanelIndex
      }
    }
  }

  // With every panel but one disabled, nothing can be resized.
  if (!includeDisabled && numEnabledPanels <= 1) return hitRegions

  let currentPanelIndex = -1

  for (const childElement of sortedChildElements) {
    if (childElement.hasAttribute("data-panel")) {
      currentPanelIndex++

      const panelData = panels.find(current => current.element === childElement)
      if (!panelData) continue

      if (prevPanel) {
        const prevRect = prevPanel.element.getBoundingClientRect()
        const rect = childElement.getBoundingClientRect()

        let pendingRectsOrSeparators

        // A rendered separator is always the region. Without one the whole gap
        // between the panels is — unless static content sits between them, in
        // which case only the panels' own edges can be dragged.
        if (hasInterleavedStaticContent) {
          const firstPanelEdgeRect = orientation === "horizontal"
            ? new DOMRect(prevRect.right, prevRect.top, 0, prevRect.height)
            : new DOMRect(prevRect.left, prevRect.bottom, prevRect.width, 0)
          const secondPanelEdgeRect = orientation === "horizontal"
            ? new DOMRect(rect.left, rect.top, 0, rect.height)
            : new DOMRect(rect.left, rect.top, rect.width, 0)

          switch (pendingSeparators.length) {
            case 0: {
              pendingRectsOrSeparators = [ firstPanelEdgeRect, secondPanelEdgeRect ]
              break
            }
            case 1: {
              const separator = pendingSeparators[0]
              const closestRect = findClosestRect({
                orientation,
                rects: [ prevRect, rect ],
                targetRect: separator.element.getBoundingClientRect()
              })

              pendingRectsOrSeparators = [ separator, closestRect === prevRect ? secondPanelEdgeRect : firstPanelEdgeRect ]
              break
            }
            default: {
              pendingRectsOrSeparators = pendingSeparators
              break
            }
          }
        } else if (pendingSeparators.length) {
          pendingRectsOrSeparators = pendingSeparators
        } else {
          pendingRectsOrSeparators = [
            orientation === "horizontal"
              ? new DOMRect(prevRect.right, rect.top, rect.left - prevRect.right, rect.height)
              : new DOMRect(rect.left, prevRect.bottom, rect.width, rect.top - prevRect.bottom)
          ]
        }

        for (const rectOrSeparator of pendingRectsOrSeparators) {
          const isRect = "width" in rectOrSeparator
          let rect = isRect ? rectOrSeparator : rectOrSeparator.element.getBoundingClientRect()

          const minHitTargetSize = expandHitTargets
            ? (isCoarsePointer() ? group.resizeTargetMinimumSize.coarse : group.resizeTargetMinimumSize.fine)
            : 0

          if (rect.width < minHitTargetSize) {
            const delta = minHitTargetSize - rect.width
            rect = new DOMRect(rect.x - delta / 2, rect.y, rect.width + delta, rect.height)
          }
          if (rect.height < minHitTargetSize) {
            const delta = minHitTargetSize - rect.height
            rect = new DOMRect(rect.x, rect.y - delta / 2, rect.width, rect.height + delta)
          }

          const skip = currentPanelIndex <= firstEnabledPanelIndex || currentPanelIndex > lastEnabledPanelIndex

          if (includeDisabled || (!disabledSeparator && !skip)) {
            groupSize ??= calculateAvailableGroupSize({ group })

            hitRegions.push({
              group,
              groupSize,
              panels: [ prevPanel, panelData ],
              separator: isRect ? undefined : rectOrSeparator,
              rect
            })
          }

          disabledSeparator = false
        }
      }

      hasInterleavedStaticContent = false
      prevPanel = panelData
      pendingSeparators = []
    } else if (childElement.hasAttribute("data-separator")) {
      if (childElement.hasAttribute("aria-disabled")) disabledSeparator = true

      const separatorData = separators.find(current => current.element === childElement)
      if (separatorData) {
        // The separator lies inside the gap between the panels anyway, but it
        // has to be tracked for the case of static content between them.
        pendingSeparators.push(separatorData)
      } else {
        prevPanel = undefined
        pendingSeparators = []
      }
    } else {
      hasInterleavedStaticContent = true
    }
  }

  return hitRegions
}

export function findClosestRect({ orientation, rects, targetRect }) {
  const centerPoint = {
    x: targetRect.x + targetRect.width / 2,
    y: targetRect.y + targetRect.height / 2
  }

  let closestRect
  let minDistance = Number.MAX_VALUE

  for (const rect of rects) {
    const { x, y } = getDistanceBetweenPointAndRect(centerPoint, rect)
    const distance = orientation === "horizontal" ? x : y

    if (distance < minDistance) {
      minDistance = distance
      closestRect = rect
    }
  }

  assert(closestRect, "No rect found")

  return closestRect
}

export function findClosestHitRegion(orientation, hitRegions, point) {
  let closestHitRegion
  let minDistance = { x: Infinity, y: Infinity }

  for (const hitRegion of hitRegions) {
    const data = getDistanceBetweenPointAndRect(point, hitRegion.rect)

    if (orientation === "horizontal" ? data.x <= minDistance.x : data.y <= minDistance.y) {
      closestHitRegion = hitRegion
      minDistance = data
    }
  }

  return closestHitRegion ? { distance: minDistance, hitRegion: closestHitRegion } : undefined
}

// Every mounted group gets a say, which is how a pointer on the spot where a
// horizontal and a vertical boundary cross drags both of them at once.
export function findMatchingHitRegions(event, mountedGroups) {
  const matchingHitRegions = []

  mountedGroups.forEach((_, groupData) => {
    if (groupData.disabled) return

    const hitRegions = calculateHitRegions({ group: groupData })
    const match = findClosestHitRegion(groupData.orientation, hitRegions, { x: event.clientX, y: event.clientY })

    if (
      match &&
      match.distance.x <= 0 &&
      match.distance.y <= 0 &&
      isViableHitTarget({ groupElement: groupData.element, hitRegion: match.hitRegion.rect, pointerEventTarget: event.target })
    ) {
      matchingHitRegions.push(match.hitRegion)
    }
  })

  return matchingHitRegions
}

// Pointer events are handled on the document, both to catch a pointer that is
// merely near a boundary and to drag several nested boundaries at once. The
// price is having to check that nothing else — a menu, a modal — is painted
// over the region the pointer went down on.
export function isViableHitTarget({ groupElement, hitRegion, pointerEventTarget }) {
  if (isHTMLElement(pointerEventTarget)) {
    // A modal dialog lives in the top layer and makes the rest of the page
    // inert wherever it sits in the markup, which stacking order cannot see.
    const dialog = pointerEventTarget.closest("dialog")
    if (dialog && !dialog.contains(groupElement) && isModal(dialog)) return false
  }

  // Working out stacking order is not free, and one element containing the
  // other means the pointer is on the group anyway.
  if (!isHTMLElement(pointerEventTarget) || pointerEventTarget.contains(groupElement) || groupElement.contains(pointerEventTarget)) {
    return true
  }

  if (compare(pointerEventTarget, groupElement) > 0) {
    // The target may be a small span inside a large overlay, so every ancestor
    // up to the one containing the group is checked for overlap.
    let currentElement = pointerEventTarget
    while (currentElement) {
      if (currentElement.contains(groupElement)) return true
      if (doRectsIntersect(currentElement.getBoundingClientRect(), hitRegion)) return false

      currentElement = currentElement.parentElement
    }
  }

  return true
}
