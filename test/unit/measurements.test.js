import { calculateAvailableGroupSize, calculatePanelConstraints } from "src/dom/measurements"
import { describe, expect, test } from "vitest"
import { mockGroup, setElementStyle } from "./test_helper"

describe("calculateAvailableGroupSize", () => {
  test("panel widths", () => {
    const group = mockGroup(new DOMRect(0, 0, 100, 50), { orientation: "horizontal" })
    group.addPanel(new DOMRect(0, 0, 25, 50))
    group.addPanel(new DOMRect(0, 0, 75, 50))

    expect(calculateAvailableGroupSize({ group })).toBe(100)
  })

  test("panel widths, excluding separators", () => {
    const group = mockGroup(new DOMRect(0, 0, 100, 50), { orientation: "horizontal" })
    group.addHTMLElement(new DOMRect(0, 0, 10, 50))
    group.addPanel(new DOMRect(0, 0, 20, 50))
    group.addPanel(new DOMRect(0, 0, 30, 50))
    group.addHTMLElement(new DOMRect(0, 0, 10, 50))

    expect(calculateAvailableGroupSize({ group })).toBe(50)
  })

  test("panel widths, excluding other DOM elements", () => {
    const group = mockGroup(new DOMRect(0, 0, 100, 50), { orientation: "horizontal" })
    group.addPanel(new DOMRect(0, 0, 49, 50))
    group.addSeparator(new DOMRect(0, 0, 2, 50))
    group.addPanel(new DOMRect(0, 0, 49, 50))

    expect(calculateAvailableGroupSize({ group })).toBe(98)
  })

  test("panel widths, excluding flex padding, gap, or margins", () => {
    const group = mockGroup(new DOMRect(0, 0, 100, 50), { orientation: "horizontal" })
    group.addPanel(new DOMRect(0, 0, 45, 50))
    group.addPanel(new DOMRect(0, 0, 45, 50))

    expect(calculateAvailableGroupSize({ group })).toBe(90)
  })

  test("panel heights for vertical groups", () => {
    const group = mockGroup(new DOMRect(0, 0, 50, 100), { orientation: "vertical" })
    group.addPanel(new DOMRect(0, 0, 50, 30))
    group.addPanel(new DOMRect(0, 30, 50, 70))

    expect(calculateAvailableGroupSize({ group })).toBe(100)
  })
})

describe("calculatePanelConstraints", () => {
  test("defaults when no constraints are given", () => {
    const group = mockGroup(new DOMRect(0, 0, 200, 50))
    group.addPanel(new DOMRect(0, 0, 100, 50), "a")
    group.addPanel(new DOMRect(100, 0, 100, 50), "b")

    expect(calculatePanelConstraints(group)).toEqual([
      {
        groupResizeBehavior: undefined,
        collapsedSize: 0,
        collapsedThreshold: undefined,
        collapsible: false,
        defaultSize: undefined,
        disabled: undefined,
        minSize: 0,
        maxSize: 100,
        panelId: "group-1-a"
      },
      {
        groupResizeBehavior: undefined,
        collapsedSize: 0,
        collapsedThreshold: undefined,
        collapsible: false,
        defaultSize: undefined,
        disabled: undefined,
        minSize: 0,
        maxSize: 100,
        panelId: "group-1-b"
      }
    ])
  })

  test("converts every unit to a percentage of the group", () => {
    const group = mockGroup(new DOMRect(0, 0, 200, 50))
    group.addPanel(new DOMRect(0, 0, 100, 50), "a", {
      collapsedSize: 10,
      collapsedThreshold: "5%",
      collapsible: true,
      defaultSize: "40",
      minSize: "50px",
      maxSize: "150px"
    })
    group.addPanel(new DOMRect(100, 0, 100, 50), "b", { minSize: "2em", groupResizeBehavior: "preserve-pixel-size" })

    setElementStyle(group.panels[1].element, { fontSize: "10px" })

    expect(calculatePanelConstraints(group)).toEqual([
      {
        groupResizeBehavior: undefined,
        collapsedSize: 5,
        collapsedThreshold: 5,
        collapsible: true,
        defaultSize: 40,
        disabled: undefined,
        minSize: 25,
        maxSize: 75,
        panelId: "group-1-a"
      },
      {
        groupResizeBehavior: "preserve-pixel-size",
        collapsedSize: 0,
        collapsedThreshold: undefined,
        collapsible: false,
        defaultSize: undefined,
        disabled: undefined,
        minSize: 10,
        maxSize: 100,
        panelId: "group-1-b"
      }
    ])
  })

  test("returns neutral constraints when the group has no size", () => {
    const group = mockGroup(new DOMRect(0, 0, 0, 0))
    group.addPanel(new DOMRect(0, 0, 0, 0), "a", { minSize: "50px", defaultSize: "30", collapsible: true, disabled: true })

    expect(calculatePanelConstraints(group)).toEqual([
      {
        groupResizeBehavior: undefined,
        collapsedSize: 0,
        collapsible: true,
        defaultSize: undefined,
        disabled: true,
        minSize: 0,
        maxSize: 100,
        panelId: "group-1-a"
      }
    ])
  })
})
