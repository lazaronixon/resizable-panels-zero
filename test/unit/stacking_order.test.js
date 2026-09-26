import { describe, expect, test } from "vitest"
import { compare } from "src/dom/stacking_order"
import { setElementStyle } from "./test_helper"

describe("compare", () => {
  function build() {
    const root = document.createElement("div")
    const a = document.createElement("div")
    const b = document.createElement("div")
    root.append(a, b)
    document.body.appendChild(root)
    return { root, a, b }
  }

  test("throws when comparing a node with itself", () => {
    const { a } = build()
    expect(() => compare(a, a)).toThrow("Cannot compare node with itself")
  })

  test("throws for elements without a common ancestor", () => {
    const a = document.createElement("div")
    const b = document.createElement("div")
    expect(() => compare(a, b)).toThrow("Stacking order can only be calculated for elements with a common ancestor")
  })

  test("later siblings paint in front of earlier ones", () => {
    const { a, b } = build()

    expect(compare(b, a)).toBe(1)
    expect(compare(a, b)).toBe(-1)
  })

  test("a higher z-index on a positioned element wins over document order", () => {
    const { a, b } = build()
    setElementStyle(a, { position: "relative", zIndex: "10" })
    setElementStyle(b, { position: "relative", zIndex: "1" })

    expect(compare(a, b)).toBe(1)
    expect(compare(b, a)).toBe(-1)
  })

  test("a z-index on a static element that is not a flex item is ignored", () => {
    const { a, b } = build()
    setElementStyle(a, { position: "static", zIndex: "10" })

    expect(compare(a, b)).toBe(-1)
  })

  test("a z-index on a flex item creates a stacking context", () => {
    const { root, a, b } = build()
    setElementStyle(root, { display: "flex" })
    setElementStyle(a, { position: "static", zIndex: "10" })

    expect(compare(a, b)).toBe(1)
  })

  test("compares the stacking contexts of nested descendants", () => {
    const { a, b } = build()
    const inner = document.createElement("span")
    a.appendChild(inner)
    setElementStyle(a, { position: "fixed", zIndex: "5" })

    expect(compare(inner, b)).toBe(1)
  })
})
