import { describe, expect, test } from "vitest"
import { validatePanelSize } from "src/layout/validate_panel_size"

function constraints(partial = {}) {
  return {
    collapsedSize: 0,
    collapsible: false,
    defaultSize: undefined,
    disabled: undefined,
    maxSize: 100,
    minSize: 0,
    panelId: "a",
    ...partial
  }
}

function validate(size, prevSize, partial, overrideDisabledPanels) {
  return validatePanelSize({ overrideDisabledPanels, panelConstraints: constraints(partial), prevSize, size })
}

describe("validatePanelSize", () => {
  test("accepts a size within the constraints", () => {
    expect(validate(40, 50, { minSize: 10, maxSize: 90 })).toBe(40)
  })

  test("clamps to the minimum and maximum", () => {
    expect(validate(5, 50, { minSize: 10 })).toBe(10)
    expect(validate(95, 50, { maxSize: 90 })).toBe(90)
  })

  test("rounds to three decimals", () => {
    expect(validate(33.33333, 50)).toBe(33.333)
  })

  test("keeps a disabled panel at its previous size", () => {
    expect(validate(20, 50, { disabled: true })).toBe(50)
  })

  test("resizes a disabled panel when told to override", () => {
    expect(validate(20, 50, { disabled: true }, true)).toBe(20)
  })

  describe("collapsible panels", () => {
    const collapsible = { collapsible: true, collapsedSize: 5, minSize: 25 }

    test("snaps back to the minimum above the halfway point", () => {
      expect(validate(16, 25, collapsible)).toBe(25)
    })

    test("collapses below the halfway point", () => {
      expect(validate(14, 25, collapsible)).toBe(5)
    })

    test("collapses at or below the collapsed size", () => {
      expect(validate(5, 25, collapsible)).toBe(5)
      expect(validate(0, 25, collapsible)).toBe(5)
    })

    test("measures the threshold from the collapsed side when already collapsed", () => {
      expect(validate(16, 5, collapsible)).toBe(25)
      expect(validate(14, 5, collapsible)).toBe(5)
    })

    describe("with a collapsedThreshold", () => {
      const withThreshold = { ...collapsible, collapsedThreshold: 5 }

      test("collapses an open panel only past the threshold below its minimum", () => {
        expect(validate(21, 25, withThreshold)).toBe(25)
        expect(validate(20, 25, withThreshold)).toBe(25)
        expect(validate(19, 25, withThreshold)).toBe(5)
      })

      test("expands a collapsed panel only past the threshold above its collapsed size", () => {
        expect(validate(9, 5, withThreshold)).toBe(5)
        expect(validate(10, 5, withThreshold)).toBe(5)
        expect(validate(11, 5, withThreshold)).toBe(25)
      })

      test("a zero threshold snaps on any move", () => {
        const zero = { ...collapsible, collapsedThreshold: 0 }
        expect(validate(24, 25, zero)).toBe(5)
        expect(validate(6, 5, zero)).toBe(25)
      })
    })
  })
})
