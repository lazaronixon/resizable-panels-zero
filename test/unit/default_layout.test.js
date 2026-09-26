import { calculateDefaultLayout, getDefaultLayout, validateLayoutKeys } from "src/layout/default_layout"
import { describe, expect, test } from "vitest"

function c(partial) {
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

function group(panelIds, { defaultLayout, layouts = {} } = {}) {
  return {
    panels: panelIds.map(id => ({ id })),
    mutableState: { defaultLayout, layouts }
  }
}

describe("calculateDefaultLayout", () => {
  test("inferred", () => {
    expect(calculateDefaultLayout([ c({ panelId: "a" }), c({ panelId: "b" }), c({ panelId: "c" }) ])).toEqual({ a: 33.333, b: 33.333, c: 33.333 })
  })

  test("explicit", () => {
    expect(
      calculateDefaultLayout([ c({ panelId: "a", defaultSize: 25 }), c({ panelId: "b", defaultSize: 50 }), c({ panelId: "c", defaultSize: 25 }) ])
    ).toEqual({ a: 25, b: 50, c: 25 })
  })

  test("mix of explicit and inferred", () => {
    expect(
      calculateDefaultLayout([ c({ panelId: "a", defaultSize: 25 }), c({ panelId: "b" }), c({ panelId: "c" }) ])
    ).toEqual({ a: 25, b: 37.5, c: 37.5 })

    expect(
      calculateDefaultLayout([ c({ panelId: "a", defaultSize: 20 }), c({ panelId: "b", defaultSize: 50 }), c({ panelId: "c" }) ])
    ).toEqual({ a: 20, b: 50, c: 30 })
  })

  test("keeps panel order in the returned keys", () => {
    const layout = calculateDefaultLayout([ c({ panelId: "b" }), c({ panelId: "a", defaultSize: 40 }) ])
    expect(Object.keys(layout)).toEqual([ "b", "a" ])
  })
})

describe("validateLayoutKeys", () => {
  test("matches when the layout names exactly the panels", () => {
    expect(validateLayoutKeys([ { id: "a" }, { id: "b" } ], { b: 50, a: 50 })).toBe(true)
  })

  test("rejects a layout with a different number of keys", () => {
    expect(validateLayoutKeys([ { id: "a" }, { id: "b" } ], { a: 100 })).toBe(false)
    expect(validateLayoutKeys([ { id: "a" } ], { a: 50, b: 50 })).toBe(false)
  })

  test("rejects a layout naming other panels", () => {
    expect(validateLayoutKeys([ { id: "a" }, { id: "b" } ], { a: 50, c: 50 })).toBe(false)
  })
})

describe("getDefaultLayout", () => {
  const panelConstraints = [ c({ panelId: "a", defaultSize: 20 }), c({ panelId: "b" }) ]

  test("prefers the layout remembered for this set of panels", () => {
    const remembered = { a: 70, b: 30 }
    expect(
      getDefaultLayout({ group: group([ "a", "b" ], { defaultLayout: { a: 10, b: 90 }, layouts: { "a,b": remembered } }), panelConstraints })
    ).toBe(remembered)
  })

  test("falls back to the default layout when it names the panels", () => {
    const defaultLayout = { a: 10, b: 90 }
    expect(getDefaultLayout({ group: group([ "a", "b" ], { defaultLayout }), panelConstraints })).toBe(defaultLayout)
  })

  test("ignores a default layout for other panels", () => {
    expect(
      getDefaultLayout({ group: group([ "a", "b" ], { defaultLayout: { a: 10, c: 90 } }), panelConstraints })
    ).toEqual({ a: 20, b: 80 })
  })

  test("calculates a layout from the panel constraints otherwise", () => {
    expect(getDefaultLayout({ group: group([ "a", "b" ]), panelConstraints })).toEqual({ a: 20, b: 80 })
  })
})
