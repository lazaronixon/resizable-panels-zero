import { CURSOR_FLAG_HORIZONTAL_MAX, CURSOR_FLAG_HORIZONTAL_MIN, CURSOR_FLAG_VERTICAL_MAX, CURSOR_FLAG_VERTICAL_MIN } from "src/cursor/cursor_style"
import { afterEach, describe, expect, test, vi } from "vitest"
import { completeActivePointerResize, updateActiveHitRegions } from "src/engine/active_resize"
import { getInteractionState, updateInteractionState } from "src/engine/interaction_state"
import { getMountedGroupState, getMountedGroups, subscribeToMountedGroup } from "src/engine/groups_state"
import { calculateHitRegions } from "src/dom/hit_regions"
import { calculateResizePreviews } from "src/engine/resize_previews"
import { mockGroup } from "./test_helper"
import { mountGroup } from "src/engine/mount_group"
import { onDocumentPointerMove } from "src/engine/pointer_handlers"

describe("updateActiveHitRegions preview bounds", () => {
  let unmount

  afterEach(() => {
    unmount?.()
    unmount = undefined

    updateInteractionState({ state: "inactive", cursorFlags: 0 })
  })

  test("missed pointer-up commits the last preview rather than the later hover position", () => {
    const group = mockGroup(new DOMRect(0, 0, 200, 100), { resizePreviewMode: "separator" })
    group.addPanel(new DOMRect(0, 0, 100, 100))
    group.addPanel(new DOMRect(100, 0, 100, 100))
    unmount = mountGroup(group)

    const hitRegions = calculateHitRegions({ group })
    const initialLayoutMap = new Map([ [ group, getMountedGroupState(group.id, true).layout ] ])
    const pointerDownAtPoint = { x: 100, y: 50 }

    updateInteractionState({
      cursorFlags: 0,
      didPointerMove: false,
      hitRegions,
      initialLayoutMap,
      pointerDownAtPoint,
      previewLayoutMap: new Map(initialLayoutMap),
      previews: calculateResizePreviews(group, hitRegions),
      state: "active"
    })

    updateActiveHitRegions({
      commit: false,
      document,
      event: { clientX: 140, clientY: 50, movementX: 40, movementY: 0 },
      hitRegions,
      initialLayoutMap,
      mountedGroups: getMountedGroups(),
      pointerDownAtPoint,
      prevCursorFlags: 0
    })
    expect(getMountedGroupState(group.id, true).layout[group.panels[0].id]).toBe(50)

    onDocumentPointerMove({
      buttons: 0,
      clientX: 100,
      clientY: 50,
      currentTarget: document,
      defaultPrevented: false,
      movementX: -40,
      movementY: 0
    })

    expect(getInteractionState().state).toBe("inactive")
    expect(getMountedGroupState(group.id, true).layout[group.panels[0].id]).toBe(70)
  })

  for (const orientation of [ "horizontal", "vertical" ]) {
    for (const direction of [ -1, 1 ]) {
      for (const disableCursor of [ false, true ]) {
        test(`${orientation}, direction ${direction}, disableCursor=${disableCursor}`, () => {
          const horizontal = orientation === "horizontal"
          const rect = (start, size) => (horizontal ? new DOMRect(start, 0, size, 100) : new DOMRect(0, start, 100, size))

          const group = mockGroup(rect(0, 200), { orientation, resizePreviewMode: "separator" })
          group.mutableState.disableCursor = disableCursor
          group.addPanel(rect(0, 100), "a", { minSize: "25%" })
          group.addPanel(rect(100, 100), "b", { minSize: "25%" })

          unmount = mountGroup(group)

          const initialLayout = getMountedGroupState(group.id, true).layout
          const hitRegions = calculateHitRegions({ group })
          const initialLayoutMap = new Map([ [ group, initialLayout ] ])
          const pointerDownAtPoint = { x: 100, y: 100 }

          updateInteractionState({
            state: "active",
            cursorFlags: 0,
            didPointerMove: false,
            hitRegions,
            initialLayoutMap,
            pointerDownAtPoint,
            previewLayoutMap: new Map(initialLayoutMap),
            previews: calculateResizePreviews(group, hitRegions)
          })

          let previousDelta = 0
          const move = (delta, commit = false) => {
            const movement = delta - previousDelta
            previousDelta = delta

            updateActiveHitRegions({
              commit,
              document,
              hitRegions,
              initialLayoutMap,
              mountedGroups: getMountedGroups(),
              pointerDownAtPoint,
              prevCursorFlags: getInteractionState().cursorFlags,
              event: {
                clientX: 100 + (horizontal ? delta : 0),
                clientY: 100 + (horizontal ? 0 : delta),
                movementX: horizontal ? movement : 0,
                movementY: horizontal ? 0 : movement
              }
            })
          }

          const expectedFlag = disableCursor
            ? 0
            : horizontal
              ? (direction < 0 ? CURSOR_FLAG_HORIZONTAL_MIN : CURSOR_FLAG_HORIZONTAL_MAX)
              : (direction < 0 ? CURSOR_FLAG_VERTICAL_MIN : CURSOR_FLAG_VERTICAL_MAX)

          move(direction * 60)
          const previousState = getInteractionState()

          move(direction * 70)
          expect(getInteractionState().cursorFlags).toBe(expectedFlag)
          expect(getMountedGroupState(group.id, true).layout).toEqual(initialLayout)

          const state = getInteractionState()
          expect(state.state).toBe("active")

          expect(state.previews[0].offset).toBe(direction * 50)
          expect(previousState.state).toBe("active")
          expect(state.previews).toBe(previousState.previews)
          expect(state.previews[0]).toBe(previousState.previews[0])

          // A rounded pointer event must preserve the bounds cursor.
          move(direction * 70)
          expect(getInteractionState().cursorFlags).toBe(expectedFlag)

          // Returning to the allowed range clears the bounds cursor.
          move(direction * 20)
          expect(getInteractionState().cursorFlags).toBe(0)

          move(direction * 60)
          move(direction * 70)

          // Committing the same preview still updates the mounted layout.
          move(direction * 70, true)
          expect(getMountedGroupState(group.id, true).layout[group.panels[0].id]).toBe(50 + direction * 25)
        })
      }
    }
  }
})

