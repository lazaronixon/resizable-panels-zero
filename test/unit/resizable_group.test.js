import { describe, expect, test, vi } from "vitest"
import {
  captureMicrotaskErrors,
  detailsOf,
  flush,
  keyDown,
  mount,
  moveSeparator,
  pointerEvent,
  recordEvents,
  setDefaultElementBounds,
  setElementBoundsFunction
} from "./test_helper"
import { subscribeToMountedGroup } from "src/engine/groups_state"

const CHANGE = "resizable-group:layout-change"
const CHANGED = "resizable-group:layout-changed"

function record() {
  return recordEvents(CHANGE, CHANGED)
}

describe("resizable-group", () => {
  test.each([ "keyboard", "pointer", "imperative" ])("resizes panels with numeric ids in physical order using %s", async trigger => {
    setElementBoundsFunction(element => new DOMRect(
      element.id === "1" || element.id === "separator" ? 50 : 0,
      0,
      element.id === "separator" ? 0 : 50,
      50
    ))

    const group = await mount(`
      <resizable-group>
        <resizable-panel id="2"></resizable-panel>
        <resizable-separator id="separator"></resizable-separator>
        <resizable-panel id="1"></resizable-panel>
      </resizable-group>
    `)

    if (trigger === "keyboard") {
      const separator = document.getElementById("separator")
      separator.focus()
      keyDown(separator, "ArrowRight")
    } else if (trigger === "pointer") {
      moveSeparator(5)
    } else {
      document.getElementById("2").resize("55%")
    }

    expect(group.getLayout()).toEqual({ "2": 55, "1": 45 })
  })

  test.each([ "0px", "30px" ])("revealing a hidden group validates its default layout with min-size %s", async minSize => {
    const group = await mount(`
      <resizable-group default-layout='{"a":20,"b":80}'>
        <resizable-panel id="a" min-size="${minSize}"></resizable-panel>
        <resizable-panel id="b"></resizable-panel>
      </resizable-group>
    `)
    expect(group.getLayout()).toEqual({})

    setDefaultElementBounds(new DOMRect(0, 0, 50, 50))

    const a = Math.max(20, parseInt(minSize))
    expect(group.getLayout()).toEqual({ a, b: 100 - a })
  })

  test("ordinary pointer presses do not suppress layout commit events", async () => {
    setDefaultElementBounds(new DOMRect(0, 0, 50, 50))

    const group = await mount(`
      <resizable-group>
        <resizable-panel id="a"><button>Resize</button></resizable-panel>
        <resizable-panel id="b"></resizable-panel>
      </resizable-group>
    `)
    const events = record()

    const button = document.querySelector("button")
    button.dispatchEvent(pointerEvent("pointerdown", { clientX: 10, clientY: 25 }))
    group.setLayout({ a: 25, b: 75 })
    button.dispatchEvent(pointerEvent("pointerup", { clientX: 10, clientY: 25, buttons: 0 }))

    expect(detailsOf(events, CHANGED)).toEqual([ { layout: { a: 25, b: 75 }, isUserInteraction: false } ])
  })

  test("updates resizeTargetMinimumSize without resetting the layout", async () => {
    setElementBoundsFunction(element => new DOMRect(
      element.id === "a" ? 0 : 50,
      0,
      element.id === "separator" ? 0 : 50,
      50
    ))

    document.body.innerHTML = `
      <resizable-group>
        <resizable-panel id="a"></resizable-panel>
        <resizable-separator id="separator"></resizable-separator>
        <resizable-panel id="b"></resizable-panel>
      </resizable-group>
    `
    const group = document.querySelector("resizable-group")
    group.resizeTargetMinimumSize = { fine: 10, coarse: 10 }
    await flush()

    group.setLayout({ a: 40, b: 60 })
    group.resizeTargetMinimumSize = { fine: 40, coarse: 40 }
    await flush()
    expect(group.getLayout()).toEqual({ a: 40, b: 60 })

    const panel = document.getElementById("a")
    panel.dispatchEvent(pointerEvent("pointerdown", { clientX: 35, clientY: 25 }))
    panel.dispatchEvent(pointerEvent("pointermove", { clientX: 40, clientY: 25 }))
    panel.dispatchEvent(pointerEvent("pointerup", { clientX: 40, clientY: 25, buttons: 0 }))

    expect(group.getLayout()).toEqual({ a: 45, b: 55 })
  })

  test("resizing another group does not suppress layout commit events", async () => {
    setElementBoundsFunction(element => new DOMRect(
      element.id === "left" ? 0 : 50,
      element.id === "a" || element.id === "b" ? 100 : 0,
      element.id === "separator" ? 0 : 50,
      50
    ))

    await mount(`
      <resizable-group>
        <resizable-panel id="left"></resizable-panel>
        <resizable-separator id="separator"></resizable-separator>
        <resizable-panel id="right"></resizable-panel>
      </resizable-group>
      <resizable-group id="second">
        <resizable-panel id="a"></resizable-panel>
        <resizable-panel id="b"></resizable-panel>
      </resizable-group>
    `)
    const second = document.getElementById("second")
    const events = record()

    const separator = document.getElementById("separator")
    separator.dispatchEvent(pointerEvent("pointerdown", { clientX: 50, clientY: 25 }))
    second.setLayout({ a: 25, b: 75 })
    separator.dispatchEvent(pointerEvent("pointerup", { clientX: 50, clientY: 25, buttons: 0 }))

    expect(detailsOf(events, CHANGED, second)).toEqual([ { layout: { a: 25, b: 75 }, isUserInteraction: false } ])
  })

  test("changes to default-layout or disable-cursor do not remount the group", async () => {
    const onChange = vi.fn()
    const removeListener = subscribeToMountedGroup("group", onChange)

    const group = await mount(`
      <resizable-group id="group" default-layout='{"a":50,"b":50}'>
        <resizable-panel id="a"></resizable-panel>
        <resizable-panel id="b"></resizable-panel>
      </resizable-group>
    `)
    expect(onChange).toHaveBeenCalled()

    onChange.mockReset()

    group.defaultLayout = { a: 35, b: 65 }
    group.disableCursor = true
    await flush()
    expect(onChange).not.toHaveBeenCalled()

    removeListener()
  })

  test("supports updates to either group or panel ids", async () => {
    const errors = await captureMicrotaskErrors(async () => {
      const group = await mount(`
        <resizable-group id="a">
          <resizable-panel id="a-a"></resizable-panel>
          <resizable-panel id="a-b"></resizable-panel>
        </resizable-group>
      `)

      const [ first, second ] = group.querySelectorAll("resizable-panel")
      first.id = "b-a"
      second.id = "b-b"
      await flush()

      group.id = "b"
      await flush()

      group.id = "c"
      first.id = "c-a"
      second.id = "c-b"
      await flush()
    })

    expect(errors).toEqual([])
    expect(document.getElementById("c").getLayout()).toEqual({})
  })

  describe("in-memory layout cache", () => {
    async function runTest(callback, expectedLayout, expectedIsUserInteraction) {
      setElementBoundsFunction(element => {
        switch (element.id) {
          case "group":
            return new DOMRect(0, 0, 100, 50)
          case "left":
            return new DOMRect(0, 0, 50, 50)
          case "right":
            return new DOMRect(50, 0, 50, 50)
          case "separator":
            return new DOMRect(50, 0, 0, 50)
        }
      })

      const events = record()

      const group = await mount(`
        <resizable-group id="group">
          <resizable-panel id="left"></resizable-panel>
          <resizable-separator id="separator"></resizable-separator>
          <resizable-panel id="right"></resizable-panel>
        </resizable-group>
      `)

      let changed = detailsOf(events, CHANGED)
      expect(changed).toHaveLength(1)
      expect(changed.at(-1)).toEqual({ layout: { left: 50, right: 50 }, isUserInteraction: false })

      await callback({ group })

      changed = detailsOf(events, CHANGED)
      expect(changed).toHaveLength(2)
      expect(changed.at(-1)).toEqual({ layout: expectedLayout, isUserInteraction: expectedIsUserInteraction })

      const left = document.getElementById("left")
      const separator = document.getElementById("separator")
      left.remove()
      separator.remove()
      await flush()

      changed = detailsOf(events, CHANGED)
      expect(changed).toHaveLength(3)
      expect(changed.at(-1)).toEqual({ layout: { right: 100 }, isUserInteraction: false })

      const right = document.getElementById("right")
      group.insertBefore(left, right)
      group.insertBefore(separator, right)
      await flush()

      changed = detailsOf(events, CHANGED)
      expect(changed).toHaveLength(4)
      expect(changed.at(-1)).toEqual({ layout: expectedLayout, isUserInteraction: false })
    }

    test("updates when resized via pointer", async () => {
      await runTest(() => moveSeparator(10, "separator"), { left: 60, right: 40 }, true)
    })

    // See github.com/bvaughn/react-resizable-panels/issues/723
    test("does not break if a right click happens while the left button is down", async () => {
      await runTest(() => {
        const separator = document.querySelector("[data-separator]")

        const clientX = separator.offsetLeft
        const clientY = separator.offsetHeight / 2

        expect(separator.getAttribute("data-separator")).toBe("inactive")

        separator.dispatchEvent(pointerEvent("pointerdown", { clientX, clientY }))
        separator.dispatchEvent(pointerEvent("pointermove", { clientX: clientX + 10, clientY }))

        expect(separator.getAttribute("data-separator")).toBe("active")

        // A right button press while dragging shows the context menu, which
        // ends the drag.
        separator.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX, clientY, button: 2 }))

        expect(separator.getAttribute("data-separator")).toBe("inactive")

        // No-op
        document.dispatchEvent(pointerEvent("pointermove", { clientX: clientX + 20, clientY: 200 }))
        separator.dispatchEvent(pointerEvent("pointerup", { clientX: clientX + 10, clientY, buttons: 0 }))
      }, { left: 60, right: 40 }, true)
    })

    test("updates when resized via keyboard", async () => {
      await runTest(() => {
        const separator = document.getElementById("separator")
        separator.focus()
        keyDown(separator, "ArrowRight")
      }, { left: 55, right: 45 }, true)
    })

    test("updates when resized via the group's setLayout()", async () => {
      await runTest(({ group }) => {
        group.setLayout({ left: 75, right: 25 })
      }, { left: 75, right: 25 }, false)
    })

    test("updates when resized via a panel's resize()", async () => {
      await runTest(() => {
        document.getElementById("left").resize(35)
      }, { left: 35, right: 65 }, false)
    })
  })

  describe("group-resize-behavior", () => {
    function mockElementBounds({ groupSize, leftPanelSize, rightPanelSize }) {
      setElementBoundsFunction(element => {
        switch (element.id) {
          case "group":
            return new DOMRect(0, 0, groupSize, 50)
          case "left":
            return new DOMRect(0, 0, leftPanelSize, 50)
          case "right":
            return new DOMRect(leftPanelSize, 0, rightPanelSize, 50)
        }
      })
    }

    test("preserve-relative-size keeps percentages when the group resizes", async () => {
      mockElementBounds({ groupSize: 1, leftPanelSize: 1, rightPanelSize: 1 })

      const events = record()
      const group = await mount(`
        <resizable-group id="group">
          <resizable-panel id="left" default-size="25%" group-resize-behavior="preserve-relative-size"></resizable-panel>
          <resizable-panel id="right"></resizable-panel>
        </resizable-group>
      `)

      expect(detailsOf(events, CHANGED)).toEqual([ { layout: { left: 25, right: 75 }, isUserInteraction: false } ])
      expect(group.getLayout()).toEqual({ left: 25, right: 75 })

      mockElementBounds({ groupSize: 2, leftPanelSize: 1, rightPanelSize: 1 })

      expect(group.getLayout()).toEqual({ left: 25, right: 75 })
      expect(detailsOf(events, CHANGED)).toHaveLength(1)
    })

    test("preserve-pixel-size keeps pixels when the group resizes", async () => {
      mockElementBounds({ groupSize: 800, leftPanelSize: 200, rightPanelSize: 600 })

      const events = record()
      const group = await mount(`
        <resizable-group id="group">
          <resizable-panel id="left" default-size="25%" group-resize-behavior="preserve-pixel-size"></resizable-panel>
          <resizable-panel id="right"></resizable-panel>
        </resizable-group>
      `)

      expect(detailsOf(events, CHANGED)).toEqual([ { layout: { left: 25, right: 75 }, isUserInteraction: false } ])
      expect(group.getLayout()).toEqual({ left: 25, right: 75 })

      mockElementBounds({ groupSize: 1000, leftPanelSize: 200, rightPanelSize: 800 })

      const changed = detailsOf(events, CHANGED)
      expect(changed).toHaveLength(2)
      expect(changed.at(-1)).toEqual({ layout: { left: 20, right: 80 }, isUserInteraction: false })
      expect(group.getLayout()).toEqual({ left: 20, right: 80 })
    })
  })

  describe("default-layout", () => {
    test("is ignored if it does not match the panel ids", async () => {
      setDefaultElementBounds(new DOMRect(0, 0, 100, 50))

      const events = record()
      await mount(`
        <resizable-group default-layout='{"top":40,"bottom":60}'>
          <resizable-panel id="left"></resizable-panel>
          <resizable-panel id="right"></resizable-panel>
        </resizable-group>
      `)

      expect(detailsOf(events, CHANGE)).toEqual([ { layout: { left: 50, right: 50 } } ])
    })

    test("is ignored if it does not match the panel ids (mounted within a hidden subtree)", async () => {
      const events = record()
      await mount(`
        <resizable-group default-layout='{"top":40,"bottom":60}'>
          <resizable-panel id="left"></resizable-panel>
          <resizable-panel id="right"></resizable-panel>
        </resizable-group>
      `)

      expect(detailsOf(events, CHANGE)).toEqual([])

      setDefaultElementBounds(new DOMRect(0, 0, 100, 50))

      expect(detailsOf(events, CHANGE)).toEqual([ { layout: { left: 50, right: 50 } } ])
    })

    describe("does not break the layout if its panel ids are in an unexpected order", () => {
      test("two panel horizontal group", async () => {
        setElementBoundsFunction(element => {
          switch (element.id) {
            case "group":
              return new DOMRect(0, 0, 100, 50)
            case "left":
              return new DOMRect(0, 0, 50, 50)
            case "right":
              return new DOMRect(50, 0, 50, 50)
            case "separator":
              return new DOMRect(50, 0, 0, 50)
          }
        })

        const events = record()
        await mount(`
          <resizable-group id="group" default-layout='{"right":40,"left":60}'>
            <resizable-panel id="left"></resizable-panel>
            <resizable-separator id="separator"></resizable-separator>
            <resizable-panel id="right"></resizable-panel>
          </resizable-group>
        `)

        expect(detailsOf(events, CHANGED)).toEqual([ { layout: { left: 60, right: 40 }, isUserInteraction: false } ])

        moveSeparator(10)

        const changed = detailsOf(events, CHANGED)
        expect(changed).toHaveLength(2)
        expect(changed.at(-1)).toEqual({ layout: { left: 70, right: 30 }, isUserInteraction: true })
      })

      test("three panel vertical group", async () => {
        setElementBoundsFunction(element => {
          switch (element.id) {
            case "group":
              return new DOMRect(0, 0, 50, 150)
            case "top":
              return new DOMRect(0, 0, 50, 50)
            case "top-separator":
              return new DOMRect(0, 50, 0, 50)
            case "middle":
              return new DOMRect(0, 50, 50, 50)
            case "bottom":
              return new DOMRect(0, 100, 50, 50)
            case "bottom-separator":
              return new DOMRect(0, 100, 0, 50)
          }
        })

        const events = record()
        await mount(`
          <resizable-group orientation="vertical" default-layout='{"bottom":50,"middle":30,"top":20}'>
            <resizable-panel id="top" default-size="30%"></resizable-panel>
            <resizable-separator id="top-separator"></resizable-separator>
            <resizable-panel id="middle"></resizable-panel>
            <resizable-separator id="bottom-separator"></resizable-separator>
            <resizable-panel id="bottom" default-size="30%"></resizable-panel>
          </resizable-group>
        `)

        expect(detailsOf(events, CHANGED)).toEqual([ { layout: { bottom: 50, middle: 30, top: 20 }, isUserInteraction: false } ])

        moveSeparator(15, "top-separator")

        const changed = detailsOf(events, CHANGED)
        expect(changed).toHaveLength(2)
        expect(changed.at(-1)).toEqual({ layout: { bottom: 50, middle: 20, top: 30 }, isUserInteraction: true })
      })
    })

    test("panels never show temporarily invalid sizes while mounting", async () => {
      setElementBoundsFunction(element => {
        return element.hasAttribute("data-panel") ? new DOMRect(0, 0, 50, 50) : new DOMRect(0, 0, 100, 50)
      })

      const events = record()

      // Before the group has mounted, the panels already take their share from
      // the default layout.
      document.body.innerHTML = `
        <resizable-group default-layout='{"foo":40,"bar":60}'>
          <resizable-panel id="foo" default-size="50%"></resizable-panel>
          <resizable-panel id="bar"></resizable-panel>
        </resizable-group>
      `
      expect(document.getElementById("foo").style.flexGrow).toBe("40")
      expect(document.getElementById("bar").style.flexGrow).toBe("60")

      await flush()

      expect(document.getElementById("foo").style.flexGrow).toBe("40")
      expect(document.getElementById("bar").style.flexGrow).toBe("60")
      expect(detailsOf(events, CHANGE)).toEqual([ { layout: { foo: 40, bar: 60 } } ])
    })
  })

  describe("imperative methods", () => {
    test("work with an empty group", async () => {
      const events = record()
      const group = await mount("<resizable-group></resizable-group>")

      expect(group.getLayout()).toEqual({})
      expect(detailsOf(events, CHANGE)).toEqual([])

      // This is meaningless but technically valid
      group.setLayout({})

      // This is still invalid
      expect(() => group.setLayout({ foo: 50, bar: 50 })).toThrow("Invalid 0 panel layout: 50%, 50%")
    })

    test("work within a hidden subtree", async () => {
      // A group size of 0 stands in for a hidden subtree.
      setElementBoundsFunction(() => new DOMRect(0, 0, 0, 0))

      const events = record()
      const group = await mount(`
        <resizable-group>
          <resizable-panel id="left" default-size="35%" max-size="45%">left</resizable-panel>
          <resizable-panel id="right">right</resizable-panel>
        </resizable-group>
      `)

      expect(detailsOf(events, CHANGE)).toEqual([])

      // Constraints cannot be validated while the group is hidden.
      expect(group.getLayout()).toEqual({})

      // Essentially a no-op too; the layout is worked out once the group shows.
      group.setLayout({ left: 45, right: 55 })

      setElementBoundsFunction(element => {
        return element.hasAttribute("data-panel") ? new DOMRect(0, 0, 50, 50) : new DOMRect(0, 0, 100, 50)
      })

      expect(group.getLayout()).toEqual({ left: 35, right: 65 })
      expect(detailsOf(events, CHANGE)).toContainEqual({ layout: { left: 35, right: 65 } })
    })

    // See github.com/bvaughn/react-resizable-panels/issues/576
    test("allow the layout to be read or written on mount", async () => {
      setElementBoundsFunction(element => {
        return element.hasAttribute("data-panel") ? new DOMRect(0, 0, 50, 50) : new DOMRect(0, 0, 100, 50)
      })

      let layoutOnMount
      let error
      document.addEventListener(CHANGED, event => {
        try {
          layoutOnMount ??= event.target.getLayout()
          event.target.setLayout({ left: 50, right: 50 })
        } catch (caught) {
          error = caught
        }
      }, { once: true })

      await mount(`
        <resizable-group>
          <resizable-panel id="left" default-size="25">Left</resizable-panel>
          <resizable-panel id="right">Right</resizable-panel>
        </resizable-group>
      `)

      expect(layoutOnMount).toEqual({ left: 25, right: 75 })
      expect(error).toBeUndefined()
    })
  })

  describe("layout-change and layout-changed events", () => {
    function setBounds() {
      setElementBoundsFunction(element => {
        if (element.hasAttribute("data-group")) return new DOMRect(0, 0, 100, 50)
        if (element.hasAttribute("data-panel")) return new DOMRect(0, 0, 50, 50)
      })
    }

    test("are not dispatched again when nothing changed", async () => {
      setBounds()

      const events = record()
      const group = await mount(`
        <resizable-group>
          <resizable-panel id="a"></resizable-panel>
          <resizable-panel id="b"></resizable-panel>
        </resizable-group>
      `)

      expect(detailsOf(events, CHANGE)).toEqual([ { layout: { a: 50, b: 50 } } ])
      expect(detailsOf(events, CHANGED)).toEqual([ { layout: { a: 50, b: 50 }, isUserInteraction: false } ])

      group.className = "something"
      await flush()

      expect(detailsOf(events, CHANGE)).toHaveLength(1)
      expect(detailsOf(events, CHANGED)).toHaveLength(1)
    })

    test("are dispatched with the default layout", async () => {
      setBounds()

      const events = record()
      await mount(`
        <resizable-group>
          <resizable-panel id="a" default-size="40px"></resizable-panel>
          <resizable-panel id="b"></resizable-panel>
        </resizable-group>
      `)

      expect(detailsOf(events, CHANGE)).toEqual([ { layout: { a: 40, b: 60 } } ])
      expect(detailsOf(events, CHANGED)).toEqual([ { layout: { a: 40, b: 60 }, isUserInteraction: false } ])

      document.querySelector("resizable-group").className = "something"
      document.getElementById("b").defaultSize = 60
      await flush()

      expect(detailsOf(events, CHANGE)).toHaveLength(1)
      expect(detailsOf(events, CHANGED)).toHaveLength(1)
    })

    test("are dispatched when panels change", async () => {
      setBounds()

      const events = record()
      const group = await mount(`
        <resizable-group>
          <resizable-panel id="a"></resizable-panel>
          <resizable-panel id="b"></resizable-panel>
        </resizable-group>
      `)

      expect(detailsOf(events, CHANGE)).toEqual([ { layout: { a: 50, b: 50 } } ])
      expect(detailsOf(events, CHANGED)).toEqual([ { layout: { a: 50, b: 50 }, isUserInteraction: false } ])

      group.insertAdjacentHTML("beforeend", `
        <resizable-panel id="c"></resizable-panel>
        <resizable-panel id="d"></resizable-panel>
      `)
      await flush()

      const quarters = { a: 25, b: 25, c: 25, d: 25 }
      expect(detailsOf(events, CHANGE)).toEqual([ { layout: { a: 50, b: 50 } }, { layout: quarters } ])
      expect(detailsOf(events, CHANGED)).toEqual([
        { layout: { a: 50, b: 50 }, isUserInteraction: false },
        { layout: quarters, isUserInteraction: false }
      ])
    })

    test("are dispatched once per layout change", async () => {
      setElementBoundsFunction(element => {
        switch (element.id) {
          case "a":
            return new DOMRect(0, 0, 50, 50)
          case "b":
            return new DOMRect(50, 0, 10, 50)
          case "c":
            return new DOMRect(60, 0, 50, 50)
        }
      })

      let events = record()
      await mount(`
        <resizable-group>
          <resizable-panel id="a" default-size="50px"></resizable-panel>
          <resizable-separator id="b"></resizable-separator>
          <resizable-panel id="c" default-size="50px"></resizable-panel>
        </resizable-group>
      `)

      expect(detailsOf(events, CHANGE)).toEqual([ { layout: { a: 50, c: 50 } } ])
      expect(detailsOf(events, CHANGED)).toEqual([ { layout: { a: 50, c: 50 }, isUserInteraction: false } ])

      events.stop()
      events = record()

      moveSeparator(25)

      expect(detailsOf(events, CHANGE)).toEqual([ { layout: { a: 75, c: 25 } } ])
      expect(detailsOf(events, CHANGED)).toEqual([ { layout: { a: 75, c: 25 }, isUserInteraction: true } ])

      events.stop()
      events = record()

      // Moves the pointer a bit, but not enough to change the layout.
      moveSeparator(0.0001)

      expect(detailsOf(events, CHANGE)).toEqual([])
      expect(detailsOf(events, CHANGED)).toEqual([])
    })

    test("are dispatched in response to the imperative methods", async () => {
      setBounds()

      const group = await mount(`
        <resizable-group>
          <resizable-panel id="a"></resizable-panel>
          <resizable-panel id="b"></resizable-panel>
        </resizable-group>
      `)
      const events = record()

      group.setLayout({ a: 25, b: 75 })

      expect(detailsOf(events, CHANGE)).toEqual([ { layout: { a: 25, b: 75 } } ])
      expect(detailsOf(events, CHANGED)).toEqual([ { layout: { a: 25, b: 75 }, isUserInteraction: false } ])
    })
  })

  describe("HTML attributes", () => {
    test("keeps an explicit id and marks itself with data-group", async () => {
      const group = await mount("<resizable-group id=\"group\"></resizable-group>")

      expect(group.id).toBe("group")
      expect(group.hasAttribute("data-group")).toBe(true)
    })

    test("assigns an id when none is given", async () => {
      const group = await mount("<resizable-group></resizable-group>")

      expect(group.id).toMatch(/^resizable-group-\d+$/)
    })

    test("leaves other attributes alone", async () => {
      const group = await mount("<resizable-group data-foo=\"abc\" data-bar=\"123\"></resizable-group>")

      expect(group.getAttribute("data-foo")).toBe("abc")
      expect(group.getAttribute("data-bar")).toBe("123")
    })

    test("problematic styles are suppressed", async () => {
      const group = await mount("<resizable-group style=\"display: block; flex-direction: column; flex-wrap: wrap\"></resizable-group>")

      const style = getComputedStyle(group)
      expect(style.display).toBe("flex")
      expect(style.flexDirection).toBe("row")
      expect(style.flexWrap).toBe("nowrap")
    })
  })

  // These run last: a failed mount leaves its registration behind.
  describe("invariants", () => {
    test("duplicate panel ids", async () => {
      // A separator may share an id with a panel.
      let errors = await captureMicrotaskErrors(() => mount(`
        <resizable-group>
          <resizable-panel id="foo"></resizable-panel>
          <resizable-separator id="foo"></resizable-separator>
          <resizable-panel id="bar"></resizable-panel>
        </resizable-group>
      `))
      expect(errors).toEqual([])

      errors = await captureMicrotaskErrors(() => mount(`
        <resizable-group>
          <resizable-panel id="foo"></resizable-panel>
          <resizable-panel id="foo"></resizable-panel>
        </resizable-group>
      `))
      expect(errors.map(error => error.message)).toEqual([ "Panel ids must be unique; id \"foo\" was used more than once" ])
    })

    test("duplicate separator ids", async () => {
      const errors = await captureMicrotaskErrors(() => mount(`
        <resizable-group>
          <resizable-panel id="left"></resizable-panel>
          <resizable-separator id="foo"></resizable-separator>
          <resizable-panel id="center"></resizable-panel>
          <resizable-separator id="foo"></resizable-separator>
          <resizable-panel id="right"></resizable-panel>
        </resizable-group>
      `))
      expect(errors.map(error => error.message)).toEqual([ "Separator ids must be unique; id \"foo\" was used more than once" ])
    })
  })
})
