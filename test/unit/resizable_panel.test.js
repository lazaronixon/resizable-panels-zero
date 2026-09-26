import { describe, expect, test } from "vitest"
import {
  detailsOf,
  flush,
  mount,
  moveSeparator,
  recordEvents,
  setDefaultElementBounds,
  setElementBoundsFunction
} from "./test_helper"
import { calculatePanelConstraints } from "src/dom/measurements"
import { getRegisteredGroup } from "src/engine/groups_state"

const CHANGE = "resizable-group:layout-change"
const CHANGED = "resizable-group:layout-changed"

function collapsedThresholdOf(panelId) {
  return calculatePanelConstraints(getRegisteredGroup("group", true)).find(constraints => constraints.panelId === panelId)?.collapsedThreshold
}

describe("resizable-panel", () => {
  test.each([ "5%", "5", "10px", 10 ])("collapsed-threshold %s is converted and updated", async collapsedThreshold => {
    setDefaultElementBounds(new DOMRect(0, 0, 100, 100))

    document.body.innerHTML = `
      <resizable-group id="group">
        <resizable-panel id="a" collapsible></resizable-panel>
        <resizable-panel id="b"></resizable-panel>
      </resizable-group>
    `
    // A number can only be given through the property.
    document.getElementById("a").collapsedThreshold = collapsedThreshold
    await flush()

    expect(collapsedThresholdOf("a")).toBe(5)

    document.getElementById("a").setAttribute("collapsed-threshold", "3%")
    await flush()

    expect(collapsedThresholdOf("a")).toBe(3)
  })

  test("a number assigned to a size property is pixels", async () => {
    await mount(`
      <resizable-group>
        <resizable-panel id="a"></resizable-panel>
      </resizable-group>
    `)

    const panel = document.getElementById("a")
    panel.minSize = 200
    panel.maxSize = "50"
    panel.defaultSize = null

    expect(panel.getAttribute("min-size")).toBe("200px")
    expect(panel.getAttribute("max-size")).toBe("50")
    expect(panel.hasAttribute("default-size")).toBe(false)
    expect(panel.panelConstraints).toEqual({
      collapsedSize: "0%",
      collapsedThreshold: undefined,
      collapsible: false,
      defaultSize: undefined,
      disabled: false,
      groupResizeBehavior: "preserve-relative-size",
      maxSize: "50",
      minSize: "200px"
    })
  })

  describe("disabled", () => {
    test("changing it does not remount the group", async () => {
      await mount(`
        <resizable-group id="group">
          <resizable-panel id="a" disabled></resizable-panel>
          <resizable-panel id="b"></resizable-panel>
        </resizable-group>
      `)

      const { panels: panelsMounted } = getRegisteredGroup("group", true)

      document.getElementById("a").disabled = false
      document.getElementById("b").disabled = true
      await flush()

      const { panels: panelsUpdated } = getRegisteredGroup("group", true)

      expect(panelsMounted).toBe(panelsUpdated)
      expect(document.getElementById("a").hasAttribute("data-disabled")).toBe(false)
      expect(document.getElementById("b").hasAttribute("data-disabled")).toBe(true)
    })

    test("changing it updates the panel's behavior", async () => {
      setElementBoundsFunction(element => {
        switch (element.id) {
          case "left":
            return new DOMRect(0, 0, 50, 50)
          case "separator":
            return new DOMRect(50, 0, 10, 50)
          case "right":
            return new DOMRect(60, 0, 50, 50)
        }
      })

      await mount(`
        <resizable-group>
          <resizable-panel id="left"></resizable-panel>
          <resizable-separator id="separator"></resizable-separator>
          <resizable-panel id="right"></resizable-panel>
        </resizable-group>
      `)

      let events = recordEvents(CHANGE, CHANGED)

      document.getElementById("left").disabled = true
      await flush()

      // Resizing is ignored while the panel is disabled.
      moveSeparator(25)
      expect(detailsOf(events, CHANGE)).toEqual([])
      expect(detailsOf(events, CHANGED)).toEqual([])

      events.stop()
      events = recordEvents(CHANGE, CHANGED)

      document.getElementById("left").disabled = false
      await flush()

      moveSeparator(25)
      expect(detailsOf(events, CHANGE)).not.toEqual([])
      expect(detailsOf(events, CHANGED)).not.toEqual([])
    })
  })

  describe("imperative methods", () => {
    test("do nothing before the group has mounted", () => {
      document.body.innerHTML = `
        <resizable-group>
          <resizable-panel id="a" collapsible></resizable-panel>
          <resizable-panel id="b"></resizable-panel>
        </resizable-group>
      `
      const panel = document.getElementById("a")

      expect(() => panel.collapse()).not.toThrow()
      expect(() => panel.expand()).not.toThrow()
      expect(() => panel.resize("20%")).not.toThrow()
      expect(panel.getSize()).toEqual({ asPercentage: 0, inPixels: 0 })
      expect(panel.isCollapsed()).toBe(false)
    })

    test("collapse, expand and report the panel's size", async () => {
      setElementBoundsFunction(element => {
        return element.hasAttribute("data-panel") ? new DOMRect(0, 0, 50, 50) : new DOMRect(0, 0, 100, 50)
      })

      const group = await mount(`
        <resizable-group>
          <resizable-panel id="a" collapsible min-size="20%"></resizable-panel>
          <resizable-panel id="b"></resizable-panel>
        </resizable-group>
      `)
      const panel = document.getElementById("a")

      expect(panel.getSize()).toEqual({ asPercentage: 50, inPixels: 50 })

      panel.resize("30%")
      expect(group.getLayout()).toEqual({ a: 30, b: 70 })

      panel.collapse()
      expect(panel.isCollapsed()).toBe(true)
      expect(group.getLayout()).toEqual({ a: 0, b: 100 })

      panel.expand()
      expect(panel.isCollapsed()).toBe(false)
      expect(group.getLayout()).toEqual({ a: 30, b: 70 })
    })
  })

  test("dispatches resizable-panel:resize with its size", async () => {
    setElementBoundsFunction(element => {
      return element.hasAttribute("data-panel") ? new DOMRect(0, 0, 50, 50) : new DOMRect(0, 0, 100, 50)
    })

    const events = recordEvents("resizable-panel:resize")
    await mount(`
      <resizable-group>
        <resizable-panel id="a"></resizable-panel>
        <resizable-panel id="b"></resizable-panel>
      </resizable-group>
    `)

    expect(detailsOf(events, "resizable-panel:resize", document.getElementById("a"))).toContainEqual({
      size: { asPercentage: 50, inPixels: 50 },
      prevSize: undefined
    })
  })

  // The React library checks that a panel's children do not re-render when the
  // layout changes; here, that a layout change touches nothing but the panels'
  // own style.
  test("a layout change leaves the panel's contents alone", async () => {
    setElementBoundsFunction(element => {
      return element.hasAttribute("data-panel") ? new DOMRect(0, 0, 50, 50) : new DOMRect(0, 0, 100, 50)
    })

    const group = await mount(`
      <resizable-group>
        <resizable-panel id="left"></resizable-panel>
        <resizable-panel id="right"><div class="child">Content</div></resizable-panel>
      </resizable-group>
    `)
    const child = document.querySelector(".child")

    const observer = new MutationObserver(() => {})
    observer.observe(group, { attributes: true, characterData: true, childList: true, subtree: true })

    group.setLayout({ left: 25, right: 75 })
    const mutations = observer.takeRecords()
    observer.disconnect()

    expect(group.getLayout()).toEqual({ left: 25, right: 75 })
    expect(mutations.length).toBeGreaterThan(0)
    for (const mutation of mutations) {
      expect(mutation.type).toBe("attributes")
      expect(mutation.attributeName).toBe("style")
      expect(mutation.target.localName).toBe("resizable-panel")
    }
    expect(document.querySelector(".child")).toBe(child)
    expect(child.textContent).toBe("Content")
  })

  describe("HTML attributes", () => {
    test("keeps an explicit id and marks itself with data-panel", async () => {
      await mount(`
        <resizable-group>
          <resizable-panel id="panel"></resizable-panel>
        </resizable-group>
      `)

      const panel = document.querySelector("[data-panel]")
      expect(panel.id).toBe("panel")
    })

    test("assigns an id, which the separator's aria-controls needs", async () => {
      await mount(`
        <resizable-group>
          <resizable-panel></resizable-panel>
        </resizable-group>
      `)

      expect(document.querySelector("[data-panel]").id).toMatch(/^resizable-panel-\d+$/)
    })

    test("leaves other attributes alone", async () => {
      await mount(`
        <resizable-group>
          <resizable-panel data-foo="abc" data-bar="123"></resizable-panel>
        </resizable-group>
      `)

      const panel = document.querySelector("[data-panel]")
      expect(panel.getAttribute("data-foo")).toBe("abc")
      expect(panel.getAttribute("data-bar")).toBe("123")
    })

    test("problematic styles are suppressed", async () => {
      await mount(`
        <resizable-group>
          <resizable-panel style="min-height: 100px; max-height: 100px; height: 100px; min-width: 100px; max-width: 100px; width: 100px; border: 100px solid black; padding: 100px; margin: 100px"></resizable-panel>
        </resizable-group>
      `)

      const style = getComputedStyle(document.querySelector("[data-panel]"))

      expect(style.minHeight).toBe("0px")
      expect(style.maxHeight).toBe("100%")
      expect(style.height).toBe("auto")

      expect(style.minWidth).toBe("0px")
      expect(style.maxWidth).toBe("100%")
      expect(style.width).toBe("auto")

      // jsdom does not let an !important shorthand in a stylesheet beat an
      // inline shorthand, so border, padding and margin are left to the
      // browser tests.
    })
  })
})
