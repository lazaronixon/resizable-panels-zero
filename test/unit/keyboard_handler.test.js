import { adjustLayoutForSeparator, findSeparatorGroup } from "src/engine/keyboard_handler"
import { afterEach, describe, expect, test, vi } from "vitest"
import { getMountedGroupState, subscribeToMountedGroup } from "src/engine/groups_state"
import { keyDown, mockGroup } from "./test_helper"
import { mountGroup } from "src/engine/mount_group"

describe("onSeparatorKeyDown", () => {
  const unmounts = []

  afterEach(() => {
    while (unmounts.length) unmounts.pop()()
  })

  // Two panels of 500px around a 10px separator; the panels share 990px.
  function init({ orientation = "horizontal", constraints = [ {}, {} ], disabledSeparator = false, config = {} } = {}) {
    const horizontal = orientation === "horizontal"
    const rect = (start, size) => (horizontal ? new DOMRect(start, 0, size, 50) : new DOMRect(0, start, 50, size))

    const group = mockGroup(rect(0, 1010), { orientation, ...config })
    group.addPanel(rect(0, 500), "a", constraints[0])
    group.addSeparator(rect(500, 10), "separator", disabledSeparator)
    group.addPanel(rect(510, 500), "b", constraints[1])

    document.body.appendChild(group.element)
    unmounts.push(mountGroup(group))

    return { group, separator: group.separators[0].element }
  }

  function layoutOf(group) {
    return Object.values(getMountedGroupState(group.id, true).layout)
  }

  test.each([
    [ "horizontal", "ArrowRight", [ 55, 45 ] ],
    [ "horizontal", "ArrowLeft", [ 45, 55 ] ],
    [ "horizontal", "ArrowUp", [ 50, 50 ] ],
    [ "horizontal", "ArrowDown", [ 50, 50 ] ],
    [ "vertical", "ArrowDown", [ 55, 45 ] ],
    [ "vertical", "ArrowUp", [ 45, 55 ] ],
    [ "vertical", "ArrowLeft", [ 50, 50 ] ],
    [ "vertical", "ArrowRight", [ 50, 50 ] ]
  ])("%s group: %s moves the separator by 5%", (orientation, key, expected) => {
    const { group, separator } = init({ orientation })

    const event = keyDown(separator, key)

    expect(event.defaultPrevented).toBe(true)
    expect(layoutOf(group)).toEqual(expected)
  })

  test("Home gives the primary panel its smallest size", () => {
    const { group, separator } = init({ constraints: [ { minSize: "20%" }, {} ] })

    keyDown(separator, "Home")

    expect(layoutOf(group)).toEqual([ 20, 80 ])
  })

  test("End gives the primary panel its largest size", () => {
    const { group, separator } = init({ constraints: [ { maxSize: "70%" }, {} ] })

    keyDown(separator, "End")

    expect(layoutOf(group)).toEqual([ 70, 30 ])
  })

  test("Enter collapses the primary panel and restores its previous size", () => {
    const { group, separator } = init({ constraints: [ { collapsible: true, minSize: "20%" }, {} ] })

    keyDown(separator, "Enter")
    expect(layoutOf(group)).toEqual([ 0, 100 ])

    // The group element records the size before collapse; do it by hand here.
    group.mutableState.expandedPanelSizes["group-1-a"] = 50

    keyDown(separator, "Enter")
    expect(layoutOf(group)).toEqual([ 50, 50 ])
  })

  test("Enter restores to the minimum size when no previous size is known", () => {
    const { group, separator } = init({ constraints: [ { collapsible: true, defaultSize: "0%", minSize: "20%" }, {} ] })

    expect(layoutOf(group)).toEqual([ 0, 100 ])

    keyDown(separator, "Enter")
    expect(layoutOf(group)).toEqual([ 20, 80 ])
  })

  test("Enter does nothing for a panel that cannot collapse", () => {
    const { group, separator } = init()

    keyDown(separator, "Enter")

    expect(layoutOf(group)).toEqual([ 50, 50 ])
  })

  test("keyboard resizes are flagged as user interactions", () => {
    const { group, separator } = init()

    const listener = vi.fn()
    const unsubscribe = subscribeToMountedGroup(group.id, listener)

    keyDown(separator, "ArrowRight")
    unsubscribe()

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].isUserInteraction).toBe(true)
  })

  test("does nothing when the separator is disabled", () => {
    const { group, separator } = init()
    group.separators[0].disabled = true

    const event = keyDown(separator, "ArrowRight")

    expect(event.defaultPrevented).toBe(false)
    expect(layoutOf(group)).toEqual([ 50, 50 ])
  })

  test("does nothing when the group is disabled", () => {
    const { group, separator } = init({ config: { disabled: true } })

    keyDown(separator, "ArrowRight")

    expect(layoutOf(group)).toEqual([ 50, 50 ])
  })

  test("ignores events that were already handled", () => {
    const { group, separator } = init()

    const event = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })
    event.preventDefault()
    separator.dispatchEvent(event)

    expect(layoutOf(group)).toEqual([ 50, 50 ])
  })

  test("F6 and Shift+F6 cycle focus through the group's separators", () => {
    const group = mockGroup(new DOMRect(0, 0, 1020, 50))
    group.addPanel(new DOMRect(0, 0, 330, 50), "a")
    group.addSeparator(new DOMRect(330, 0, 10, 50), "first")
    group.addPanel(new DOMRect(340, 0, 340, 50), "b")
    group.addSeparator(new DOMRect(680, 0, 10, 50), "second")
    group.addPanel(new DOMRect(690, 0, 330, 50), "c")
    group.separators.forEach(({ element }) => element.setAttribute("tabindex", "0"))

    document.body.appendChild(group.element)
    unmounts.push(mountGroup(group))

    const [ first, second ] = group.separators.map(({ element }) => element)

    first.focus()
    keyDown(first, "F6")
    expect(document.activeElement).toBe(second)

    keyDown(second, "F6")
    expect(document.activeElement).toBe(first)

    keyDown(first, "F6", { shiftKey: true })
    expect(document.activeElement).toBe(second)
  })

  test("findSeparatorGroup throws for a separator of no mounted group", () => {
    expect(() => findSeparatorGroup(document.createElement("div"))).toThrow("Could not find parent Group for separator element")
  })

  test("adjustLayoutForSeparator does not emit when the layout cannot change", () => {
    const { group, separator } = init({ constraints: [ { minSize: "50%" }, {} ] })

    const listener = vi.fn()
    const unsubscribe = subscribeToMountedGroup(group.id, listener)

    adjustLayoutForSeparator(separator, -5)
    unsubscribe()

    expect(listener).not.toHaveBeenCalled()
  })
})
