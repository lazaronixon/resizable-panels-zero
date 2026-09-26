import { describe, expect, test } from "vitest"
import { adjustLayoutByDelta } from "src/layout/adjust_layout_by_delta"

// Ported from react-resizable-panels. The upstream cases spell out the full
// argument object; here `adjust` fills in what they always repeat — the
// previous layout equal to the initial one, the first two pivots, and the
// imperative trigger — unless a case overrides it.

function c(partials) {
  return partials.map((current, index) => ({
    collapsedSize: 0,
    collapsible: false,
    defaultSize: undefined,
    disabled: current.disabled,
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

// The upstream wrapper: pivots and trigger default, everything else explicit.
function run({ delta, initialLayout, panelConstraints, pivotIndices = [ 0, 1 ], prevLayout, trigger = "imperative-api" }) {
  return adjustLayoutByDelta({ delta, initialLayout, panelConstraints, pivotIndices, prevLayout, trigger })
}

function adjust(delta, initial, constraints, { pivotIndices, prevLayout = initial, trigger } = {}) {
  return run({ delta, initialLayout: l(initial), panelConstraints: c(constraints), pivotIndices, prevLayout: l(prevLayout), trigger })
}

const COLLAPSIBLE_5_25 = { collapsedSize: 5, collapsible: true, minSize: 25 }
const COLLAPSIBLE_5_20 = { collapsedSize: 5, collapsible: true, minSize: 20 }
const COLLAPSIBLE_5_15 = { collapsedSize: 5, collapsible: true, minSize: 15 }
const COLLAPSIBLE_5_10 = { collapsedSize: 5, collapsible: true, minSize: 10 }
const COLLAPSIBLE_10_25 = { collapsedSize: 10, collapsible: true, minSize: 25 }

describe("adjustLayoutByDelta", () => {
  describe("collapsedThreshold", () => {
    test.each([ 0, 1 ])("panel at index %s", index => {
      const constraints = c([ {}, {} ])
      constraints[index] = {
        ...constraints[index],
        collapsedSize: 5,
        collapsedThreshold: 5,
        collapsible: true,
        minSize: 25
      }

      function resize(size, delta, trigger = "mouse-or-touch") {
        const sizes = index === 0 ? [ size, 100 - size ] : [ 100 - size, size ]

        return Object.values(
          adjustLayoutByDelta({
            delta: index === 0 ? delta : -delta,
            initialLayout: l(sizes),
            panelConstraints: constraints,
            pivotIndices: [ 0, 1 ],
            prevLayout: l(sizes),
            trigger
          })
        )[index]
      }

      expect(resize(25, -4)).toBe(25)
      expect(resize(25, -5)).toBe(25)
      expect(resize(25, -6)).toBe(5)

      expect(resize(5, 4)).toBe(5)
      expect(resize(5, 5)).toBe(5)
      expect(resize(5, 6)).toBe(25)

      expect(resize(25, -1, "keyboard")).toBe(5)
      expect(resize(5, 1, "keyboard")).toBe(25)

      for (const threshold of [ 20, 30 ]) {
        constraints[index].collapsedThreshold = threshold

        expect(resize(25, -1, "keyboard")).toBe(5)
        expect(resize(5, 1, "keyboard")).toBe(25)
        expect(resize(25, -19)).toBe(25)
        expect(resize(25, -20)).toBe(5)
        expect(resize(25, -21)).toBe(5)
      }

      constraints[index].collapsedThreshold = 0

      expect(resize(25, -1)).toBe(5)
      expect(resize(5, 1)).toBe(25)
    })
  })

  test("[1++,2]", () => {
    expect(adjust(1, [ 50, 50 ], [ {}, {} ])).toEqual(l([ 51, 49 ]))
  })

  test("[1++,2]", () => {
    expect(adjust(25, [ 50, 50 ], [ {}, {} ])).toEqual(l([ 75, 25 ]))
    expect(adjust(50, [ 50, 50 ], [ {}, {} ])).toEqual(l([ 100, 0 ]))
  })

  test("[1++,2]", () => {
    expect(adjust(50, [ 50, 50 ], [ { minSize: 20, maxSize: 60 }, { minSize: 10, maxSize: 90 } ])).toEqual(l([ 60, 40 ]))
  })

  test("[1++,2]", () => {
    expect(adjust(25, [ 50, 50 ], [ {}, COLLAPSIBLE_5_25 ])).toEqual(l([ 75, 25 ]))
  })

  test("[1++,2]", () => {
    expect(adjust(40, [ 50, 50 ], [ {}, COLLAPSIBLE_5_25 ])).toEqual(l([ 95, 5 ]))
  })

  // Edge case
  // Expanding from a collapsed state to less than the min size via imperative API should do nothing
  test("[1++,2]", () => {
    expect(adjust(5, [ 10, 90 ], [ COLLAPSIBLE_10_25, {} ])).toEqual(l([ 10, 90 ]))
  })

  // Edge case
  // Keyboard interactions should always expand a collapsed panel
  test("[1++,2]", () => {
    expect(adjust(5, [ 10, 90 ], [ COLLAPSIBLE_10_25, {} ], { trigger: "keyboard" })).toEqual(l([ 25, 75 ]))
  })

  // Edge case
  // Keyboard interactions should always collapse a collapsible panel once it's at the minimum size
  test("[1++,2]", () => {
    expect(adjust(5, [ 75, 25 ], [ {}, { collapsible: true, minSize: 25 } ], { trigger: "keyboard" })).toEqual(l([ 100, 0 ]))
  })

  // Edge case
  // Expanding from a collapsed state to less than the min size via imperative API should do nothing
  test("[1++,2]", () => {
    expect(
      adjust(1, [ 4, 96 ], [ { collapsedSize: 4, collapsible: true, defaultSize: 15, maxSize: 15, minSize: 6 }, { minSize: 5 } ])
    ).toEqual(l([ 4, 96 ]))
  })

  // Edge case
  // Expanding from a collapsed state to less than the min size via keyboard should snap to min size
  test("[1++,2]", () => {
    expect(
      adjust(1, [ 4, 96 ], [ { collapsedSize: 4, collapsible: true, defaultSize: 15, maxSize: 15, minSize: 6 }, { minSize: 5 } ], { trigger: "keyboard" })
    ).toEqual(l([ 6, 94 ]))
  })

  // Edge case
  // Expanding from a collapsed state to greater than the max size
  test("[1++,2]", () => {
    expect(
      adjust(25, [ 4, 96 ], [ { collapsedSize: 4, collapsible: true, defaultSize: 15, maxSize: 15, minSize: 6 }, { minSize: 5 } ])
    ).toEqual(l([ 15, 85 ]))
  })

  // Edge case
  // Expanding from a collapsed state mimicking an imperative API call
  test("[1++,2]", () => {
    expect(
      adjust(30, [ 5, 95 ], [ { collapsedSize: 5, collapsible: true, maxSize: 50, minSize: 25 }, { minSize: 50 } ])
    ).toEqual(l([ 35, 65 ]))
  })

  // Edge case
  // Expanding from a collapsed state mimicking an keyboard event
  test("[1++,2]", () => {
    expect(
      adjust(30, [ 5, 95 ], [ { collapsedSize: 5, collapsible: true, maxSize: 50, minSize: 25 }, { minSize: 50 } ], { trigger: "keyboard" })
    ).toEqual(l([ 35, 65 ]))
  })

  // Edge case
  // Expanding from a collapsed state mimicking an keyboard event when there is no min size
  test("[1++,2]", () => {
    expect(
      adjust(30, [ 0, 100 ], [ { collapsedSize: 0, collapsible: true, maxSize: 50, minSize: 0 }, {} ], { trigger: "keyboard" })
    ).toEqual(l([ 30, 70 ]))
  })

  test("[1--,2]", () => {
    expect(adjust(-1, [ 50, 50 ], [ {}, {} ])).toEqual(l([ 49, 51 ]))
  })

  test("[1--,2]", () => {
    expect(adjust(-25, [ 50, 50 ], [ {}, {} ])).toEqual(l([ 25, 75 ]))
  })

  test("[1--,2]", () => {
    expect(adjust(-50, [ 50, 50 ], [ {}, {} ])).toEqual(l([ 0, 100 ]))
  })

  test("[1--,2]", () => {
    expect(adjust(-50, [ 50, 50 ], [ { minSize: 20, maxSize: 60 }, { minSize: 10, maxSize: 90 } ])).toEqual(l([ 20, 80 ]))
  })

  test("[1--,2]", () => {
    expect(adjust(-25, [ 50, 50 ], [ COLLAPSIBLE_5_25, {} ])).toEqual(l([ 25, 75 ]))
  })

  test("[1--,2]", () => {
    expect(adjust(-30, [ 50, 50 ], [ COLLAPSIBLE_5_25, {} ])).toEqual(l([ 25, 75 ]))
    expect(adjust(-36, [ 50, 50 ], [ COLLAPSIBLE_5_25, {} ])).toEqual(l([ 5, 95 ]))
  })

  test("[1--,2]", () => {
    // Edge case
    // The second panel should prevent the first panel from collapsing
    expect(adjust(-30, [ 50, 50 ], [ COLLAPSIBLE_5_25, { maxSize: 80 } ])).toEqual(l([ 25, 75 ]))
  })

  // Edge case
  // Keyboard interactions should always expand a collapsed panel
  test("[1--,2]", () => {
    expect(adjust(-5, [ 90, 10 ], [ {}, COLLAPSIBLE_10_25 ], { trigger: "keyboard" })).toEqual(l([ 75, 25 ]))
  })

  // Edge case
  // Keyboard interactions should always collapse a collapsible panel once it's at the minimum size
  test("[1++,2]", () => {
    expect(adjust(-5, [ 25, 75 ], [ COLLAPSIBLE_10_25, {} ], { trigger: "keyboard" })).toEqual(l([ 10, 90 ]))
  })

  test("[1++,2,3]", () => {
    expect(adjust(1, [ 25, 50, 25 ], [ {}, {}, {} ])).toEqual(l([ 26, 49, 25 ]))
  })

  test("[1++,2,3]", () => {
    expect(adjust(25, [ 25, 50, 25 ], [ {}, {}, {} ])).toEqual(l([ 50, 25, 25 ]))
  })

  test("[1++,2,3]", () => {
    expect(adjust(50, [ 25, 50, 25 ], [ {}, {}, {} ])).toEqual(l([ 75, 0, 25 ]))
  })

  test("[1++,2,3]", () => {
    expect(adjust(75, [ 25, 50, 25 ], [ {}, {}, {} ])).toEqual(l([ 100, 0, 0 ]))
  })

  test("[1++,2,3]", () => {
    expect(adjust(25, [ 25, 50, 25 ], [ { maxSize: 35 }, { minSize: 25 }, {} ])).toEqual(l([ 35, 40, 25 ]))
  })

  test("[1++,2,3]", () => {
    // Any further than the max size should stop the drag/keyboard resize
    expect(adjust(25, [ 25, 50, 25 ], [ { maxSize: 35 }, { minSize: 25 }, {} ])).toEqual(l([ 35, 40, 25 ]))
  })

  test("[1++,2,3]", () => {
    expect(adjust(5, [ 25, 40, 35 ], [ {}, COLLAPSIBLE_5_25, { minSize: 25 } ])).toEqual(l([ 30, 35, 35 ]))
  })

  test("[1++,2,3]", () => {
    expect(adjust(26, [ 25, 40, 35 ], [ {}, COLLAPSIBLE_5_25, { minSize: 25 } ])).toEqual(l([ 60, 5, 35 ]))
  })

  test("[1++,2,3]", () => {
    expect(adjust(80, [ 25, 40, 35 ], [ {}, COLLAPSIBLE_5_25, { minSize: 25 } ])).toEqual(l([ 70, 5, 25 ]))
  })

  test("[1--,2,3]", () => {
    expect(adjust(-1, [ 25, 50, 25 ], [ {}, {}, {} ])).toEqual(l([ 24, 51, 25 ]))
  })

  test("[1--,2,3]", () => {
    expect(adjust(-25, [ 25, 50, 25 ], [ {}, {}, {} ])).toEqual(l([ 0, 75, 25 ]))
  })

  test("[1--,2,3]", () => {
    expect(adjust(-1, [ 25, 50, 25 ], [ { minSize: 20 }, {}, {} ])).toEqual(l([ 24, 51, 25 ]))
  })

  test("[1--,2,3]", () => {
    expect(adjust(-10, [ 25, 50, 25 ], [ { minSize: 20 }, {}, {} ])).toEqual(l([ 20, 55, 25 ]))
  })

  test("[1--,2,3]", () => {
    // Implied min size 10
    expect(adjust(-5, [ 25, 50, 25 ], [ {}, { maxSize: 70 }, { maxSize: 20 } ])).toEqual(l([ 20, 55, 25 ]))
  })

  test("[1--,2,3]", () => {
    // Implied min size 10
    expect(adjust(-20, [ 25, 50, 25 ], [ {}, { maxSize: 70 }, { maxSize: 20 } ])).toEqual(l([ 10, 65, 25 ]))
  })

  test("[1--,2,3]", () => {
    expect(adjust(-10, [ 25, 50, 25 ], [ COLLAPSIBLE_5_15, {}, {} ])).toEqual(l([ 15, 60, 25 ]))
  })

  test("[1--,2,3]", () => {
    expect(adjust(-20, [ 25, 50, 25 ], [ COLLAPSIBLE_5_15, {}, {} ])).toEqual(l([ 5, 70, 25 ]))
  })

  test("[1--,2,3]", () => {
    expect(adjust(-20, [ 45, 50, 5 ], [ {}, { maxSize: 50 }, COLLAPSIBLE_5_15 ])).toEqual(l([ 25, 50, 25 ]))
  })

  test("[1,2++,3]", () => {
    expect(adjust(-1, [ 25, 50, 25 ], [ {}, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 49, 26 ]))
  })

  test("[1,2++,3]", () => {
    expect(adjust(-25, [ 25, 50, 25 ], [ {}, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 25, 50 ]))
  })

  test("[1,2++,3]", () => {
    expect(adjust(-50, [ 25, 50, 25 ], [ {}, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 0, 75 ]))
  })

  test("[1,2++,3]", () => {
    expect(adjust(-75, [ 25, 50, 25 ], [ {}, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 0, 0, 100 ]))
  })

  test("[1,2++,3]", () => {
    expect(adjust(5, [ 25, 50, 25 ], [ {}, {}, { minSize: 15 } ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 55, 20 ]))
  })

  test("[1,2++,3]", () => {
    expect(adjust(20, [ 25, 50, 25 ], [ {}, {}, { minSize: 15 } ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 60, 15 ]))
  })

  test("[1,2++,3]", () => {
    expect(adjust(5, [ 25, 50, 25 ], [ {}, {}, { collapsible: true, minSize: 20 } ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 55, 20 ]))
  })

  test("[1,2++,3]", () => {
    expect(adjust(10, [ 25, 50, 25 ], [ {}, {}, { collapsible: true, minSize: 20 } ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 55, 20 ]))
    expect(adjust(16, [ 25, 50, 25 ], [ {}, {}, { collapsible: true, minSize: 20 } ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 75, 0 ]))
  })

  test("[1,2--,3]", () => {
    expect(adjust(1, [ 25, 50, 25 ], [ {}, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 51, 24 ]))
  })

  test("[1,2--,3]", () => {
    expect(adjust(25, [ 25, 50, 25 ], [ {}, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 75, 0 ]))
  })

  test("[1,2--,3]", () => {
    expect(adjust(-20, [ 25, 50, 25 ], [ {}, { minSize: 40 }, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 15, 40, 45 ]))
  })

  test("[1,2--,3]", () => {
    expect(adjust(-10, [ 25, 50, 25 ], [ {}, {}, { maxSize: 30 } ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 45, 30 ]))
  })

  test("[1,2--,3]", () => {
    expect(adjust(-35, [ 25, 50, 25 ], [ {}, COLLAPSIBLE_5_20, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 20, 20, 60 ]))
    expect(adjust(-40, [ 25, 50, 25 ], [ {}, COLLAPSIBLE_5_20, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 5, 70 ]))
  })

  test("[1,2--,3]", () => {
    expect(adjust(-10, [ 25, 0, 75 ], [ COLLAPSIBLE_5_20, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 20, 0, 80 ]))
    expect(adjust(-20, [ 25, 0, 75 ], [ COLLAPSIBLE_5_20, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 5, 0, 95 ]))
  })

  // Edge case
  test("[1,2--,3]", () => {
    expect(
      adjust(-100, [ 100 / 3, 100 / 3, 100 / 3 ], [ {}, {}, {} ], { pivotIndices: [ 1, 2 ], trigger: "mouse-or-touch" })
    ).toEqual(l([ 0, 0, 100 ]))
  })

  test("[1++,2,3,4]", () => {
    expect(adjust(1, [ 25, 25, 25, 25 ], [ {}, {}, {}, {} ])).toEqual(l([ 26, 24, 25, 25 ]))
  })

  test("[1++,2,3,4]", () => {
    expect(adjust(25, [ 25, 25, 25, 25 ], [ {}, {}, {}, {} ])).toEqual(l([ 50, 0, 25, 25 ]))
  })

  test("[1++,2,3,4]", () => {
    expect(adjust(50, [ 25, 25, 25, 25 ], [ {}, {}, {}, {} ])).toEqual(l([ 75, 0, 0, 25 ]))
  })

  test("[1++,2,3,4]", () => {
    expect(adjust(75, [ 25, 25, 25, 25 ], [ {}, {}, {}, {} ])).toEqual(l([ 100, 0, 0, 0 ]))
  })

  test("[1++,2,3,4]", () => {
    expect(adjust(25, [ 25, 25, 25, 25 ], [ { maxSize: 35 }, {}, {}, {} ])).toEqual(l([ 35, 15, 25, 25 ]))
  })

  test("[1++,2,3,4]", () => {
    expect(adjust(100, [ 25, 25, 25, 25 ], [ {}, { minSize: 10 }, { minSize: 10 }, { minSize: 10 } ])).toEqual(l([ 70, 10, 10, 10 ]))
  })

  test("[1++,2,3,4]", () => {
    expect(adjust(10, [ 25, 25, 25, 25 ], [ {}, COLLAPSIBLE_5_20, COLLAPSIBLE_5_20, COLLAPSIBLE_5_20 ])).toEqual(l([ 35, 20, 20, 25 ]))
    expect(adjust(15, [ 25, 25, 25, 25 ], [ {}, COLLAPSIBLE_5_20, COLLAPSIBLE_5_20, COLLAPSIBLE_5_20 ])).toEqual(l([ 45, 5, 25, 25 ]))
  })

  test("[1++,2,3,4]", () => {
    expect(adjust(40, [ 25, 25, 25, 25 ], [ {}, COLLAPSIBLE_5_20, COLLAPSIBLE_5_20, COLLAPSIBLE_5_20 ])).toEqual(l([ 65, 5, 5, 25 ]))
  })

  test("[1++,2,3,4]", () => {
    expect(adjust(100, [ 25, 25, 25, 25 ], [ {}, COLLAPSIBLE_5_20, COLLAPSIBLE_5_20, COLLAPSIBLE_5_20 ])).toEqual(l([ 85, 5, 5, 5 ]))
  })

  test("[1--,2,3,4]", () => {
    expect(adjust(-1, [ 25, 25, 25, 25 ], [ {}, {}, {}, {} ])).toEqual(l([ 24, 26, 25, 25 ]))
  })

  test("[1--,2,3,4]", () => {
    expect(adjust(-25, [ 25, 25, 25, 25 ], [ {}, {}, {}, {} ])).toEqual(l([ 0, 50, 25, 25 ]))
  })

  test("[1--,2,3,4]", () => {
    expect(adjust(-10, [ 25, 25, 25, 25 ], [ { minSize: 20 }, {}, {}, {} ])).toEqual(l([ 20, 30, 25, 25 ]))
  })

  test("[1--,2,3,4]", () => {
    expect(adjust(-25, [ 25, 25, 25, 25 ], [ {}, { maxSize: 35 }, {}, {} ])).toEqual(l([ 0, 35, 40, 25 ]))
  })

  test("[1--,2,3,4]", () => {
    expect(adjust(-10, [ 25, 25, 25, 25 ], [ COLLAPSIBLE_5_20, {}, {}, {} ])).toEqual(l([ 20, 30, 25, 25 ]))
    expect(adjust(-15, [ 25, 25, 25, 25 ], [ COLLAPSIBLE_5_20, {}, {}, {} ])).toEqual(l([ 5, 45, 25, 25 ]))
  })

  test("[1--,2,3,4]", () => {
    expect(adjust(-10, [ 25, 25, 25, 25 ], [ COLLAPSIBLE_5_20, { maxSize: 35 }, {}, {} ])).toEqual(l([ 20, 30, 25, 25 ]))
    expect(adjust(-15, [ 25, 25, 25, 25 ], [ COLLAPSIBLE_5_20, { maxSize: 35 }, {}, {} ])).toEqual(l([ 5, 35, 35, 25 ]))
  })

  test("[1--,2,3,4]", () => {
    // This might be controversial behavior;
    // Perhaps the 1st panel should collapse
    // rather than being blocked by the max size constraints of the 2nd panel
    // since the 3rd panel has room to grow still
    //
    // An alternate layout result might be: [5, 30, 40, 25]
    expect(adjust(-10, [ 25, 25, 25, 25 ], [ COLLAPSIBLE_5_20, { maxSize: 30 }, {}, {} ])).toEqual(l([ 20, 30, 25, 25 ]))
  })

  test("[1--,2,3,4]", () => {
    // This might be controversial behavior;
    // Perhaps the 1st panel should collapse
    // rather than being blocked by the max size constraints of the 2nd panel
    // since the 3rd panel has room to grow still
    //
    // An alternate layout result might be: [5, 30, 35, 30]
    expect(adjust(-10, [ 25, 25, 25, 25 ], [ COLLAPSIBLE_5_20, { maxSize: 30 }, { maxSize: 35 }, {} ])).toEqual(l([ 20, 30, 25, 25 ]))
  })

  // Edge case (issues/210)
  test("[1--,2,3,4]", () => {
    // If the size doesn't drop below the halfway point, the panel should not collapse
    expect(
      adjust(-10, [ 25, 25, 25, 25 ], [ COLLAPSIBLE_5_20, { maxSize: 35 }, { maxSize: 35 }, { maxSize: 35 } ])
    ).toEqual(l([ 20, 30, 25, 25 ]))

    // If the size drops below the halfway point, the panel should collapse
    // In this case it needs to add sizes to multiple other panels in order to collapse
    // because the nearest neighbor panel's max size constraints won't allow it to expand to cover all of the difference
    expect(
      adjust(-20, [ 25, 25, 25, 25 ], [ COLLAPSIBLE_5_20, { maxSize: 35 }, { maxSize: 35 }, { maxSize: 35 } ])
    ).toEqual(l([ 5, 35, 35, 25 ]))
  })

  test("[1,2++,3,4]", () => {
    expect(adjust(10, [ 25, 25, 25, 25 ], [ {}, {}, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 35, 15, 25 ]))
  })

  test("[1,2++,3,4]", () => {
    expect(adjust(30, [ 25, 25, 25, 25 ], [ {}, {}, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 55, 0, 20 ]))
  })

  test("[1,2++,3,4]", () => {
    expect(adjust(50, [ 25, 25, 25, 25 ], [ {}, {}, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 75, 0, 0 ]))
  })

  test("[1,2++,3,4]", () => {
    expect(adjust(50, [ 25, 25, 25, 25 ], [ {}, { maxSize: 35 }, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 65, 35, 0, 0 ]))
  })

  test("[1,2++,3,4]", () => {
    expect(adjust(50, [ 25, 25, 25, 25 ], [ {}, {}, { minSize: 20 }, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 55, 20, 0 ]))
  })

  test("[1,2++,3,4]", () => {
    expect(adjust(10, [ 25, 25, 25, 25 ], [ {}, {}, {}, COLLAPSIBLE_5_10 ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 35, 15, 25 ]))
  })

  test("[1,2++,3,4]", () => {
    expect(adjust(30, [ 25, 25, 25, 25 ], [ {}, {}, COLLAPSIBLE_5_10, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 55, 5, 15 ]))
  })

  test("[1,2++,3,4]", () => {
    expect(adjust(50, [ 25, 25, 25, 25 ], [ {}, {}, COLLAPSIBLE_5_10, { minSize: 10 } ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 60, 5, 10 ]))
  })

  test("[1,2--,3,4]", () => {
    expect(adjust(-25, [ 25, 25, 25, 25 ], [ {}, {}, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 0, 50, 25 ]))
  })

  test("[1,2--,3,4]", () => {
    expect(adjust(-50, [ 25, 25, 25, 25 ], [ {}, {}, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 0, 0, 75, 25 ]))
  })

  test("[1,2--,3,4]", () => {
    expect(adjust(-50, [ 25, 25, 25, 25 ], [ {}, { minSize: 20 }, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 0, 20, 55, 25 ]))
  })

  test("[1,2--,3,4]", () => {
    expect(adjust(-50, [ 25, 25, 25, 25 ], [ { minSize: 20 }, {}, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 20, 0, 55, 25 ]))
  })

  test("[1,2--,3,4]", () => {
    expect(adjust(-50, [ 25, 25, 25, 25 ], [ { minSize: 20 }, { minSize: 20 }, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 20, 20, 35, 25 ]))
  })

  test("[1,2--,3,4]", () => {
    expect(adjust(-5, [ 25, 25, 25, 25 ], [ COLLAPSIBLE_5_20, {}, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 25, 20, 30, 25 ]))
  })

  test("[1,2--,3,4]", () => {
    expect(adjust(-50, [ 25, 25, 25, 25 ], [ COLLAPSIBLE_5_20, {}, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 5, 0, 70, 25 ]))
  })

  test("[1,2--,3,4]", () => {
    expect(adjust(-50, [ 25, 25, 25, 25 ], [ {}, COLLAPSIBLE_5_20, {}, {} ], { pivotIndices: [ 1, 2 ] })).toEqual(l([ 0, 5, 70, 25 ]))
  })

  test("[1,2,3++,4]", () => {
    expect(adjust(10, [ 25, 25, 25, 25 ], [ {}, {}, {}, {} ], { pivotIndices: [ 2, 3 ] })).toEqual(l([ 25, 25, 35, 15 ]))
  })

  test("[1,2,3++,4]", () => {
    expect(adjust(30, [ 25, 25, 25, 25 ], [ {}, {}, {}, {} ], { pivotIndices: [ 2, 3 ] })).toEqual(l([ 25, 25, 50, 0 ]))
  })

  test("[1,2,3++,4]", () => {
    expect(adjust(30, [ 25, 25, 25, 25 ], [ {}, {}, { maxSize: 40 }, {} ], { pivotIndices: [ 2, 3 ] })).toEqual(l([ 25, 35, 40, 0 ]))
  })

  test("[1,2,3++,4]", () => {
    expect(adjust(30, [ 25, 25, 25, 25 ], [ {}, {}, {}, { minSize: 10 } ], { pivotIndices: [ 2, 3 ] })).toEqual(l([ 25, 25, 40, 10 ]))
  })

  test("[1,2,3++,4]", () => {
    expect(adjust(5, [ 25, 25, 25, 25 ], [ {}, {}, {}, COLLAPSIBLE_5_20 ], { pivotIndices: [ 2, 3 ] })).toEqual(l([ 25, 25, 30, 20 ]))
  })
  test("[1,2,3++,4]", () => {
    expect(adjust(50, [ 25, 25, 25, 25 ], [ {}, {}, {}, COLLAPSIBLE_5_20 ], { pivotIndices: [ 2, 3 ] })).toEqual(l([ 25, 25, 45, 5 ]))
  })

  test("[1,2,3--,4]", () => {
    expect(adjust(-10, [ 25, 25, 25, 25 ], [ {}, {}, {}, {} ], { pivotIndices: [ 2, 3 ] })).toEqual(l([ 25, 25, 15, 35 ]))
  })

  test("[1,2,3--,4]", () => {
    expect(adjust(-40, [ 25, 25, 25, 25 ], [ {}, {}, {}, {} ], { pivotIndices: [ 2, 3 ] })).toEqual(l([ 25, 10, 0, 65 ]))
  })

  test("[1,2,3--,4]", () => {
    expect(adjust(-100, [ 25, 25, 25, 25 ], [ {}, {}, {}, {} ], { pivotIndices: [ 2, 3 ] })).toEqual(l([ 0, 0, 0, 100 ]))
  })

  test("[1,2,3--,4]", () => {
    expect(adjust(-50, [ 25, 25, 25, 25 ], [ { minSize: 10 }, { minSize: 10 }, { minSize: 10 }, {} ], { pivotIndices: [ 2, 3 ] })).toEqual(l([ 10, 10, 10, 70 ]))
  })

  test("[1,2,3--,4]", () => {
    expect(adjust(-50, [ 25, 25, 25, 25 ], [ {}, {}, {}, { maxSize: 40 } ], { pivotIndices: [ 2, 3 ] })).toEqual(l([ 25, 25, 10, 40 ]))
  })

  test("[1,2,3--,4]", () => {
    expect(adjust(-50, [ 25, 25, 25, 25 ], [ {}, { minSize: 5 }, {}, {} ], { pivotIndices: [ 2, 3 ] })).toEqual(l([ 20, 5, 0, 75 ]))
  })

  test("[1,2,3--,4]", () => {
    expect(adjust(-100, [ 25, 25, 25, 25 ], [ COLLAPSIBLE_5_20, COLLAPSIBLE_5_20, COLLAPSIBLE_5_20, {} ], { pivotIndices: [ 2, 3 ] })).toEqual(l([ 5, 5, 5, 85 ]))
  })

  test("[1,2,3--,4]", () => {
    expect(adjust(-100, [ 25, 25, 25, 25 ], [ { minSize: 20 }, COLLAPSIBLE_5_20, { minSize: 20 }, {} ], { pivotIndices: [ 2, 3 ] })).toEqual(l([ 20, 5, 20, 55 ]))
  })

  describe("invalid layouts", () => {
    test("should ignore changes that violate max or min size constraints", () => {
      expect(adjust(1, [ 50, 50 ], [ { maxSize: 50 }, {} ])).toEqual(l([ 50, 50 ]))
      expect(adjust(1, [ 50, 50 ], [ {}, { minSize: 50 } ])).toEqual(l([ 50, 50 ]))
    })
  })

  // Edge case (issues/311)
  test("should fallback to the previous layout if an intermediate layout is invalid", () => {
    expect(
      adjust(16, [ 5, 15, 40, 40 ], [
        { collapsedSize: 5, collapsible: true, minSize: 15, maxSize: 20 },
        { minSize: 30, maxSize: 30 },
        { minSize: 30 },
        { minSize: 20, maxSize: 40 }
      ], { prevLayout: [ 20, 30, 30, 20 ] })
    ).toEqual(l([ 20, 30, 30, 20 ]))
  })

  // Edge case (issues/311)
  test("should (re)collapse an already-collapsed panel that's been expanded and (re)collapsed as part of a single drag", () => {
    expect(
      adjust(-3, [ 5, 15, 40, 40 ], [
        { collapsedSize: 5, collapsible: true, minSize: 15, maxSize: 20 },
        { minSize: 15, maxSize: 30 },
        { minSize: 30 },
        { minSize: 20, maxSize: 40 }
      ], { prevLayout: [ 15, 15, 30, 36 ] })
    ).toEqual(l([ 5, 15, 40, 40 ]))
  })

  // Edge case issues/210 and issues/629
  describe("collapsible panel thresholds", () => {
    [ "left", "right" ].forEach(panelId => {
      [
        { collapsedSize: 0, minSize: 10, open: [ 10, 90 ], closed: [ 0, 100 ] },
        { collapsedSize: 5, minSize: 15, open: [ 15, 85 ], closed: [ 5, 95 ] }
      ].forEach(({ collapsedSize, minSize, open: openSizes, closed: closedSizes }) => {
        describe(`${panelId} panel with collapsedSize:${collapsedSize}`, () => {
          const collapsiblePanelConstraints = { collapsedSize, collapsible: true, minSize }

          const open = panelId === "left" ? l(openSizes) : l([ ...openSizes ].reverse())
          const closed = panelId === "left" ? l(closedSizes) : l([ ...closedSizes ].reverse())
          const panelConstraints = panelId === "left"
            ? c([ collapsiblePanelConstraints, {} ])
            : c([ {}, collapsiblePanelConstraints ])

          function drag(delta, initialLayout, prevLayout) {
            return run({ delta, initialLayout, panelConstraints, prevLayout, trigger: "mouse-or-touch" })
          }

          test("remain open if delta is less than minimum threshold", () => {
            expect(drag(panelId === "left" ? -4 : 4, open, open)).toEqual(open)
          })

          test("close if delta is greater than minimum threshold", () => {
            expect(drag(panelId === "left" ? -6 : 6, open, open)).toEqual(closed)
          })

          test("re-open if delta is less than minimum threshold", () => {
            expect(drag(panelId === "left" ? -4 : 4, open, closed)).toEqual(open)
          })

          test("remain closed if delta is more than minimum threshold", () => {
            expect(drag(panelId === "left" ? -6 : 6, open, closed)).toEqual(closed)
          })

          test("remain closed if delta is less than minimum threshold", () => {
            expect(drag(panelId === "left" ? 4 : -4, closed, closed)).toEqual(closed)
          })

          test("open if delta is greater than minimum threshold", () => {
            expect(drag(panelId === "left" ? 6 : -6, closed, closed)).toEqual(open)
          })

          test("close if delta is less than minimum threshold", () => {
            expect(drag(panelId === "left" ? 4 : -4, closed, open)).toEqual(closed)
          })

          test("remain open if delta is more than minimum threshold", () => {
            expect(drag(panelId === "left" ? 6 : -6, closed, open)).toEqual(open)
          })
        })
      })
    })

    describe("3-panel layouts", () => {
      const collapsibleConstraints = { collapsedSize: 5, collapsible: true, minSize: 15 }

      test("expand left when there are multiple panels", () => {
        expect(
          adjust(-70, [ 25, 50, 25 ], [ {}, {}, collapsibleConstraints ], { pivotIndices: [ 1, 2 ], trigger: "mouse-or-touch" })
        ).toEqual(l([ 5, 0, 95 ]))
      })

      test("expand right when there are multiple panels", () => {
        expect(
          adjust(70, [ 25, 50, 25 ], [ collapsibleConstraints, {}, {} ], { pivotIndices: [ 0, 1 ], trigger: "mouse-or-touch" })
        ).toEqual(l([ 95, 0, 5 ]))
      })

      test("edge case issues/639", () => {
        [
          [ -10, l([ 20, 40, 40 ]) ],
          [ -20, l([ 20, 30, 50 ]) ],
          [ -30, l([ 20, 20, 60 ]) ],
          [ -40, l([ 10, 20, 70 ]) ],
          [ -50, l([ 0, 20, 80 ]) ]
        ].forEach(([ delta, expectedLayout ]) => {
          expect(
            adjust(delta, [ 20, 50, 30 ], [
              { collapsedSize: 0, collapsible: true, defaultSize: 20, minSize: 10 },
              { defaultSize: 50, minSize: 20 },
              { collapsedSize: 0, collapsible: true, defaultSize: 30, minSize: 10 }
            ], { pivotIndices: [ 1, 2 ], trigger: "mouse-or-touch" })
          ).toEqual(expectedLayout)
        })
      })

      test("edge case issues/650", () => {
        const collapsible = { collapsedSize: 0, collapsible: true, minSize: 10 }

        ;[
          [ -4, c([ collapsible, {} ]), l([ 46, 54 ]) ],
          [ -6, c([ collapsible, {} ]), l([ 44, 56 ]) ],
          [ -4, c([ {}, collapsible ]), l([ 46, 54 ]) ],
          [ -6, c([ {}, collapsible ]), l([ 44, 56 ]) ],
          [ 4, c([ collapsible, {} ]), l([ 54, 46 ]) ],
          [ 6, c([ collapsible, {} ]), l([ 56, 44 ]) ],
          [ 4, c([ {}, collapsible ]), l([ 54, 46 ]) ],
          [ 6, c([ {}, collapsible ]), l([ 56, 44 ]) ]
        ].forEach(([ delta, panelConstraints, expectedLayout ]) => {
          expect(
            run({ delta, initialLayout: l([ 50, 50 ]), panelConstraints, prevLayout: l([ 50, 50 ]), pivotIndices: [ 0, 1 ], trigger: "mouse-or-touch" })
          ).toEqual(expectedLayout)
        })
      })

      test("edge case discussions/643", () => {
        const collapsible = { collapsedSize: 10, collapsible: true, defaultSize: 10, maxSize: 50, minSize: 20 }

        ;[
          [ 4, l([ 10, 90 ]) ],
          [ 6, l([ 20, 80 ]) ],
          [ 10, l([ 20, 80 ]) ],
          [ 15, l([ 25, 75 ]) ],
          [ 25, l([ 35, 65 ]) ],
          [ 40, l([ 50, 50 ]) ],
          [ 50, l([ 50, 50 ]) ]
        ].forEach(([ delta, expectedLayout ]) => {
          expect(adjust(delta, [ 10, 90 ], [ collapsible, {} ], { trigger: "mouse-or-touch" })).toEqual(expectedLayout)
        })

        // 2nd panel variation of the above
        ;[
          [ -4, l([ 90, 10 ]) ],
          [ -6, l([ 80, 20 ]) ],
          [ -10, l([ 80, 20 ]) ],
          [ -15, l([ 75, 25 ]) ],
          [ -25, l([ 65, 35 ]) ],
          [ -40, l([ 50, 50 ]) ],
          [ -50, l([ 50, 50 ]) ]
        ].forEach(([ delta, expectedLayout ]) => {
          expect(adjust(delta, [ 90, 10 ], [ {}, collapsible ], { trigger: "mouse-or-touch" })).toEqual(expectedLayout)
        })
      })
    })
  })

  describe("disabled panels", () => {
    test("should not be resizable in a 2 panel group", () => {
      [
        [ -50, c([ { disabled: true }, {} ]) ],
        [ 50, c([ { disabled: true }, {} ]) ],
        [ -50, c([ {}, { disabled: true } ]) ],
        [ 50, c([ {}, { disabled: true } ]) ]
      ].forEach(([ delta, panelConstraints ]) => {
        expect(
          run({ delta, initialLayout: l([ 50, 50 ]), panelConstraints, prevLayout: l([ 50, 50 ]), trigger: "mouse-or-touch" })
        ).toEqual(l([ 50, 50 ]))
      })
    })

    test("should not be resizable if 1 of 3 panels are disabled", () => {
      const layout = l([ 25, 50, 25 ])

      function drag(delta, panelConstraints, pivotIndices) {
        return run({ delta, initialLayout: layout, panelConstraints, pivotIndices, prevLayout: layout, trigger: "mouse-or-touch" })
      }

      {
        // Left panel disabled
        const panelConstraints = c([ { disabled: true }, {}, {} ])

        expect(drag(-25, panelConstraints, [ 0, 1 ])).toEqual(layout)
        expect(drag(-75, panelConstraints, [ 1, 2 ])).toEqual(l([ 25, 0, 75 ]))
      }

      {
        // Center panel disabled
        const panelConstraints = c([ {}, { disabled: true }, {} ])

        expect(drag(-25, panelConstraints, [ 0, 1 ])).toEqual(l([ 0, 50, 50 ]))
        expect(drag(-25, panelConstraints, [ 1, 2 ])).toEqual(l([ 0, 50, 50 ]))
      }

      {
        // Right panel disabled
        const panelConstraints = c([ {}, {}, { disabled: true } ])

        expect(drag(-25, panelConstraints, [ 0, 1 ])).toEqual(l([ 0, 75, 25 ]))
        expect(drag(-25, panelConstraints, [ 1, 2 ])).toEqual(l([ 25, 50, 25 ]))
      }
    })

    test("should not be resizable if 2 of 3 panels are disabled", () => {
      [
        [ -50, c([ { disabled: true }, { disabled: true }, {} ]) ],
        [ 50, c([ { disabled: true }, { disabled: true }, {} ]) ],
        [ -50, c([ { disabled: true }, {}, { disabled: true } ]) ],
        [ 50, c([ { disabled: true }, {}, { disabled: true } ]) ],
        [ -50, c([ {}, { disabled: true }, { disabled: true } ]) ],
        [ 50, c([ {}, { disabled: true }, { disabled: true } ]) ]
      ].forEach(([ delta, panelConstraints ]) => {
        [ [ 0, 1 ], [ 1, 2 ] ].forEach(pivotIndices => {
          expect(
            run({ delta, initialLayout: l([ 25, 50, 25 ]), panelConstraints, pivotIndices, prevLayout: l([ 25, 50, 25 ]), trigger: "mouse-or-touch" })
          ).toEqual(l([ 25, 50, 25 ]))
        })
      })
    })

    test("should be resizable via the imperative API", () => {
      [
        [ -5, c([ { disabled: true }, {} ]), l([ 45, 55 ]) ],
        [ 5, c([ { disabled: true }, {} ]), l([ 55, 45 ]) ],
        [ -5, c([ {}, { disabled: true } ]), l([ 45, 55 ]) ],
        [ 5, c([ {}, { disabled: true } ]), l([ 55, 45 ]) ]
      ].forEach(([ delta, panelConstraints, expectedLayout ]) => {
        expect(
          run({ delta, initialLayout: l([ 50, 50 ]), panelConstraints, prevLayout: l([ 50, 50 ]), trigger: "imperative-api" })
        ).toEqual(expectedLayout)
      })
    })
  })
})
