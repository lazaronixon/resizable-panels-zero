import { afterEach, describe, expect, test, vi } from "vitest"
import { deleteMutableGroup, getMountedGroupState, getRegisteredGroup } from "src/engine/groups_state"
import { mockGroup, setElementBounds } from "./test_helper"
import { mountGroup } from "src/engine/mount_group"

const DOCUMENT_EVENTS = [ "contextmenu", "dblclick", "pointerdown", "pointerleave", "pointermove", "pointerout", "pointerup" ]

function twoPanelGroup(config, constraints = [ {}, {} ]) {
  const group = mockGroup(new DOMRect(0, 0, 1000, 50), config)
  group.addPanel(new DOMRect(0, 0, 500, 50), "a", constraints[0])
  group.addPanel(new DOMRect(500, 0, 500, 50), "b", constraints[1])
  return group
}

describe("mountGroup", () => {
  const unmounts = []

  function mount(group) {
    const unmount = mountGroup(group)
    unmounts.push(unmount)
    return unmount
  }

  afterEach(() => {
    while (unmounts.length) unmounts.pop()()
    vi.restoreAllMocks()
  })

  test("registers the group with its initial layout", () => {
    const group = twoPanelGroup()
    mount(group)

    expect(getRegisteredGroup(group.id)).toBe(group)
    expect(getMountedGroupState(group.id, true)).toMatchObject({
      defaultLayoutDeferred: false,
      groupSize: 1000,
      layout: { "group-1-a": 50, "group-1-b": 50 }
    })
  })

  test("removes the group from the global state when unmounted", () => {
    const group = twoPanelGroup()
    const unmount = mountGroup(group)

    unmount()

    expect(getRegisteredGroup(group.id)).toBeUndefined()
  })

  test("adds document listeners once however many groups are mounted", () => {
    const addSpy = vi.spyOn(document, "addEventListener")
    const removeSpy = vi.spyOn(document, "removeEventListener")

    const unmountFirst = mountGroup(twoPanelGroup())
    const unmountSecond = mountGroup(twoPanelGroup())

    const added = addSpy.mock.calls.map(([ type ]) => type).filter(type => DOCUMENT_EVENTS.includes(type))
    expect(added.sort()).toEqual([ ...DOCUMENT_EVENTS ].sort())

    unmountFirst()
    expect(removeSpy.mock.calls.filter(([ type ]) => DOCUMENT_EVENTS.includes(type))).toHaveLength(0)

    unmountSecond()
    const removed = removeSpy.mock.calls.map(([ type ]) => type).filter(type => DOCUMENT_EVENTS.includes(type))
    expect(removed.sort()).toEqual([ ...DOCUMENT_EVENTS ].sort())
  })

  test("adds a keydown listener to every separator", () => {
    const group = mockGroup(new DOMRect(0, 0, 1000, 50))
    group.addPanel(new DOMRect(0, 0, 495, 50), "a")
    group.addSeparator(new DOMRect(495, 0, 10, 50), "separator")
    group.addPanel(new DOMRect(505, 0, 495, 50), "b")

    const separatorElement = group.separators[0].element
    const addSpy = vi.spyOn(separatorElement, "addEventListener")
    const removeSpy = vi.spyOn(separatorElement, "removeEventListener")

    const unmount = mountGroup(group)
    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function))

    unmount()
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function))
  })

  test("maps each separator to the panels either side of it", () => {
    const group = mockGroup(new DOMRect(0, 0, 1000, 50))
    group.addPanel(new DOMRect(0, 0, 495, 50), "a")
    group.addSeparator(new DOMRect(495, 0, 10, 50), "separator", true)
    group.addPanel(new DOMRect(505, 0, 495, 50), "b")
    mount(group)

    const { separatorToPanels } = getMountedGroupState(group.id, true)
    expect(separatorToPanels.get(group.separators[0])).toEqual(group.panels)
  })

  test("throws if panel ids are not unique", () => {
    const group = mockGroup(new DOMRect(0, 0, 1000, 50))
    group.addPanel(new DOMRect(0, 0, 500, 50), "a")
    group.addPanel(new DOMRect(500, 0, 500, 50), "a")

    expect(() => mountGroup(group)).toThrow("Panel ids must be unique; id \"group-1-a\" was used more than once")
  })

  test("defers the layout while the group has no size", () => {
    const group = mockGroup(new DOMRect(0, 0, 0, 0))
    group.addPanel(new DOMRect(0, 0, 0, 0), "a", { defaultSize: "30%" })
    group.addPanel(new DOMRect(0, 0, 0, 0), "b")
    mount(group)

    expect(getMountedGroupState(group.id, true).defaultLayoutDeferred).toBe(true)

    // The group becomes visible.
    setElementBounds(group.panels[0].element, new DOMRect(0, 0, 300, 50))
    setElementBounds(group.panels[1].element, new DOMRect(300, 0, 700, 50))
    setElementBounds(group.element, new DOMRect(0, 0, 1000, 50))

    expect(getMountedGroupState(group.id, true)).toMatchObject({
      defaultLayoutDeferred: false,
      groupSize: 1000,
      layout: { "group-1-a": 30, "group-1-b": 70 }
    })
  })

  test("re-derives pixel constraints and revalidates the layout when the group resizes", () => {
    const group = twoPanelGroup({}, [ { minSize: "400px" }, {} ])
    mount(group)

    expect(getMountedGroupState(group.id, true).derivedPanelConstraints[0].minSize).toBe(40)
    expect(getMountedGroupState(group.id, true).layout).toEqual({ "group-1-a": 50, "group-1-b": 50 })

    setElementBounds(group.panels[0].element, new DOMRect(0, 0, 250, 50))
    setElementBounds(group.panels[1].element, new DOMRect(250, 0, 250, 50))
    setElementBounds(group.element, new DOMRect(0, 0, 500, 50))

    const groupState = getMountedGroupState(group.id, true)
    expect(groupState.groupSize).toBe(500)
    expect(groupState.derivedPanelConstraints[0].minSize).toBe(80)
    expect(groupState.layout).toEqual({ "group-1-a": 80, "group-1-b": 20 })
  })

  test("keeps preserve-pixel-size panels at the same pixel size when the group resizes", () => {
    const group = mockGroup(new DOMRect(0, 0, 1000, 50))
    group.addPanel(new DOMRect(0, 0, 200, 50), "a", { defaultSize: "20%", groupResizeBehavior: "preserve-pixel-size" })
    group.addPanel(new DOMRect(200, 0, 800, 50), "b")
    mount(group)

    expect(getMountedGroupState(group.id, true).layout).toEqual({ "group-1-a": 20, "group-1-b": 80 })

    setElementBounds(group.panels[0].element, new DOMRect(0, 0, 100, 50))
    setElementBounds(group.panels[1].element, new DOMRect(100, 0, 400, 50))
    setElementBounds(group.element, new DOMRect(0, 0, 500, 50))

    expect(getMountedGroupState(group.id, true).layout).toEqual({ "group-1-a": 40, "group-1-b": 60 })
  })

  test("reports panel sizes to onResize with the previous size", () => {
    const group = twoPanelGroup()
    mount(group)

    const onResize = group.panels[0].onResize
    expect(onResize).toHaveBeenLastCalledWith({ asPercentage: 50, inPixels: 500 }, "group-1-a", undefined)

    // The neighbour shrinks first, so the group still adds up to 1000px when
    // the observed panel reports.
    setElementBounds(group.panels[1].element, new DOMRect(600, 0, 400, 50))
    setElementBounds(group.panels[0].element, new DOMRect(0, 0, 600, 50))

    expect(onResize).toHaveBeenLastCalledWith({ asPercentage: 60, inPixels: 600 }, "group-1-a", { asPercentage: 50, inPixels: 500 })
  })

  test("stops observing once unmounted", () => {
    const group = twoPanelGroup()
    const unmount = mountGroup(group)
    unmount()

    const onResize = group.panels[0].onResize
    onResize.mockClear()

    setElementBounds(group.panels[0].element, new DOMRect(0, 0, 600, 50))

    expect(onResize).not.toHaveBeenCalled()
  })

  // Runs last: this assertion fires after the group has been registered, so it
  // leaves the group behind in the global state.
  test("throws if separator ids are not unique", () => {
    const group = mockGroup(new DOMRect(0, 0, 1000, 50))
    group.addPanel(new DOMRect(0, 0, 300, 50), "a")
    group.addSeparator(new DOMRect(300, 0, 10, 50), "separator")
    group.addPanel(new DOMRect(310, 0, 300, 50), "b")
    group.addSeparator(new DOMRect(610, 0, 10, 50), "separator")
    group.addPanel(new DOMRect(620, 0, 380, 50), "c")

    expect(() => mountGroup(group)).toThrow("Separator ids must be unique; id \"group-1-separator\" was used more than once")

    deleteMutableGroup(group)
  })
})
