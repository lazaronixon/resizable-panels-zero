import { describe, expect, test, vi } from "vitest"
import { flush, mount, moveSeparator, setDefaultElementBounds, setElementBoundsFunction } from "./test_helper"

// The React library's useDefaultLayout hook, done as attributes on the group:
// `autosave` names the saved layout, `storage` says where it goes, and
// `autosave-user-only` keeps anything but pointer and keyboard changes out.

function mockStorage(saved = {}) {
  return {
    getItem: vi.fn(key => saved[key] ?? null),
    setItem: vi.fn()
  }
}

// The storage has to be in place before the group mounts, which happens in a
// microtask after the markup is inserted.
async function mountWithStorage(html, storage) {
  document.body.innerHTML = html
  const group = document.querySelector("resizable-group")
  group.storage = storage
  await flush()
  return group
}

describe("autosave", () => {
  test("reads from and writes to the given storage", async () => {
    setDefaultElementBounds(new DOMRect(0, 0, 100, 50))
    const storage = mockStorage()

    const group = await mountWithStorage(`
      <resizable-group autosave="test-group-id">
        <resizable-panel id="bar"></resizable-panel>
        <resizable-panel id="baz"></resizable-panel>
      </resizable-group>
    `, storage)

    expect(storage.getItem).toHaveBeenCalledWith("resizable-panels-zero:test-group-id:bar:baz")

    // The layout the group mounts with is saved too.
    expect(storage.setItem).toHaveBeenCalledTimes(1)
    expect(storage.setItem).toHaveBeenLastCalledWith("resizable-panels-zero:test-group-id:bar:baz", JSON.stringify({ bar: 50, baz: 50 }))

    group.setLayout({ bar: 35, baz: 65 })

    expect(storage.setItem).toHaveBeenCalledTimes(2)
    expect(storage.setItem).toHaveBeenLastCalledWith("resizable-panels-zero:test-group-id:bar:baz", JSON.stringify({ bar: 35, baz: 65 }))
  })

  test("restores a saved layout", async () => {
    setDefaultElementBounds(new DOMRect(0, 0, 100, 50))
    const storage = mockStorage({ "resizable-panels-zero:test-group-id:bar:baz": JSON.stringify({ bar: 35, baz: 65 }) })

    const group = await mountWithStorage(`
      <resizable-group autosave="test-group-id">
        <resizable-panel id="bar"></resizable-panel>
        <resizable-panel id="baz"></resizable-panel>
      </resizable-group>
    `, storage)

    expect(group.getLayout()).toEqual({ bar: 35, baz: 65 })
  })

  test("prefers a saved layout over default-layout", async () => {
    setDefaultElementBounds(new DOMRect(0, 0, 100, 50))
    const storage = mockStorage({ "resizable-panels-zero:test-group-id:bar:baz": JSON.stringify({ bar: 35, baz: 65 }) })

    const group = await mountWithStorage(`
      <resizable-group autosave="test-group-id" default-layout='{"bar":20,"baz":80}'>
        <resizable-panel id="bar"></resizable-panel>
        <resizable-panel id="baz"></resizable-panel>
      </resizable-group>
    `, storage)

    expect(group.getLayout()).toEqual({ bar: 35, baz: 65 })
  })

  test("ignores a saved value that is not a layout", async () => {
    setDefaultElementBounds(new DOMRect(0, 0, 100, 50))
    const storage = mockStorage({
      "resizable-panels-zero:test-group-id:bar:baz": JSON.stringify({ "bar,baz": { expandToSizes: {}, layout: [ 30, 70 ] } })
    })

    const group = await mountWithStorage(`
      <resizable-group autosave="test-group-id">
        <resizable-panel id="bar"></resizable-panel>
        <resizable-panel id="baz"></resizable-panel>
      </resizable-group>
    `, storage)

    expect(group.getLayout()).toEqual({ bar: 50, baz: 50 })
  })

  test("saves separate layouts per set of panels", async () => {
    setDefaultElementBounds(new DOMRect(0, 0, 100, 50))
    const storage = mockStorage()

    const group = await mountWithStorage(`
      <resizable-group autosave="test-group-id">
        <resizable-panel id="foo"></resizable-panel>
        <resizable-panel id="bar"></resizable-panel>
      </resizable-group>
    `, storage)

    expect(storage.getItem).toHaveBeenCalledWith("resizable-panels-zero:test-group-id:foo:bar")

    group.setLayout({ foo: 35, bar: 65 })
    expect(storage.setItem).toHaveBeenLastCalledWith("resizable-panels-zero:test-group-id:foo:bar", JSON.stringify({ foo: 35, bar: 65 }))

    group.insertAdjacentHTML("beforeend", "<resizable-panel id=\"baz\"></resizable-panel>")
    await flush()

    expect(storage.getItem).toHaveBeenCalledWith("resizable-panels-zero:test-group-id:foo:bar:baz")

    group.setLayout({ foo: 25, bar: 55, baz: 20 })
    expect(storage.setItem).toHaveBeenLastCalledWith("resizable-panels-zero:test-group-id:foo:bar:baz", JSON.stringify({ foo: 25, bar: 55, baz: 20 }))
  })

  // See github.com/bvaughn/react-resizable-panels/pull/716
  test("autosave-user-only ignores changes the user did not make", async () => {
    setElementBoundsFunction(element => {
      switch (element.id) {
        case "left":
          return new DOMRect(0, 0, 50, 50)
        case "separator":
          return new DOMRect(50, 0, 0, 50)
        case "right":
          return new DOMRect(50, 0, 50, 50)
      }
    })
    const storage = mockStorage()

    const group = await mountWithStorage(`
      <resizable-group autosave="test-group-id" autosave-user-only>
        <resizable-panel id="left"></resizable-panel>
        <resizable-separator id="separator"></resizable-separator>
        <resizable-panel id="right"></resizable-panel>
      </resizable-group>
    `, storage)

    group.setLayout({ left: 35, right: 65 })
    expect(storage.setItem).not.toHaveBeenCalled()

    moveSeparator(10)
    expect(storage.setItem).toHaveBeenCalledTimes(1)
    expect(storage.setItem).toHaveBeenLastCalledWith("resizable-panels-zero:test-group-id:left:right", JSON.stringify({ left: 45, right: 55 }))
  })

  test("logs a storage that fails to save instead of throwing", async () => {
    setDefaultElementBounds(new DOMRect(0, 0, 100, 50))
    const error = new Error("QuotaExceededError")
    const storage = { getItem: () => null, setItem: () => { throw error } }
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    try {
      const group = await mountWithStorage(`
        <resizable-group autosave="test-group-id">
          <resizable-panel id="bar"></resizable-panel>
          <resizable-panel id="baz"></resizable-panel>
        </resizable-group>
      `, storage)

      expect(() => group.setLayout({ bar: 35, baz: 65 })).not.toThrow()
      expect(consoleError).toHaveBeenCalledWith(error)
    } finally {
      consoleError.mockRestore()
    }
  })

  // See github.com/bvaughn/react-resizable-panels/pull/540
  describe("ignores temporarily invalid default layouts", () => {
    test("on mount (ids mismatch)", async () => {
      setDefaultElementBounds(new DOMRect(0, 0, 100, 50))

      const group = await mount(`
        <resizable-group default-layout='{"left":20,"right":50}'>
          <resizable-panel id="before"></resizable-panel>
          <resizable-panel id="after"></resizable-panel>
        </resizable-group>
      `)

      expect(group.getLayout()).toEqual({ after: 50, before: 50 })
    })

    test("on mount (number of panels mismatch)", async () => {
      setDefaultElementBounds(new DOMRect(0, 0, 100, 50))

      const group = await mount(`
        <resizable-group default-layout='{"left":20,"middle":30,"right":50}'>
          <resizable-panel id="left"></resizable-panel>
          <resizable-panel id="right"></resizable-panel>
        </resizable-group>
      `)

      expect(group.getLayout()).toEqual({ left: 50, right: 50 })
    })

    test("after an update (number of panels mismatch)", async () => {
      setDefaultElementBounds(new DOMRect(0, 0, 100, 50))

      const group = await mount(`
        <resizable-group default-layout='{"left":20,"middle":30,"right":50}'>
          <resizable-panel id="left"></resizable-panel>
          <resizable-panel id="middle"></resizable-panel>
          <resizable-panel id="right"></resizable-panel>
        </resizable-group>
      `)

      expect(group.getLayout()).toEqual({ left: 20, middle: 30, right: 50 })

      document.getElementById("middle").remove()
      await flush()

      expect(group.getLayout()).toEqual({ left: 50, right: 50 })
    })
  })

  test("ignores a default layout whose panel ids do not match", async () => {
    setDefaultElementBounds(new DOMRect(0, 0, 100, 50))

    const group = await mount(`
      <resizable-group default-layout='{"foo":40,"bar":60}'>
        <resizable-panel id="bar" default-size="30%"></resizable-panel>
        <resizable-panel id="baz"></resizable-panel>
      </resizable-group>
    `)

    expect(group.getLayout()).toEqual({ bar: 30, baz: 70 })
  })

  // See https://github.com/bvaughn/react-resizable-panels/issues/656
  test("supports panel ids in any order", async () => {
    setDefaultElementBounds(new DOMRect(0, 0, 100, 50))

    const group = await mount(`
      <resizable-group default-layout='{"bottom":50,"middle":30,"top":20}'>
        <resizable-panel id="top" default-size="30%"></resizable-panel>
        <resizable-panel id="middle"></resizable-panel>
        <resizable-panel id="bottom" default-size="30%"></resizable-panel>
      </resizable-group>
    `)

    expect(group.getLayout()).toEqual({ bottom: 50, middle: 30, top: 20 })
  })
})
