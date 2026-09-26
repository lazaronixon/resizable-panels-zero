import { afterEach, describe, expect, test, vi } from "vitest"
import {
  deleteMutableGroup,
  getMountedGroupState,
  getMountedGroups,
  getRegisteredGroup,
  subscribeToMountedGroup,
  updateMountedGroup
} from "src/engine/groups_state"
import { mockGroup } from "./test_helper"

function stateWith(layout) {
  return {
    defaultLayoutDeferred: false,
    derivedPanelConstraints: [],
    groupSize: 100,
    layout,
    separatorToPanels: new Map()
  }
}

describe("groups state", () => {
  const groups = []

  afterEach(() => {
    while (groups.length) deleteMutableGroup(groups.pop())
  })

  function register(config) {
    const group = mockGroup(new DOMRect(0, 0, 100, 50), config)
    groups.push(group)
    return group
  }

  test("stores and looks up groups by id", () => {
    const group = register()
    const state = stateWith({ a: 100 })
    updateMountedGroup(group, state)

    expect(getRegisteredGroup(group.id)).toBe(group)
    expect(getMountedGroupState(group.id)).toBe(state)
    expect(getMountedGroups().get(group)).toBe(state)
  })

  test("returns undefined, or throws when asked to, for unknown ids", () => {
    expect(getRegisteredGroup("missing")).toBeUndefined()
    expect(getMountedGroupState("missing")).toBeUndefined()
    expect(() => getRegisteredGroup("missing", true)).toThrow("Could not find data for Group with id missing")
    expect(() => getMountedGroupState("missing", true)).toThrow("Could not find data for Group with id missing")
  })

  test("replaces the map instead of mutating it", () => {
    const group = register()
    const before = getMountedGroups()

    updateMountedGroup(group, stateWith({ a: 100 }))

    expect(getMountedGroups()).not.toBe(before)
    expect(before.has(group)).toBe(false)
  })

  test("notifies subscribers of their own group only", () => {
    const first = register({ id: "first" })
    const second = register({ id: "second" })

    const listener = vi.fn()
    const unsubscribe = subscribeToMountedGroup("first", listener)

    const prev = stateWith({ a: 50, b: 50 })
    const next = stateWith({ a: 60, b: 40 })
    updateMountedGroup(first, prev)
    updateMountedGroup(second, stateWith({ c: 100 }))
    updateMountedGroup(first, next, { isUserInteraction: true })

    unsubscribe()
    updateMountedGroup(first, prev)

    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener.mock.calls[0][0]).toEqual({ group: first, isUserInteraction: false, prev: undefined, next: prev })
    expect(listener.mock.calls[1][0]).toEqual({ group: first, isUserInteraction: true, prev, next })
  })

  test("deleting a group removes it", () => {
    const group = register()
    updateMountedGroup(group, stateWith({ a: 100 }))

    deleteMutableGroup(group)

    expect(getRegisteredGroup(group.id)).toBeUndefined()
  })
})
