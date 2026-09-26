import { describe, expect, test } from "vitest"
import { validateGroupLayout } from "src/layout/validate_group_layout"

function c(partials) {
  return partials.map((current, index) => ({
    collapsedSize: 0,
    collapsible: false,
    defaultSize: undefined,
    disabled: undefined,
    maxSize: 100,
    minSize: 0,
    ...current,
    panelId: "" + index
  }))
}

function l(numbers) {
  const layout = {}
  numbers.forEach((current, index) => {
    layout[index] = current
  })
  return layout
}

describe("validateGroupLayout", () => {
  test("should accept requested layout if there are no constraints provided", () => {
    expect(validateGroupLayout({ layout: l([ 10, 60, 30 ]), panelConstraints: c([ {}, {}, {} ]) })).toEqual(l([ 10, 60, 30 ]))
  })

  test("should normalize layouts that do not total 100%", () => {
    expect(validateGroupLayout({ layout: l([ 10, 20, 20 ]), panelConstraints: c([ {}, {}, {} ]) })).toEqual(l([ 20, 40, 40 ]))
    expect(validateGroupLayout({ layout: l([ 50, 100, 50 ]), panelConstraints: c([ {}, {}, {} ]) })).toEqual(l([ 25, 50, 25 ]))
  })

  test("should reject layouts that do not match the number of panels", () => {
    expect(() => validateGroupLayout({ layout: l([ 10, 20, 30 ]), panelConstraints: c([ {}, {} ]) })).toThrow("Invalid 2 panel layout")
    expect(() => validateGroupLayout({ layout: l([ 50, 50 ]), panelConstraints: c([ {}, {}, {} ]) })).toThrow("Invalid 3 panel layout")
  })

  describe("minimum size constraints", () => {
    test("should adjust the layout to account for minimum percentage sizes", () => {
      expect(validateGroupLayout({ layout: l([ 25, 75 ]), panelConstraints: c([ { minSize: 35 }, {} ]) })).toEqual(l([ 35, 65 ]))
    })

    test("should account for multiple panels with minimum size constraints", () => {
      expect(
        validateGroupLayout({ layout: l([ 20, 60, 20 ]), panelConstraints: c([ { minSize: 25 }, {}, { minSize: 25 } ]) })
      ).toEqual(l([ 25, 50, 25 ]))
    })
  })

  describe("maximum size constraints", () => {
    test("should adjust the layout to account for maximum percentage sizes", () => {
      expect(validateGroupLayout({ layout: l([ 25, 75 ]), panelConstraints: c([ {}, { maxSize: 65 } ]) })).toEqual(l([ 35, 65 ]))
    })

    test("should account for multiple panels with maximum size constraints", () => {
      expect(
        validateGroupLayout({ layout: l([ 20, 60, 20 ]), panelConstraints: c([ { maxSize: 15 }, { maxSize: 50 }, {} ]) })
      ).toEqual(l([ 15, 50, 35 ]))
    })
  })

  describe("collapsible panels", () => {
    test("should not collapse a panel that's at or above the minimum size", () => {
      expect(
        validateGroupLayout({ layout: l([ 25, 75 ]), panelConstraints: c([ { collapsible: true, minSize: 25 }, {} ]) })
      ).toEqual(l([ 25, 75 ]))
    })

    test("should collapse a panel once it drops below the halfway point between collapsed and minimum percentage sizes", () => {
      const panelConstraints = c([ { collapsible: true, collapsedSize: 10, minSize: 20 }, {} ])

      expect(validateGroupLayout({ layout: l([ 15, 85 ]), panelConstraints })).toEqual(l([ 20, 80 ]))
      expect(validateGroupLayout({ layout: l([ 14, 86 ]), panelConstraints })).toEqual(l([ 10, 90 ]))
    })
  })
})
