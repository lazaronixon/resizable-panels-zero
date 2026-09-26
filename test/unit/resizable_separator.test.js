import { describe, expect, test, vi } from "vitest"
import {
  detailsOf,
  flush,
  keyDown,
  mount,
  moveSeparator,
  recordEvents,
  setElementBoundsFunction
} from "./test_helper"
import { subscribeToMountedGroup } from "src/engine/groups_state"

const CHANGE = "resizable-group:layout-change"
const CHANGED = "resizable-group:layout-changed"

describe("resizable-separator", () => {
  describe.each([ "horizontal", "vertical" ])("zero-sized %s group", orientation => {
    test.each([ false, true ])("supports prepending a panel (disabled: %s)", async disabled => {
      setElementBoundsFunction(() => new DOMRect(0, 0, 0, 0))

      const group = await mount(`
        <resizable-group orientation="${orientation}">
          <resizable-panel id="main"></resizable-panel>
        </resizable-group>
      `)

      group.insertAdjacentHTML("afterbegin", `
        <resizable-panel id="rail" ${disabled ? "disabled" : ""}></resizable-panel>
        <resizable-separator id="separator"></resizable-separator>
      `)
      await flush()

      const separator = document.querySelector("[role=separator]")
      expect(separator.getAttribute("aria-controls")).toBe("rail")
      expect(separator.getAttribute("aria-valuenow")).toBe("50")
    })

    test.each([ false, true ])("supports remounting a middle panel (disabled: %s)", async disabled => {
      setElementBoundsFunction(() => new DOMRect(0, 0, 0, 0))

      await mount(`
        <resizable-group orientation="${orientation}">
          <resizable-panel id="a"></resizable-panel>
          <resizable-separator id="first"></resizable-separator>
          <resizable-panel id="b" ${disabled ? "disabled" : ""}></resizable-panel>
          <resizable-separator id="second"></resizable-separator>
          <resizable-panel id="c" ${disabled ? "disabled" : ""}></resizable-panel>
        </resizable-group>
      `)

      const middle = document.getElementById("b")
      const second = document.getElementById("second")
      const last = document.getElementById("c")

      middle.remove()
      second.remove()
      await flush()

      last.before(middle, second)
      await flush()

      expect(document.getElementById("first").getAttribute("aria-controls")).toBe("a")
      expect(document.getElementById("second").getAttribute("aria-controls")).toBe("b")
    })
  })

  describe("disabled", () => {
    test("keyboard resizing follows changes to the disabled state", async () => {
      setElementBoundsFunction(element => new DOMRect(
        element.id === "left" ? 0 : 50,
        0,
        element.id === "separator" ? 0 : 50,
        50
      ))

      const group = await mount(`
        <resizable-group>
          <resizable-panel id="left"></resizable-panel>
          <resizable-separator id="separator" disabled></resizable-separator>
          <resizable-panel id="right"></resizable-panel>
        </resizable-group>
      `)
      const separator = document.getElementById("separator")

      separator.disabled = false
      await flush()
      separator.focus()

      keyDown(separator, "ArrowRight")
      expect(group.getLayout()).toEqual({ left: 55, right: 45 })

      separator.disabled = true
      await flush()
      expect(document.activeElement).toBe(separator)

      for (const key of [ "ArrowRight", "Home", "End", "Enter" ]) keyDown(separator, key)
      expect(group.getLayout()).toEqual({ left: 55, right: 45 })

      separator.disabled = false
      await flush()

      keyDown(separator, "ArrowLeft")
      expect(group.getLayout()).toEqual({ left: 50, right: 50 })
    })

    test("changing it does not remount the group", async () => {
      const onChange = vi.fn()
      const removeListener = subscribeToMountedGroup("group", onChange)

      await mount(`
        <resizable-group id="group">
          <resizable-panel></resizable-panel>
          <resizable-separator id="left" disabled></resizable-separator>
          <resizable-panel></resizable-panel>
          <resizable-separator id="right"></resizable-separator>
          <resizable-panel></resizable-panel>
        </resizable-group>
      `)
      expect(onChange).toHaveBeenCalled()

      onChange.mockReset()

      document.getElementById("left").disabled = false
      document.getElementById("right").disabled = true
      await flush()

      expect(onChange).not.toHaveBeenCalled()

      removeListener()
    })

    test("changing it updates the separator's behavior", async () => {
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
      const separator = document.getElementById("separator")

      let events = recordEvents(CHANGE, CHANGED)

      separator.disabled = true
      await flush()

      // Resizing is ignored while the separator is disabled.
      moveSeparator(25)
      expect(detailsOf(events, CHANGE)).toEqual([])
      expect(detailsOf(events, CHANGED)).toEqual([])

      events.stop()
      events = recordEvents(CHANGE, CHANGED)

      separator.disabled = false
      await flush()

      moveSeparator(25)
      expect(detailsOf(events, CHANGE)).not.toEqual([])
      expect(detailsOf(events, CHANGED)).not.toEqual([])
    })

    test("a disabled separator is not focusable and says so", async () => {
      await mount(`
        <resizable-group>
          <resizable-panel></resizable-panel>
          <resizable-separator id="separator" disabled></resizable-separator>
          <resizable-panel></resizable-panel>
        </resizable-group>
      `)
      const separator = document.getElementById("separator")

      expect(separator.hasAttribute("tabindex")).toBe(false)
      expect(separator.getAttribute("aria-disabled")).toBe("true")
      expect(separator.getAttribute("data-separator")).toBe("disabled")

      separator.disabled = false

      expect(separator.getAttribute("tabindex")).toBe("0")
      expect(separator.hasAttribute("aria-disabled")).toBe(false)
      expect(separator.getAttribute("data-separator")).toBe("inactive")
    })
  })

  test("data-separator follows focus", async () => {
    await mount(`
      <resizable-group>
        <resizable-panel></resizable-panel>
        <resizable-separator id="separator"></resizable-separator>
        <resizable-panel></resizable-panel>
      </resizable-group>
    `)
    const separator = document.getElementById("separator")

    separator.focus()
    expect(separator.getAttribute("data-separator")).toBe("focus")

    separator.blur()
    expect(separator.getAttribute("data-separator")).toBe("inactive")
  })

  describe("HTML attributes", () => {
    test("keeps an explicit id and has the separator role", async () => {
      await mount(`
        <resizable-group>
          <resizable-panel></resizable-panel>
          <resizable-separator id="separator"></resizable-separator>
          <resizable-panel></resizable-panel>
        </resizable-group>
      `)

      const separator = document.querySelector("[role=separator]")
      expect(separator.id).toBe("separator")
      expect(separator.getAttribute("tabindex")).toBe("0")
    })

    test("leaves other attributes alone", async () => {
      await mount(`
        <resizable-group>
          <resizable-panel></resizable-panel>
          <resizable-separator data-foo="abc" data-bar="123"></resizable-separator>
          <resizable-panel></resizable-panel>
        </resizable-group>
      `)

      const separator = document.querySelector("[role=separator]")
      expect(separator.getAttribute("data-foo")).toBe("abc")
      expect(separator.getAttribute("data-bar")).toBe("123")
    })

    test("aria-orientation is the opposite of the group's orientation", async () => {
      await mount(`
        <resizable-group orientation="vertical">
          <resizable-panel></resizable-panel>
          <resizable-separator id="separator"></resizable-separator>
          <resizable-panel></resizable-panel>
        </resizable-group>
      `)
      const group = document.querySelector("resizable-group")
      const separator = document.getElementById("separator")

      expect(separator.getAttribute("aria-orientation")).toBe("horizontal")

      group.orientation = "horizontal"
      await flush()

      expect(separator.getAttribute("aria-orientation")).toBe("vertical")
    })

    describe("ARIA attributes", () => {
      function printSeparators() {
        return Array.from(document.querySelectorAll("[role=separator]")).map(separator => {
          return `${separator.id}
  controls: ${separator.getAttribute("aria-controls")}
  value: ${separator.getAttribute("aria-valuenow")}% (${separator.getAttribute("aria-valuemin")}% - ${separator.getAttribute("aria-valuemax")}%)
`
        }).join("\n")
      }

      test("points at its primary panel, whose id is made up when missing", async () => {
        await mount(`
          <resizable-group>
            <resizable-panel id="left-panel"></resizable-panel>
            <resizable-separator id="left-separator"></resizable-separator>
            <resizable-panel></resizable-panel>
            <resizable-separator id="right-separator"></resizable-separator>
            <resizable-panel></resizable-panel>
          </resizable-group>
        `)

        expect(document.getElementById("left-separator").getAttribute("aria-controls")).toBe("left-panel")
        expect(document.getElementById("right-separator").getAttribute("aria-controls")).toMatch(/^resizable-panel-\d+$/)
      })

      test("computes values relative to the group, not the separator's own pair of panels", async () => {
        await mount(`
          <resizable-group>
            <resizable-panel id="left-panel"></resizable-panel>
            <resizable-separator id="left-separator"></resizable-separator>
            <resizable-panel id="middle-panel"></resizable-panel>
            <resizable-separator id="right-separator"></resizable-separator>
            <resizable-panel id="right-panel"></resizable-panel>
          </resizable-group>
        `)

        expect(printSeparators()).toBe(`left-separator
  controls: left-panel
  value: 33.334% (0% - 100%)

right-separator
  controls: middle-panel
  value: 33.333% (0% - 66.666%)
`)
      })

      test("works for a separator after the second panel", async () => {
        await mount(`
          <resizable-group>
            <resizable-panel id="left-panel"></resizable-panel>
            <resizable-panel id="middle-panel"></resizable-panel>
            <resizable-separator id="only-separator"></resizable-separator>
            <resizable-panel id="right-panel"></resizable-panel>
          </resizable-group>
        `)

        expect(printSeparators()).toBe(`only-separator
  controls: middle-panel
  value: 33.333% (0% - 66.666%)
`)
      })
    })
  })
})
