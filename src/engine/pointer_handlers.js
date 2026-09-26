import { completeActivePointerResize, notifyInteractionEnded, updateActiveHitRegions } from "./active_resize"
import { getInteractionState, updateInteractionState } from "./interaction_state"
import { getMountedGroups, updateMountedGroup } from "./groups_state"
import { calculateResizePreviews } from "./resize_previews"
import { findMatchingHitRegions } from "../dom/hit_regions"
import { getImperativePanelMethods } from "./imperative_methods"
import { layoutsEqual } from "../layout/layout_numbers"
import { updateCursorStyle } from "../cursor/cursor_style"

// These listen on the document, once per document however many groups it has.

export function onDocumentPointerDown(pointerEvent) {
  if (pointerEvent.defaultPrevented) return
  if (pointerEvent.pointerType === "mouse" && pointerEvent.button > 0) return

  const mountedGroups = getMountedGroups()

  const hitRegions = findMatchingHitRegions(pointerEvent, mountedGroups)
  if (hitRegions.length === 0) return

  const initialLayoutMap = new Map()
  let didChangeFocus = false

  hitRegions.forEach(current => {
    // Pointer capture waits for the first move: capturing now would swallow
    // the click of a press that never turns into a drag.
    if (current.separator && !didChangeFocus) {
      didChangeFocus = true
      current.separator.element.focus({ focusVisible: false, preventScroll: true })
    }

    const match = mountedGroups.get(current.group)
    if (match) initialLayoutMap.set(current.group, match.layout)
  })

  const previews = Array.from(initialLayoutMap.keys()).flatMap(group => {
    return group.resizePreviewMode === "separator" ? calculateResizePreviews(group, hitRegions) : []
  })

  updateInteractionState({
    cursorFlags: 0,
    didPointerMove: false,
    hitRegions,
    initialLayoutMap,
    pointerDownAtPoint: { x: pointerEvent.clientX, y: pointerEvent.clientY },
    previewLayoutMap: new Map(initialLayoutMap),
    previews,
    state: "active"
  })

  pointerEvent.preventDefault()
}

export function onDocumentPointerMove(pointerEvent) {
  if (pointerEvent.defaultPrevented) return

  const interactionState = getInteractionState()
  const mountedGroups = getMountedGroups()

  if (interactionState.state !== "active") {
    const hitRegions = findMatchingHitRegions(pointerEvent, mountedGroups)

    if (hitRegions.length === 0) {
      if (interactionState.state !== "inactive") updateInteractionState({ cursorFlags: 0, state: "inactive" })
    } else {
      updateInteractionState({ cursorFlags: 0, hitRegions, state: "hover" })
    }

    updateCursorStyle(pointerEvent.currentTarget)
    return
  }

  // No button is down, so the release happened somewhere this document could
  // not hear it — over a cross-origin iframe, typically. Finish the drag with
  // the last preview rather than the position of this later hover.
  if (pointerEvent.buttons === 0) {
    interactionState.previewLayoutMap.forEach((layout, group) => {
      const groupState = mountedGroups.get(group)
      if (group.resizePreviewMode === "separator" && groupState && !layoutsEqual(layout, groupState.layout)) {
        updateMountedGroup(group, { ...groupState, layout })
      }
    })

    updateInteractionState({ cursorFlags: 0, state: "inactive" })
    notifyInteractionEnded(interactionState, mountedGroups)
    updateCursorStyle(pointerEvent.currentTarget)
    return
  }

  for (const hitRegion of interactionState.hitRegions) {
    if (!hitRegion.separator) continue

    const { element } = hitRegion.separator
    if (element.isConnected && !element.hasPointerCapture?.(pointerEvent.pointerId)) {
      element.setPointerCapture?.(pointerEvent.pointerId)
    }
  }

  updateActiveHitRegions({
    commit: false,
    document: pointerEvent.currentTarget,
    event: pointerEvent,
    hitRegions: interactionState.hitRegions,
    initialLayoutMap: interactionState.initialLayoutMap,
    mountedGroups,
    pointerDownAtPoint: interactionState.pointerDownAtPoint,
    prevCursorFlags: interactionState.cursorFlags
  })
}

export function onDocumentPointerUp(pointerEvent) {
  if (pointerEvent.defaultPrevented) return
  if (pointerEvent.pointerType === "mouse" && pointerEvent.button > 0) return

  if (completeActivePointerResize(pointerEvent.currentTarget, pointerEvent)) pointerEvent.preventDefault()
}

// Leaving the document mid-drag pushes the boundaries to their limits in the
// direction the pointer went.
export function onDocumentPointerLeave(pointerEvent) {
  const interactionState = getInteractionState()
  if (interactionState.state !== "active") return

  updateActiveHitRegions({
    commit: false,
    document: pointerEvent.currentTarget,
    event: pointerEvent,
    hitRegions: interactionState.hitRegions,
    initialLayoutMap: interactionState.initialLayoutMap,
    mountedGroups: getMountedGroups(),
    prevCursorFlags: interactionState.cursorFlags
  })
}

// Moving onto an iframe fires no "pointerout" the document can use, which
// would leave a separator stuck showing hover.
export function onDocumentPointerOut(pointerEvent) {
  if (!(pointerEvent.relatedTarget instanceof HTMLIFrameElement)) return

  if (getInteractionState().state === "hover") updateInteractionState({ cursorFlags: 0, state: "inactive" })
}

export function onDocumentContextMenu(mouseEvent) {
  if (mouseEvent.defaultPrevented) return

  completeActivePointerResize(mouseEvent.currentTarget, mouseEvent)
}

// Double-clicking a separator puts the panel beside it that has a default size
// back to that size.
export function onDocumentDoubleClick(mouseEvent) {
  if (mouseEvent.defaultPrevented) return

  const hitRegions = findMatchingHitRegions(mouseEvent, getMountedGroups())
  hitRegions.forEach(current => {
    if (!current.separator || current.separator.disableDoubleClick) return

    const panelWithDefaultSize = current.panels.find(panel => panel.panelConstraints.defaultSize !== undefined)
    if (!panelWithDefaultSize) return

    const api = getImperativePanelMethods({ groupId: current.group.id, panelId: panelWithDefaultSize.id })
    api.resize(panelWithDefaultSize.panelConstraints.defaultSize)

    mouseEvent.preventDefault()
  })
}
