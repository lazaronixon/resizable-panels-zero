import { afterEach, describe, expect, test, vi } from "vitest"
import { getInteractionState, removeGroupFromInteraction, subscribeToInteractionState, updateCursorFlags, updateInteractionState } from "src/engine/interaction_state"
import { calculateHitRegions } from "src/dom/hit_regions"
import { calculateResizePreviews } from "src/engine/resize_previews"
import { mockGroup } from "./test_helper"

afterEach(() => {
  updateInteractionState({ cursorFlags: 0, state: "inactive" })
})

test("removing a group preserves the other group in a shared drag", () => {
  const groups = [ 0, 100 ].map(top => {
    const group = mockGroup(new DOMRect(0, top, 200, 100))
    group.addPanel(new DOMRect(0, 0, 100, 100))
    group.addPanel(new DOMRect(100, 0, 100, 100))
    return group
  })
  const hitRegions = groups.flatMap(group => calculateHitRegions({ group }))
  const initialLayoutMap = new Map(
    groups.map(group => [
      group,
      {
        [group.panels[0].id]: 50,
        [group.panels[1].id]: 50
      }
    ])
  )
  const previews = groups.flatMap(group => calculateResizePreviews(group, hitRegions))

  updateInteractionState({
    cursorFlags: 0,
    didPointerMove: false,
    hitRegions,
    initialLayoutMap,
    pointerDownAtPoint: { x: 100, y: 100 },
    previewLayoutMap: new Map(initialLayoutMap),
    previews,
    state: "active"
  })

  removeGroupFromInteraction(groups[0])

  const interaction = getInteractionState()
  expect(interaction.state).toBe("active")
  expect(interaction.hitRegions).toEqual([ hitRegions[1] ])
  expect(interaction.previews).toEqual([ previews[1] ])
  expect(interaction.previews[0]).toBe(previews[1])
  expect(interaction.initialLayoutMap.has(groups[0])).toBe(false)
  expect(interaction.previewLayoutMap.has(groups[0])).toBe(false)
  expect(interaction.initialLayoutMap.get(groups[1])).toBe(initialLayoutMap.get(groups[1]))

  removeGroupFromInteraction(groups[1])
  expect(getInteractionState().state).toBe("inactive")
})

describe("interaction state", () => {
  test("notifies subscribers with the previous and next state", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToInteractionState(listener)

    const prev = getInteractionState()
    updateInteractionState({ cursorFlags: 0, hitRegions: [], state: "hover" })

    expect(listener).toHaveBeenCalledWith({ prev, next: getInteractionState() })

    unsubscribe()
    updateInteractionState({ cursorFlags: 0, state: "inactive" })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test("removing a group from an inactive interaction is a no-op", () => {
    const group = mockGroup(new DOMRect(0, 0, 100, 50))
    expect(removeGroupFromInteraction(group)).toBe(false)
  })

  test("updateCursorFlags keeps didPointerMove sticky while active", () => {
    updateInteractionState({
      cursorFlags: 0,
      didPointerMove: false,
      hitRegions: [],
      initialLayoutMap: new Map(),
      pointerDownAtPoint: { x: 0, y: 0 },
      previewLayoutMap: new Map(),
      previews: [],
      state: "active"
    })

    updateCursorFlags(1, [], undefined, true)
    updateCursorFlags(2, [], undefined, false)

    expect(getInteractionState()).toMatchObject({ cursorFlags: 2, didPointerMove: true })
  })

  test("blurs a focused separator once a drag that moved ends", () => {
    const element = document.createElement("div")
    element.tabIndex = 0
    document.body.appendChild(element)
    element.focus()
    expect(document.activeElement).toBe(element)

    updateInteractionState({
      cursorFlags: 0,
      didPointerMove: true,
      hitRegions: [ { separator: { element } } ],
      initialLayoutMap: new Map(),
      pointerDownAtPoint: { x: 0, y: 0 },
      previewLayoutMap: new Map(),
      previews: [],
      state: "active"
    })
    updateInteractionState({ cursorFlags: 0, state: "inactive" })

    expect(document.activeElement).not.toBe(element)
  })
})
