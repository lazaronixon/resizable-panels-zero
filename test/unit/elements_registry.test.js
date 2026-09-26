import { describe, expect, test, vi } from "vitest"
import { flush, mount, setElementBoundsFunction } from "./test_helper"
import { defineElements } from "src/elements/index"

const TAGS = [ "resizable-group", "resizable-panel", "resizable-separator", "resizable-separator-overlay" ]

function setBounds() {
  setElementBoundsFunction(element => {
    return element.hasAttribute("data-panel") ? new DOMRect(0, 0, 50, 50) : new DOMRect(0, 0, 100, 50)
  })
}

describe("element registry", () => {
  test("importing the library defines every element", () => {
    TAGS.forEach(tag => expect(customElements.get(tag)).toBeDefined())
  })

  test("defineElements can be called again", () => {
    const before = TAGS.map(tag => customElements.get(tag))

    expect(() => defineElements()).not.toThrow()
    expect(TAGS.map(tag => customElements.get(tag))).toEqual(before)
  })

  test("injects the machinery stylesheet once, with the nonce", async () => {
    document.getElementById("resizable-panels-zero-style")?.remove()

    await mount(`
      <resizable-group nonce="abc123"><resizable-panel></resizable-panel></resizable-group>
      <resizable-group><resizable-panel></resizable-panel></resizable-group>
    `)

    const styles = document.querySelectorAll("#resizable-panels-zero-style")
    expect(styles).toHaveLength(1)
    expect(styles[0].getAttribute("nonce")).toBe("abc123")
    expect(document.head.firstElementChild).toBe(styles[0])
  })

  test("a group built with createElement mounts once it is connected", async () => {
    setBounds()

    const group = document.createElement("resizable-group")
    const left = document.createElement("resizable-panel")
    left.id = "left"
    const right = document.createElement("resizable-panel")
    right.id = "right"
    group.append(left, right)

    await flush()
    expect(group.getLayout()).toEqual({})

    document.body.append(group)
    await flush()

    expect(group.getLayout()).toEqual({ left: 50, right: 50 })
  })

  test("panels added to a connected group one at a time mount it once", async () => {
    setBounds()

    const group = await mount("<resizable-group></resizable-group>")
    const events = []
    group.addEventListener("resizable-group:layout-changed", event => events.push(event.detail.layout))

    for (const id of [ "a", "b", "c" ]) {
      const panel = document.createElement("resizable-panel")
      panel.id = id
      group.append(panel)
    }
    await flush()

    expect(events).toHaveLength(1)
    expect(Object.keys(events[0])).toEqual([ "a", "b", "c" ])
  })

  test("a panel of a nested group registers with its own group", async () => {
    setBounds()

    await mount(`
      <resizable-group id="outer">
        <resizable-panel id="outer-a">
          <resizable-group id="inner" orientation="vertical">
            <resizable-panel id="inner-a"></resizable-panel>
            <resizable-panel id="inner-b"></resizable-panel>
          </resizable-group>
        </resizable-panel>
        <resizable-panel id="outer-b"></resizable-panel>
      </resizable-group>
    `)

    expect(document.getElementById("outer").getLayout()).toEqual({ "outer-a": 50, "outer-b": 50 })
    expect(document.getElementById("inner").getLayout()).toEqual({ "inner-a": 50, "inner-b": 50 })
  })

  test("warns about a panel or separator outside a group", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    try {
      await mount(`
        <div>
          <resizable-panel></resizable-panel>
          <resizable-separator></resizable-separator>
        </div>
      `)

      expect(warn).toHaveBeenCalledWith("resizable-panels-zero: <resizable-panel> must be a direct child of <resizable-group>.")
      expect(warn).toHaveBeenCalledWith("resizable-panels-zero: <resizable-separator> must be a direct child of <resizable-group>.")
    } finally {
      warn.mockRestore()
    }
  })

  test("an overlay outside a group or separator is not treated as a template", async () => {
    await mount("<div><resizable-separator-overlay></resizable-separator-overlay></div>")

    expect(document.querySelector("resizable-separator-overlay").hasAttribute("data-separator-overlay-source")).toBe(false)
  })
})
