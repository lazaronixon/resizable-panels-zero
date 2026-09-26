import { describe, expect, test } from "vitest"
import { preserveFixedPanelSizes } from "src/layout/preserve_fixed_panel_sizes"

function group(behaviors) {
  return {
    panels: Object.entries(behaviors).map(([ id, groupResizeBehavior ]) => ({
      id,
      panelConstraints: { groupResizeBehavior }
    }))
  }
}

describe("preserveFixedPanelSizes", () => {
  test("returns the layout as it is when the group size did not change", () => {
    const prevLayout = { a: 25, b: 75 }
    expect(
      preserveFixedPanelSizes({ group: group({ a: "preserve-pixel-size", b: undefined }), nextGroupSize: 800, prevGroupSize: 800, prevLayout })
    ).toBe(prevLayout)
  })

  test("returns the layout as it is when either size is not positive", () => {
    const prevLayout = { a: 25, b: 75 }
    const fixedGroup = group({ a: "preserve-pixel-size", b: undefined })

    expect(preserveFixedPanelSizes({ group: fixedGroup, nextGroupSize: 800, prevGroupSize: 0, prevLayout })).toBe(prevLayout)
    expect(preserveFixedPanelSizes({ group: fixedGroup, nextGroupSize: 0, prevGroupSize: 800, prevLayout })).toBe(prevLayout)
  })

  test("returns the layout as it is when no panel preserves its pixel size", () => {
    const prevLayout = { a: 25, b: 75 }
    expect(
      preserveFixedPanelSizes({ group: group({ a: "preserve-relative-size", b: undefined }), nextGroupSize: 400, prevGroupSize: 800, prevLayout })
    ).toBe(prevLayout)
  })

  test("returns the layout as it is when every panel preserves its pixel size", () => {
    const prevLayout = { a: 25, b: 75 }
    expect(
      preserveFixedPanelSizes({ group: group({ a: "preserve-pixel-size", b: "preserve-pixel-size" }), nextGroupSize: 400, prevGroupSize: 800, prevLayout })
    ).toBe(prevLayout)
  })

  test("keeps a fixed panel's pixels and gives the rest to the flexible panel", () => {
    // 200px of 800px is 25%; the same 200px of 400px is 50%.
    expect(
      preserveFixedPanelSizes({ group: group({ a: "preserve-pixel-size", b: undefined }), nextGroupSize: 400, prevGroupSize: 800, prevLayout: { a: 25, b: 75 } })
    ).toEqual({ a: 50, b: 50 })
  })

  test("shares the remainder between flexible panels in their previous proportions", () => {
    // 100px of 1000px is 10%; of 500px it is 20%, leaving 80% split 1:3.
    expect(
      preserveFixedPanelSizes({
        group: group({ a: "preserve-pixel-size", b: "preserve-relative-size", c: undefined }),
        nextGroupSize: 500,
        prevGroupSize: 1000,
        prevLayout: { a: 10, b: 22.5, c: 67.5 }
      })
    ).toEqual({ a: 20, b: 20, c: 60 })
  })

  test("splits the remainder evenly when the flexible panels had no size", () => {
    expect(
      preserveFixedPanelSizes({
        group: group({ a: "preserve-pixel-size", b: undefined, c: undefined }),
        nextGroupSize: 200,
        prevGroupSize: 100,
        prevLayout: { a: 100, b: 0, c: 0 }
      })
    ).toEqual({ a: 50, b: 25, c: 25 })
  })

  test("rounds to three decimals", () => {
    expect(
      preserveFixedPanelSizes({ group: group({ a: "preserve-pixel-size", b: undefined }), nextGroupSize: 300, prevGroupSize: 100, prevLayout: { a: 50, b: 50 } })
    ).toEqual({ a: 16.667, b: 83.333 })
  })
})
