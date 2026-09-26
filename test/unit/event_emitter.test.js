import { describe, expect, test, vi } from "vitest"
import EventEmitter from "src/helpers/event_emitter"

describe("EventEmitter", () => {
  test("calls listeners of the emitted type with the data", () => {
    const emitter = new EventEmitter()
    const change = vi.fn()
    const other = vi.fn()

    emitter.addListener("change", change)
    emitter.addListener("other", other)
    emitter.emit("change", { value: 1 })

    expect(change).toHaveBeenCalledWith({ value: 1 })
    expect(other).not.toHaveBeenCalled()
  })

  test("adds a listener only once", () => {
    const emitter = new EventEmitter()
    const listener = vi.fn()

    emitter.addListener("change", listener)
    emitter.addListener("change", listener)
    emitter.emit("change")

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test("returns a function that removes the listener", () => {
    const emitter = new EventEmitter()
    const listener = vi.fn()

    const remove = emitter.addListener("change", listener)
    remove()
    emitter.emit("change")

    expect(listener).not.toHaveBeenCalled()
  })

  test("removes one listener and keeps the others", () => {
    const emitter = new EventEmitter()
    const first = vi.fn()
    const second = vi.fn()

    emitter.addListener("change", first)
    emitter.addListener("change", second)
    emitter.removeListener("change", first)
    emitter.emit("change")

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  test("removes all listeners", () => {
    const emitter = new EventEmitter()
    const listener = vi.fn()

    emitter.addListener("change", listener)
    emitter.removeAllListeners()
    emitter.emit("change")

    expect(listener).not.toHaveBeenCalled()
  })

  test("ignores emits and removals for unknown types", () => {
    const emitter = new EventEmitter()

    expect(() => emitter.emit("nothing")).not.toThrow()
    expect(() => emitter.removeListener("nothing", vi.fn())).not.toThrow()
  })

  test("lets every listener run when one unsubscribes another mid-emit", () => {
    const emitter = new EventEmitter()
    const calls = []

    let removeSecond
    emitter.addListener("change", () => {
      calls.push("first")
      removeSecond()
    })
    removeSecond = emitter.addListener("change", () => calls.push("second"))

    emitter.emit("change")

    expect(calls).toEqual([ "first", "second" ])
  })

  test("runs every listener before rethrowing the first error", () => {
    const emitter = new EventEmitter()
    const last = vi.fn()

    emitter.addListener("change", () => {
      throw new Error("first")
    })
    emitter.addListener("change", () => {
      throw new Error("second")
    })
    emitter.addListener("change", last)

    expect(() => emitter.emit("change")).toThrow("first")
    expect(last).toHaveBeenCalledTimes(1)
  })

  test("throws straight away with a single listener", () => {
    const emitter = new EventEmitter()

    emitter.addListener("change", () => {
      throw new Error("only")
    })

    expect(() => emitter.emit("change")).toThrow("only")
  })
})
