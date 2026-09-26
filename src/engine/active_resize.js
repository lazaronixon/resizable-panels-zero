import {
  CURSOR_FLAGS_HORIZONTAL,
  CURSOR_FLAGS_VERTICAL,
  CURSOR_FLAG_HORIZONTAL_MAX,
  CURSOR_FLAG_HORIZONTAL_MIN,
  CURSOR_FLAG_VERTICAL_MAX,
  CURSOR_FLAG_VERTICAL_MIN,
  updateCursorStyle
} from "../cursor/cursor_style"
import { adjustLayoutByDelta } from "../layout/adjust_layout_by_delta"
import { getInteractionState, updateCursorFlags, updateInteractionState } from "./interaction_state"
import { getMountedGroupState, getMountedGroups, updateMountedGroup } from "./groups_state"
import { layoutsEqual } from "../layout/layout_numbers"

// Applies the pointer's travel since the drag started to every hit region
// being dragged. The regions were frozen when the drag began, so the pointer
// may wander off them freely.
//
// Without a starting point — the pointer left the document — each boundary is
// pushed as far as it goes in the direction the pointer left.
export function updateActiveHitRegions({
  commit,
  document,
  event,
  hitRegions,
  initialLayoutMap,
  mountedGroups,
  pointerDownAtPoint,
  prevCursorFlags
}) {
  let nextCursorFlags = 0
  const interaction = getInteractionState()
  let previews = interaction.state === "active" ? interaction.previews : []
  const previewLayoutMap = new Map(interaction.state === "active" ? interaction.previewLayoutMap : undefined)

  hitRegions.forEach(current => {
    const { group, groupSize } = current
    const { orientation, panels } = group
    if (commit && group.resizePreviewMode !== "separator") return

    const { disableCursor } = group.mutableState

    let deltaAsPercentage
    if (pointerDownAtPoint) {
      deltaAsPercentage = orientation === "horizontal"
        ? ((event.clientX - pointerDownAtPoint.x) / groupSize) * 100
        : ((event.clientY - pointerDownAtPoint.y) / groupSize) * 100
    } else if (orientation === "horizontal") {
      deltaAsPercentage = event.clientX < 0 ? -100 : 100
    } else {
      deltaAsPercentage = event.clientY < 0 ? -100 : 100
    }

    const initialLayout = initialLayoutMap.get(group)
    const groupState = mountedGroups.get(group)
    if (!initialLayout || !groupState) return

    const { defaultLayoutDeferred, derivedPanelConstraints, groupSize: mountedGroupSize, layout: mountedLayout, separatorToPanels } = groupState
    if (!derivedPanelConstraints || !mountedLayout || !separatorToPanels) return

    const prevLayout = group.resizePreviewMode === "separator"
      ? (previewLayoutMap.get(group) ?? mountedLayout)
      : mountedLayout

    const nextLayout = adjustLayoutByDelta({
      delta: deltaAsPercentage,
      initialLayout,
      panelConstraints: derivedPanelConstraints,
      pivotIndices: current.panels.map(panel => panels.indexOf(panel)),
      prevLayout,
      trigger: "mouse-or-touch"
    })

    // In preview mode every moved boundary slides its preview, and the layout
    // itself waits for the release.
    if (group.resizePreviewMode === "separator" && !commit && !layoutsEqual(nextLayout, prevLayout)) {
      previewLayoutMap.set(group, nextLayout)

      let total = 0
      const offsets = panels.map(panel => {
        total += nextLayout[panel.id] - initialLayout[panel.id]
        return total * (groupSize / 100)
      })

      previews = previews.map(preview => {
        if (preview.group !== group) return preview

        const offset = offsets[preview.panelIndex]
        return offset === preview.offset ? preview : { ...preview, offset }
      })
    }

    // The pointer moved but the layout did not, so the boundary is at a limit.
    if (layoutsEqual(nextLayout, prevLayout) && deltaAsPercentage !== 0 && !disableCursor) {
      if (orientation === "horizontal") {
        nextCursorFlags |= deltaAsPercentage < 0 ? CURSOR_FLAG_HORIZONTAL_MIN : CURSOR_FLAG_HORIZONTAL_MAX
      } else {
        nextCursorFlags |= deltaAsPercentage < 0 ? CURSOR_FLAG_VERTICAL_MIN : CURSOR_FLAG_VERTICAL_MAX
      }
    }

    if ((group.resizePreviewMode !== "separator" || commit) && !layoutsEqual(nextLayout, mountedLayout)) {
      updateMountedGroup(current.group, {
        defaultLayoutDeferred,
        derivedPanelConstraints,
        groupSize: mountedGroupSize,
        layout: nextLayout,
        separatorToPanels
      })
    }
  })

  // Firefox sometimes rounds the pointer position, reporting an event with no
  // movement at all; keeping the previous flags stops the cursor flickering.
  let cursorFlags = 0
  if (event.movementX === 0) {
    cursorFlags |= prevCursorFlags & CURSOR_FLAGS_HORIZONTAL
  } else {
    cursorFlags |= nextCursorFlags & CURSOR_FLAGS_HORIZONTAL
  }
  if (event.movementY === 0) {
    cursorFlags |= prevCursorFlags & CURSOR_FLAGS_VERTICAL
  } else {
    cursorFlags |= nextCursorFlags & CURSOR_FLAGS_VERTICAL
  }

  const didPointerMove =
    interaction.state === "active" &&
    (event.clientX !== interaction.pointerDownAtPoint.x || event.clientY !== interaction.pointerDownAtPoint.y)

  updateCursorFlags(cursorFlags, previews, previewLayoutMap, didPointerMove)
  updateCursorStyle(document)
}

export function completeActivePointerResize(document, event) {
  const interactionState = getInteractionState()
  if (interactionState.state !== "active") return false

  const mountedGroups = getMountedGroups()

  updateActiveHitRegions({
    commit: true,
    document,
    event,
    hitRegions: interactionState.hitRegions,
    initialLayoutMap: interactionState.initialLayoutMap,
    mountedGroups,
    pointerDownAtPoint: interactionState.pointerDownAtPoint,
    prevCursorFlags: interactionState.cursorFlags
  })

  updateInteractionState({ cursorFlags: 0, state: "inactive" })

  if (interactionState.hitRegions.length === 0) return false

  updateCursorStyle(document)
  notifyInteractionEnded(interactionState, mountedGroups)

  return true
}

// One more change once the interaction is over, flagged as the user's doing.
// Groups hold back their "layout changed" event until they see it.
export function notifyInteractionEnded(interactionState, mountedGroups) {
  interactionState.hitRegions.forEach(hitRegion => {
    // A group that re-registered mid-drag must not have its stale record put
    // back into the map.
    if (!mountedGroups.has(hitRegion.group)) return

    const groupState = getMountedGroupState(hitRegion.group.id, true)
    updateMountedGroup(hitRegion.group, groupState, { isUserInteraction: true })
  })
}
