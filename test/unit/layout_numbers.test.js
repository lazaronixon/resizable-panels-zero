import {
  compareLayoutNumbers,
  formatLayoutNumber,
  isArrayEqual,
  layoutNumbersEqual,
  layoutsEqual,
  objectsEqual,
  panelConstraintsEqual
} from "src/layout/layout_numbers"
import { describe, expect, test } from "vitest"

describe("formatLayoutNumber", () => {
  test.each([
    [ 0, 0 ],
    [ 0.1, 0.1 ],
    [ 0.12, 0.12 ],
    [ 0.123, 0.123 ],
    [ 0.123, 0.123 ],
    [ 0.5551, 0.555 ],
    [ 0.5559, 0.556 ],
    [ -0.1, -0.1 ],
    [ -0.12, -0.12 ],
    [ -0.123, -0.123 ],
    [ -0.123, -0.123 ],
    [ -0.1234, -0.123 ],
    [ -0.5551, -0.555 ],
    [ -0.5559, -0.556 ]
  ])("format: %i -> %i", (input, expected) => {
    expect(formatLayoutNumber(input)).toBe(expected)
  })
})

describe("compareLayoutNumbers", () => {
  test.each([
    [ 0, 0, 0 ],
    [ 0, 1, -1 ],
    [ 0, 25, -1 ],
    [ 50, 100, -1 ],
    [ 0, -1, 1 ],
    [ 50, 25, 1 ],
    [ -50, -100, 1 ]
  ])("compare: %i, %i -> %i", (a, b, expected) => {
    expect(compareLayoutNumbers(a, b)).toBe(expected)
  })
})

describe("layoutNumbersEqual", () => {
  test.each([
    [ 0, 0, true ],
    [ -1, -1, true ],
    [ 1, 1, true ],
    [ 0, 1, false ],
    [ 0, -1, false ],
    [ 1, -1, false ],
    [ -1, 1, false ]
  ])("compare: %i, %i -> %o", (a, b, expected) => {
    expect(layoutNumbersEqual(a, b)).toBe(expected)
  })

  test("accepts a minimum delta", () => {
    expect(layoutNumbersEqual(100, 100.05, 0.1)).toBe(true)
    expect(layoutNumbersEqual(100, 100.2, 0.1)).toBe(false)
  })
})

describe("layoutsEqual", () => {
  const EMPTY = {}
  const A = { a: 25, b: 75 }
  const B = { a: 75, b: 25 }
  const C = { d: 25, e: 75 }

  test.each([
    [ EMPTY, EMPTY, true ],
    [ A, A, true ],
    [ B, B, true ],
    [ EMPTY, A, false ],
    [ A, EMPTY, false ],
    [ A, B, false ],
    [ B, A, false ],
    [ A, C, false ],
    [ C, A, false ]
  ])("layoutsEqual: %o, %o -> %o", (a, b, expected) => {
    expect(layoutsEqual(a, b)).toBe(expected)
  })
})

describe("isArrayEqual", () => {
  test("should work", () => {
    expect(isArrayEqual([ 1, 2 ], [ 1 ])).toBe(false)
    expect(isArrayEqual([ 1 ], [ 1, 2 ])).toBe(false)
    expect(isArrayEqual([ 1, 2, 3 ], [ 1, 2, 3 ])).toBe(true)
  })
})

describe("objectsEqual", () => {
  test.each([
    [ {}, {}, true ],
    [ { a: 25, b: 75 }, { a: 25, b: 75 }, true ],
    [ { a: 75, b: 25 }, { a: 75, b: 25 }, true ],
    [ {}, { a: 25, b: 75 }, false ],
    [ { a: 25, b: 75 }, {}, false ],
    [ { a: 25, b: 75 }, { a: 75, b: 25 }, false ],
    [ { a: 75, b: 25 }, { a: 25, b: 75 }, false ],
    [ { a: 25, b: 75 }, { a: 75 }, false ],
    [ { a: 75 }, { a: 25, b: 75 }, false ]
  ])("objectsEqual: %o, %o -> %o", (a, b, expected) => {
    expect(objectsEqual(a, b)).toBe(expected)
  })
})

describe("panelConstraintsEqual", () => {
  function createPanelConstraints(partial) {
    return {
      collapsedSize: 0,
      collapsible: false,
      defaultSize: undefined,
      disabled: undefined,
      maxSize: 100,
      minSize: 0,
      ...partial
    }
  }

  const a = () => createPanelConstraints({ panelId: "a" })
  const b = () => createPanelConstraints({ panelId: "b" })

  test.each([
    [ [], [], true ],
    [ [], [ a() ], false ],
    [ [ a() ], [], false ],
    [ [ a() ], [ a() ], true ],
    [ [ a(), b() ], [ a(), b() ], true ],
    [ [ a() ], [ a(), b() ], false ],
    [ [ a(), b() ], [ a() ], false ],
    [ [ a(), b() ], [ a(), createPanelConstraints({ panelId: "b", disabled: true }) ], false ],
    [ [ createPanelConstraints({ panelId: "a", collapsible: false }) ], [ createPanelConstraints({ panelId: "a", collapsible: true }) ], false ]
  ])("objectsEqual: %o, %o -> %o", (first, second, expected) => {
    expect(panelConstraintsEqual(first, second)).toBe(expected)
  })
})
