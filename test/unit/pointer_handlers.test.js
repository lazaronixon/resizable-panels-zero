import { afterEach, describe, expect, test, vi } from "vitest"
import { getInteractionState, updateInteractionState } from "src/engine/interaction_state"
import { getMountedGroupState, subscribeToMountedGroup } from "src/engine/groups_state"
import { mockGroup, pointerEvent } from "./test_helper"
import { mountGroup } from "src/engine/mount_group"

describe("pointer handlers", () => {
  const unmounts = []

  afterEach(() => {
    while (unmounts.length) unmounts.pop()()
    updateInteractionState({ cursorFlags: 0, state: "inactive" })
  })

  function mount(group) {
    document.body.appendChild(group.element)
    unmounts.push(mountGroup(group))
    return group
  }

  // Two 500px panels with no separator; the boundary's hit region is 495..505.
  function init(constraints = [ {}, {} ], config = {}) {
    const group = mockGroup(new DOMRect(0, 0, 1000, 50), config)
    group.addPanel(new DOMRect(0, 0, 500, 50), "a", constraints[0])
    group.addPanel(new DOMRect(500, 0, 500, 50), "b", constraints[1])
    return mount(group)
  }

  // 495px panels around a 10px separator, the first with a default size of 30%.
  function initWithSeparator({ disableDoubleClick = false } = {}) {
    const group = mockGroup(new DOMRect(0, 0, 1000, 50))
    group.addPanel(new DOMRect(0, 0, 495, 50), "a", { defaultSize: "30%" })
    group.addSeparator(new DOMRect(495, 0, 10, 50), "separator", false, disableDoubleClick)
    group.addPanel(new DOMRect(505, 0, 495, 50), "b")
    return mount(group)
  }

  function layoutOf(group) {
    return Object.values(getMountedGroupState(group.id, true).layout)
  }

  function dispatch(type, init) {
    const event = pointerEvent(type, init)
    document.body.dispatchEvent(event)
    return event
  }

  describe("hover", () => {
    test("hovering a boundary enters the hover state, leaving it goes back to inactive", () => {
      init()

      dispatch("pointermove", { clientX: 500, clientY: 25, buttons: 0 })
      expect(getInteractionState().state).toBe("hover")

      dispatch("pointermove", { clientX: 200, clientY: 25, buttons: 0 })
      expect(getInteractionState().state).toBe("inactive")
    })

    test("moving onto an iframe clears the hover state", () => {
      init()

      dispatch("pointermove", { clientX: 500, clientY: 25, buttons: 0 })
      expect(getInteractionState().state).toBe("hover")

      dispatch("pointerout", { clientX: 500, clientY: 25, relatedTarget: document.createElement("iframe") })
      expect(getInteractionState().state).toBe("inactive")
    })
  })

  describe("drag", () => {
    test("pointerdown, pointermove and pointerup resize the panels", () => {
      const group = init()

      const listener = vi.fn()
      const unsubscribe = subscribeToMountedGroup(group.id, listener)

      const down = dispatch("pointerdown", { clientX: 500, clientY: 25 })
      expect(down.defaultPrevented).toBe(true)
      expect(getInteractionState().state).toBe("active")

      dispatch("pointermove", { clientX: 600, clientY: 25 })
      expect(layoutOf(group)).toEqual([ 60, 40 ])

      const up = dispatch("pointerup", { clientX: 600, clientY: 25, buttons: 0 })
      unsubscribe()

      expect(up.defaultPrevented).toBe(true)
      expect(getInteractionState().state).toBe("inactive")
      expect(layoutOf(group)).toEqual([ 60, 40 ])
      expect(listener.mock.calls.at(-1)[0].isUserInteraction).toBe(true)
    })

    test("the drag is measured from where the pointer went down", () => {
      const group = init()

      dispatch("pointerdown", { clientX: 503, clientY: 25 })
      dispatch("pointermove", { clientX: 553, clientY: 25 })

      expect(layoutOf(group)).toEqual([ 55, 45 ])
    })

    test("respects panel constraints", () => {
      const group = init([ { maxSize: "70%" }, {} ])

      dispatch("pointerdown", { clientX: 500, clientY: 25 })
      dispatch("pointermove", { clientX: 900, clientY: 25 })

      expect(layoutOf(group)).toEqual([ 70, 30 ])
    })

    test("ignores the secondary mouse button", () => {
      init()

      const down = dispatch("pointerdown", { clientX: 500, clientY: 25, button: 2 })

      expect(down.defaultPrevented).toBe(false)
      expect(getInteractionState().state).toBe("inactive")
    })

    test("ignores events that were already handled", () => {
      init()

      const event = pointerEvent("pointerdown", { clientX: 500, clientY: 25 })
      event.preventDefault()
      document.body.dispatchEvent(event)

      expect(getInteractionState().state).toBe("inactive")
    })

    test("ignores presses away from any boundary", () => {
      init()

      const down = dispatch("pointerdown", { clientX: 200, clientY: 25 })

      expect(down.defaultPrevented).toBe(false)
      expect(getInteractionState().state).toBe("inactive")
    })

    test("ignores disabled groups", () => {
      init([ {}, {} ], { disabled: true })

      dispatch("pointerdown", { clientX: 500, clientY: 25 })

      expect(getInteractionState().state).toBe("inactive")
    })

    test("a pointermove without buttons ends a drag whose pointerup was missed", () => {
      const group = init()

      const listener = vi.fn()
      const unsubscribe = subscribeToMountedGroup(group.id, listener)

      dispatch("pointerdown", { clientX: 500, clientY: 25 })
      dispatch("pointermove", { clientX: 600, clientY: 25 })
      dispatch("pointermove", { clientX: 700, clientY: 25, buttons: 0 })
      unsubscribe()

      expect(getInteractionState().state).toBe("inactive")
      expect(layoutOf(group)).toEqual([ 60, 40 ])
      expect(listener.mock.calls.at(-1)[0].isUserInteraction).toBe(true)
    })

    test("a context menu ends the drag", () => {
      const group = init()

      dispatch("pointerdown", { clientX: 500, clientY: 25 })
      dispatch("pointermove", { clientX: 600, clientY: 25 })

      document.body.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 600, clientY: 25 }))

      expect(getInteractionState().state).toBe("inactive")
      expect(layoutOf(group)).toEqual([ 60, 40 ])
    })

    test("leaving the document pushes the boundary to its limit", () => {
      const group = init([ { minSize: "10%" }, {} ])

      dispatch("pointerdown", { clientX: 500, clientY: 25 })

      document.dispatchEvent(pointerEvent("pointerleave", { clientX: -10, clientY: 25 }))

      expect(layoutOf(group)).toEqual([ 10, 90 ])
    })

    test("a separator grabbed by the pointer is focused", () => {
      const group = initWithSeparator()
      const separator = group.separators[0].element
      separator.setAttribute("tabindex", "0")

      dispatch("pointerdown", { clientX: 500, clientY: 25 })

      expect(document.activeElement).toBe(separator)
    })
  })

  describe("double click", () => {
    test("resets the panel beside the separator to its default size", () => {
      const group = initWithSeparator()
      expect(layoutOf(group)).toEqual([ 30, 70 ])

      dispatch("pointerdown", { clientX: 500, clientY: 25 })
      dispatch("pointermove", { clientX: 599, clientY: 25 })
      dispatch("pointerup", { clientX: 599, clientY: 25, buttons: 0 })
      expect(layoutOf(group)).toEqual([ 40, 60 ])

      const event = new MouseEvent("dblclick", { bubbles: true, cancelable: true, clientX: 500, clientY: 25 })
      document.body.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(true)
      expect(layoutOf(group)).toEqual([ 30, 70 ])
    })

    test("does nothing when the separator disables double click", () => {
      const group = initWithSeparator({ disableDoubleClick: true })

      dispatch("pointerdown", { clientX: 500, clientY: 25 })
      dispatch("pointermove", { clientX: 599, clientY: 25 })
      dispatch("pointerup", { clientX: 599, clientY: 25, buttons: 0 })

      const event = new MouseEvent("dblclick", { bubbles: true, cancelable: true, clientX: 500, clientY: 25 })
      document.body.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(false)
      expect(layoutOf(group)).toEqual([ 40, 60 ])
    })

    test("does nothing on an edge without a separator", () => {
      const group = init([ { defaultSize: "30%" }, {} ])

      // The mocked rects stay put, so the boundary is still hit at 500px.
      dispatch("pointerdown", { clientX: 500, clientY: 25 })
      dispatch("pointermove", { clientX: 600, clientY: 25 })
      dispatch("pointerup", { clientX: 600, clientY: 25, buttons: 0 })
      expect(layoutOf(group)).toEqual([ 40, 60 ])

      document.body.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, clientX: 500, clientY: 25 }))

      expect(layoutOf(group)).toEqual([ 40, 60 ])
    })
  })
})
