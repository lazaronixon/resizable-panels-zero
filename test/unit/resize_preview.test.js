import { afterEach, describe, expect, test } from "vitest"
import { flush, mockGroup, mount, pointerEvent, setElementBoundsFunction } from "./test_helper"
import { getInteractionState, updateInteractionState } from "src/engine/interaction_state"
import { getRegisteredGroup } from "src/engine/groups_state"
import { renderPreview } from "src/elements/resize_preview"

function previewsIn(root = document) {
  return Array.from(root.querySelectorAll("[data-resize-preview]"))
}

describe("separator previews", () => {
  afterEach(() => updateInteractionState({ state: "inactive", cursorFlags: 0 }))

  describe("preview lifecycle", () => {
    function setBounds() {
      setElementBoundsFunction(element => {
        switch (element.id) {
          case "group":
            return new DOMRect(0, 0, 210, 100)
          case "a":
            return new DOMRect(0, 0, 100, 100)
          case "separator":
            return new DOMRect(100, 0, 10, 100)
          case "b":
            return new DOMRect(110, 0, 100, 100)
        }
      })
    }

    function markup(label, disabled = false) {
      return `
        <resizable-group id="group" resize-preview-mode="separator" ${disabled ? "disabled" : ""}>
          <resizable-separator-overlay>default</resizable-separator-overlay>
          <resizable-panel id="a"></resizable-panel>
          <resizable-separator id="separator">${label ? `<resizable-separator-overlay>${label}</resizable-separator-overlay>` : ""}</resizable-separator>
          <resizable-panel id="b"></resizable-panel>
        </resizable-group>
      `
    }

    function press() {
      document.getElementById("separator").dispatchEvent(pointerEvent("pointerdown", { clientX: 105, clientY: 50 }))
    }

    function release() {
      document.dispatchEvent(pointerEvent("pointerup", { clientX: 105, clientY: 50, buttons: 0 }))
    }

    test("hides the overlay templates where they are written", async () => {
      setBounds()
      await mount(markup("old"))

      document.querySelectorAll("resizable-separator-overlay").forEach(overlay => {
        expect(overlay.hasAttribute("data-separator-overlay-source")).toBe(true)
        expect(getComputedStyle(overlay).display).toBe("none")
      })
    })

    test("updates and removes a custom preview without moving the pointer", async () => {
      setBounds()
      await mount(markup("old"))

      press()
      const group = getRegisteredGroup("group", true)
      expect(previewsIn()[0].textContent).toContain("old")

      document.querySelector("#separator > resizable-separator-overlay").textContent = "new"
      await flush()
      expect(previewsIn()[0].textContent).toContain("new")
      expect(getRegisteredGroup("group", true)).toBe(group)
      expect(getInteractionState().state).toBe("active")

      document.querySelector("#separator > resizable-separator-overlay").remove()
      await flush()
      expect(previewsIn()[0].textContent).toContain("default")

      release()
    })

    for (const replacement of [ "remount", "disable" ]) {
      test(`clears previews on group ${replacement}`, async () => {
        setBounds()
        await mount(markup("old"))

        press()
        expect(previewsIn()[0].textContent).toContain("old")

        if (replacement === "remount") {
          const template = document.createElement("template")
          template.innerHTML = markup("new")
          document.getElementById("group").replaceWith(template.content)
        } else {
          document.getElementById("group").disabled = true
        }
        await flush()

        expect(previewsIn()).toEqual([])
        expect(getInteractionState().state).toBe("inactive")

        release()
      })
    }
  })

  test("copies computed HTML and SVG styles inside an iframe", () => {
    const iframe = document.createElement("iframe")
    document.body.appendChild(iframe)

    const ownerDocument = iframe.contentDocument
    const ownerWindow = ownerDocument.defaultView
    ownerDocument.body.innerHTML = `
      <style>
        .parent .handle { background-color: rgb(255, 0, 0); }
        .parent .handle svg { fill: rgb(0, 0, 255); }
      </style>
      <div class="parent"><div class="handle"><svg /></div></div>
    `
    const element = ownerDocument.querySelector(".handle")
    const group = mockGroup(new DOMRect(0, 0, 200, 100))

    const previewElement = ownerDocument.createElement("div")
    ownerDocument.body.appendChild(previewElement)

    try {
      renderPreview(previewElement, {
        active: true,
        group,
        key: "separator",
        offset: 0,
        panelIndex: 0,
        rect: new DOMRect(100, 0, 10, 100),
        separator: { element, id: "separator" }
      }, null)

      // The copy is a plain element in place of the separator itself.
      const clone = ownerDocument.querySelector("[data-resize-preview] [data-separator-clone] > div")
      expect(ownerWindow.getComputedStyle(clone).backgroundColor).toBe("rgb(255, 0, 0)")
      expect(ownerWindow.getComputedStyle(clone.querySelector("svg")).fill).toBe("rgb(0, 0, 255)")
    } finally {
      iframe.remove()
    }
  })

  test("only shows this group's visible previews", async () => {
    await mount(`
      <resizable-group id="group" resize-preview-mode="separator">
        <resizable-panel id="a"></resizable-panel>
        <resizable-panel id="b"></resizable-panel>
      </resizable-group>
    `)
    const groupElement = document.getElementById("group")
    const group = getRegisteredGroup("group", true)

    const preview = {
      group,
      panelIndex: 0,
      key: "active",
      active: true,
      rect: new DOMRect(50, 0, 0, 100),
      offset: 0
    }
    const indirect = { ...preview, key: "indirect", active: false }
    const unrelated = { ...preview, group: { ...group, id: "other" } }

    let interaction = {
      state: "active",
      cursorFlags: 0,
      didPointerMove: false,
      hitRegions: [],
      initialLayoutMap: new Map(),
      previewLayoutMap: new Map(),
      pointerDownAtPoint: { x: 0, y: 0 },
      previews: [ preview, indirect, unrelated ]
    }

    updateInteractionState(interaction)
    expect(previewsIn(groupElement)).toHaveLength(1)

    const [ first ] = previewsIn(groupElement)

    interaction = { ...interaction, cursorFlags: 1, previews: [ preview, { ...indirect }, { ...unrelated, offset: 10 } ] }
    updateInteractionState(interaction)
    expect(previewsIn(groupElement)).toEqual([ first ])

    interaction = { ...interaction, previews: [ preview, { ...indirect, offset: 20 } ] }
    updateInteractionState(interaction)
    expect(previewsIn(groupElement)).toHaveLength(2)

    groupElement.resizePreviewMode = "panel"
    await flush()
    expect(previewsIn(groupElement)).toHaveLength(0)

    updateInteractionState({ ...interaction, cursorFlags: 0 })
    expect(previewsIn(groupElement)).toHaveLength(0)

    // Switching modes replaces the registration; stale snapshots must not return.
    groupElement.resizePreviewMode = "separator"
    await flush()
    expect(previewsIn(groupElement)).toHaveLength(0)

    updateInteractionState({ state: "inactive", cursorFlags: 0 })
    expect(previewsIn(groupElement)).toHaveLength(0)

    updateInteractionState({ state: "hover", cursorFlags: 0, hitRegions: [] })
    expect(previewsIn(groupElement)).toHaveLength(0)
  })

  for (const orientation of [ "horizontal", "vertical" ]) {
    for (const explicit of [ true, false ]) {
      test(`${orientation}, ${explicit ? "explicit" : "implicit"} separators preview all moved boundaries and commit on release`, async () => {
        const horizontal = orientation === "horizontal"
        const bounds = (start, size) => horizontal ? new DOMRect(start, 0, size, 100) : new DOMRect(0, start, 100, size)

        setElementBoundsFunction(element => {
          switch (element.id) {
            case "group":
              return bounds(0, explicit ? 320 : 300)
            case "a":
              return bounds(0, 100)
            case "ab":
              return bounds(100, 10)
            case "b":
              return bounds(explicit ? 110 : 100, 100)
            case "bc":
              return bounds(210, 10)
            case "c":
              return bounds(explicit ? 220 : 200, 100)
          }
        })

        const group = await mount(`
          <resizable-group id="group" orientation="${orientation}" resize-preview-mode="separator">
            <resizable-panel id="a"></resizable-panel>
            ${explicit ? "<resizable-separator id=\"ab\" style=\"background-color: red\"><span>handle</span></resizable-separator>" : ""}
            <resizable-panel id="b" min-size="80px"></resizable-panel>
            ${explicit ? "<resizable-separator id=\"bc\"></resizable-separator>" : ""}
            <resizable-panel id="c"></resizable-panel>
            ${explicit ? "" : `<resizable-separator-overlay style="background-color: blue; ${horizontal ? "width" : "height"}: 1rem"></resizable-separator-overlay>`}
          </resizable-group>
        `)

        const initial = group.getLayout()
        const coords = position => horizontal ? { clientX: position, clientY: 50 } : { clientX: 50, clientY: position }
        const start = explicit ? 105 : 100
        const target = explicit ? document.getElementById("ab") : group

        target.dispatchEvent(pointerEvent("pointerdown", coords(start)))
        expect(previewsIn()).toHaveLength(1)

        document.dispatchEvent(pointerEvent("pointermove", coords(start + 50)))

        const previews = previewsIn()
        expect(previews).toHaveLength(2)

        const axis = horizontal ? "X" : "Y"
        expect(parseFloat(previews[0].style.transform.split("(")[1])).toBeCloseTo(50)
        expect(previews[0].style.transform).toContain(`translate${axis}`)
        expect(parseFloat(previews[1].style.transform.split("(")[1])).toBeCloseTo(30)
        expect(group.getLayout()).toEqual(initial)

        if (explicit) {
          expect(previews[0].textContent).toBe("handle")
          expect(getComputedStyle(previews[0].firstElementChild).opacity).toBe("0.65")
          expect(document.querySelectorAll("#ab")).toHaveLength(1)
          expect([ "red", "rgb(255, 0, 0)" ]).toContain(previews[0].querySelector("[data-separator-clone] > div").style.backgroundColor)
          expect(previews[0].hasAttribute("inert") || previews[0].inert === true).toBe(true)
          expect(previews[0].getAttribute("aria-hidden")).toBe("true")
        } else {
          expect(previews[0].firstElementChild.getAttribute("data-separator-overlay")).toBe("active")
          expect(previews[1].firstElementChild.getAttribute("data-separator-overlay")).toBe("inactive")
          expect(previews[0].firstElementChild.style.backgroundColor).toBe("blue")
          expect(previews[0].firstElementChild.style[horizontal ? "width" : "height"]).toBe("1rem")
        }

        document.dispatchEvent(pointerEvent("pointermove", coords(start + 10)))
        expect(previewsIn()).toHaveLength(1)

        document.dispatchEvent(pointerEvent("pointerup", { ...coords(start + 50), buttons: 0 }))
        expect(previewsIn()).toHaveLength(0)
        expect(group.getLayout().a).toBeCloseTo(50)
      })
    }
  }

  test("per-separator overlays override the group default and update during a drag", async () => {
    setElementBoundsFunction(element => {
      switch (element.id) {
        case "group":
          return new DOMRect(0, 0, 320, 100)
        case "a":
          return new DOMRect(0, 0, 100, 100)
        case "ab":
          return new DOMRect(100, 0, 10, 100)
        case "b":
          return new DOMRect(110, 0, 100, 100)
        case "bc":
          return new DOMRect(210, 0, 10, 100)
        case "c":
          return new DOMRect(220, 0, 100, 100)
      }
    })

    await mount(`
      <resizable-group id="group" resize-preview-mode="separator">
        <resizable-separator-overlay class="default-overlay">default</resizable-separator-overlay>
        <resizable-panel id="a"></resizable-panel>
        <resizable-separator id="ab"><resizable-separator-overlay class="custom-overlay">custom</resizable-separator-overlay></resizable-separator>
        <resizable-panel id="b" min-size="80px"></resizable-panel>
        <resizable-separator id="bc" disabled></resizable-separator>
        <resizable-panel id="c"></resizable-panel>
      </resizable-group>
    `)

    const inPreviews = selector => document.querySelector(`[data-resize-preview] ${selector}`)
    expect(inPreviews(".default-overlay")).toBeNull()

    document.getElementById("ab").dispatchEvent(pointerEvent("pointerdown", { clientX: 105, clientY: 50 }))
    document.dispatchEvent(pointerEvent("pointermove", { clientX: 155, clientY: 50 }))

    expect(inPreviews(".custom-overlay").textContent).toBe("custom")
    expect(inPreviews(".default-overlay").textContent).toBe("default")
    expect(inPreviews(".custom-overlay").getAttribute("data-separator-overlay")).toBe("active")
    expect(inPreviews(".default-overlay").getAttribute("data-separator-overlay")).toBe("inactive")

    document.querySelector("#group > .default-overlay").textContent = "updated"
    await flush()
    expect(inPreviews(".default-overlay").textContent).toBe("updated")

    document.querySelector("#group > .default-overlay").remove()
    await flush()
    expect(inPreviews(".default-overlay")).toBeNull()
    expect(previewsIn()).toHaveLength(2)
    expect(document.querySelectorAll("[data-resize-preview] [data-separator=\"disabled\"]")).toHaveLength(1)

    document.dispatchEvent(pointerEvent("pointerup", { clientX: 155, clientY: 50, buttons: 0 }))
  })
})