describe("completeActivePointerResize", () => {
  let unmount

  afterEach(() => {
    unmount?.()
    unmount = undefined

    updateInteractionState({ state: "inactive", cursorFlags: 0 })
  })

  test("returns false when no interaction is active", () => {
    expect(completeActivePointerResize(document, { clientX: 0, clientY: 0, movementX: 0, movementY: 0 })).toBe(false)
  })

  test("ends the interaction and emits a final user-interaction change", () => {
    const group = mockGroup(new DOMRect(0, 0, 200, 100))
    group.addPanel(new DOMRect(0, 0, 100, 100))
    group.addPanel(new DOMRect(100, 0, 100, 100))
    unmount = mountGroup(group)

    const hitRegions = calculateHitRegions({ group })
    const initialLayoutMap = new Map([ [ group, getMountedGroupState(group.id, true).layout ] ])

    updateInteractionState({
      cursorFlags: 0,
      didPointerMove: false,
      hitRegions,
      initialLayoutMap,
      pointerDownAtPoint: { x: 100, y: 50 },
      previewLayoutMap: new Map(initialLayoutMap),
      previews: [],
      state: "active"
    })

    const listener = vi.fn()
    const unsubscribe = subscribeToMountedGroup(group.id, listener)

    expect(completeActivePointerResize(document, { clientX: 120, clientY: 50, movementX: 20, movementY: 0 })).toBe(true)
    unsubscribe()

    expect(getInteractionState().state).toBe("inactive")
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].isUserInteraction).toBe(true)
  })

  test("commits the preview layout in separator preview mode", () => {
    const group = mockGroup(new DOMRect(0, 0, 200, 100), { resizePreviewMode: "separator" })
    group.addPanel(new DOMRect(0, 0, 100, 100))
    group.addPanel(new DOMRect(100, 0, 100, 100))
    unmount = mountGroup(group)

    const hitRegions = calculateHitRegions({ group })
    const initialLayoutMap = new Map([ [ group, getMountedGroupState(group.id, true).layout ] ])

    updateInteractionState({
      cursorFlags: 0,
      didPointerMove: false,
      hitRegions,
      initialLayoutMap,
      pointerDownAtPoint: { x: 100, y: 50 },
      previewLayoutMap: new Map(initialLayoutMap),
      previews: calculateResizePreviews(group, hitRegions),
      state: "active"
    })

    completeActivePointerResize(document, { clientX: 120, clientY: 50, movementX: 20, movementY: 0 })

    expect(getMountedGroupState(group.id, true).layout[group.panels[0].id]).toBe(60)
  })
})
