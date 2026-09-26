import EventEmitter from "../helpers/event_emitter"

// The state of every mounted group, keyed by its registration record. The map
// is replaced rather than mutated on every change, so a caller holding the old
// one keeps a consistent snapshot.
//
// A group's state holds:
// - defaultLayoutDeferred: the group had no size when it mounted, so its layout
//   has not been validated yet
// - derivedPanelConstraints: every panel's constraints, as percentages
// - groupSize: the space the panels share, in pixels
// - layout: panel id to percentage
// - separatorToPanels: each separator to the two panels either side of it
let map = new Map()

const eventEmitter = new EventEmitter()

export function deleteMutableGroup(group) {
  map = new Map(map)
  map.delete(group)
}

export function getRegisteredGroup(groupId, assert) {
  for (const [ group ] of map) {
    if (group.id === groupId) return group
  }

  if (assert) throw Error(`Could not find data for Group with id ${groupId}`)
}

export function getMountedGroupState(groupId, assert) {
  for (const [ group, mountedGroup ] of map) {
    if (group.id === groupId) return mountedGroup
  }

  if (assert) throw Error(`Could not find data for Group with id ${groupId}`)
}

export function getMountedGroups() {
  return map
}

export function subscribeToMountedGroup(groupId, callback) {
  return eventEmitter.addListener("groupChange", event => {
    if (event.group.id === groupId) callback(event)
  })
}

// `isUserInteraction` is true only when a pointer or keyboard handler caused
// the change, never for a constraint recompute, a new default size or an
// imperative call.
export function updateMountedGroup(group, next, meta) {
  const prev = map.get(group)

  map = new Map(map)
  map.set(group, next)

  eventEmitter.emit("groupChange", {
    group,
    isUserInteraction: meta?.isUserInteraction === true,
    prev,
    next
  })
}
