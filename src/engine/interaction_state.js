import EventEmitter from "../helpers/event_emitter"

// What the pointer is doing, across every group on the page:
// - inactive: nowhere near a boundary
// - hover: over one or more hit regions
// - active: dragging them, with the layouts captured when the drag started, the
//   point it started from, and — in separator preview mode — the layouts and
//   previews that will be committed on release
let state = {
  cursorFlags: 0,
  state: "inactive"
}

const eventEmitter = new EventEmitter()

export function getInteractionState() {
  return state
}

export function subscribeToInteractionState(callback) {
  return eventEmitter.addListener("change", callback)
}

export function updateCursorFlags(cursorFlags, previews = [], previewLayoutMap, didPointerMove = false) {
  const prev = state

  const next = { ...state }
  next.cursorFlags = cursorFlags
  if (next.state === "active") {
    next.didPointerMove ||= didPointerMove
    next.previews = previews
    if (previewLayoutMap) next.previewLayoutMap = previewLayoutMap
  }

  state = next

  eventEmitter.emit("change", { prev, next })
}

export function updateInteractionState(next) {
  const prev = state

  state = next

  // Clicking a separator focuses it, which is wanted; dragging one should not
  // leave it focused afterwards. This also covers drags ended by the
  // missed-pointerup fallback.
  if (prev.state === "active" && next.state !== "active" && prev.didPointerMove) {
    prev.hitRegions.forEach(({ separator }) => {
      if (separator && separator.element.ownerDocument.activeElement === separator.element) {
        separator.element.blur()
      }
    })
  }

  eventEmitter.emit("change", { prev, next })
}

export function removeGroupFromInteraction(group) {
  if (state.state === "inactive") return false

  const hitRegions = state.hitRegions.filter(region => region.group !== group)
  const hasPreviews = state.state === "active" && state.previews.some(preview => preview.group === group)
  if (hitRegions.length === state.hitRegions.length && !hasPreviews) return false

  if (hitRegions.length === 0) {
    updateInteractionState({ cursorFlags: 0, state: "inactive" })
  } else if (state.state === "active") {
    const initialLayoutMap = new Map(state.initialLayoutMap)
    const previewLayoutMap = new Map(state.previewLayoutMap)
    initialLayoutMap.delete(group)
    previewLayoutMap.delete(group)

    updateInteractionState({
      ...state,
      cursorFlags: 0,
      hitRegions,
      initialLayoutMap,
      previewLayoutMap,
      previews: state.previews.filter(preview => preview.group !== group)
    })
  } else {
    updateInteractionState({ ...state, hitRegions })
  }

  return true
}
