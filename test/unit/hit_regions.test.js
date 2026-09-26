import { afterEach, describe, expect, test, vi } from "vitest"
import { calculateHitRegions, findMatchingHitRegions, isViableHitTarget } from "src/dom/hit_regions"
import { mockGroup, mockPointerEvent } from "./test_helper"
import { getMountedGroups } from "src/engine/groups_state"
import { mountGroup } from "src/engine/mount_group"

describe("calculateHitRegions", () => {
  test("bounds panel dimension reads during hit testing", () => {
    const panelCount = 20
    const group = mockGroup(new DOMRect(0, 0, panelCount * 50, 50))
    for (let index = 0; index < panelCount; index++) {
      group.addPanel(new DOMRect(index * 50, 0, 50, 50))
    }

    let dimensionReads = 0
    group.panels.forEach(panel => {
      Object.defineProperty(panel.element, "offsetWidth", {
        configurable: true,
        get() {
          dimensionReads++
          return 50
        }
      })
    })

    const hitRegions = calculateHitRegions({ group })
    expect(hitRegions).toHaveLength(panelCount - 1)
    expect(hitRegions.every(region => region.groupSize === panelCount * 50)).toBe(true)
    expect(dimensionReads).toBeLessThanOrEqual(panelCount * 2)
  })

  function serialize(group) {
    const hitRegions = calculateHitRegions({ group })

    return JSON.stringify(
      hitRegions.map(region => ({
        panels: region.panels.map(panel => panel.id),
        rect: `${region.rect.x},${region.rect.y} ${region.rect.width} x ${region.rect.height}`,
        separator: region.separator?.id
      })),
      null,
      2
    )
  }

  test("empty panels", () => {
    const group = mockGroup(new DOMRect(0, 0, 10, 50))
    expect(serialize(group)).toMatchInlineSnapshot("\"[]\"")
  })

  test("one panel", () => {
    const group = mockGroup(new DOMRect(0, 0, 10, 50))
    group.addPanel(new DOMRect(0, 0, 10, 50))

    expect(serialize(group)).toMatchInlineSnapshot("\"[]\"")
  })

  test("two panels", () => {
    const group = mockGroup(new DOMRect(0, 0, 100, 50))
    group.addPanel(new DOMRect(0, 0, 50, 50), "left")
    group.addPanel(new DOMRect(50, 0, 50, 50), "right")

    expect(serialize(group)).toMatchInlineSnapshot(`
      "[
        {
          "panels": [
            "group-1-left",
            "group-1-right"
          ],
          "rect": "45,0 10 x 50"
        }
      ]"
    `)
  })

  test("three panels", () => {
    const group = mockGroup(new DOMRect(0, 0, 120, 50))
    group.addPanel(new DOMRect(0, 0, 40, 50), "left")
    group.addPanel(new DOMRect(40, 0, 40, 50), "center")
    group.addPanel(new DOMRect(80, 0, 40, 50), "right")

    expect(serialize(group)).toMatchInlineSnapshot(`
      "[
        {
          "panels": [
            "group-1-left",
            "group-1-center"
          ],
          "rect": "35,0 10 x 50"
        },
        {
          "panels": [
            "group-1-center",
            "group-1-right"
          ],
          "rect": "75,0 10 x 50"
        }
      ]"
    `)
  })

  test("panels and explicit separators", () => {
    const group = mockGroup(new DOMRect(0, 0, 140, 50))
    group.addPanel(new DOMRect(0, 0, 40, 50), "left")
    group.addSeparator(new DOMRect(40, 0, 10, 50), "left")
    group.addPanel(new DOMRect(50, 0, 40, 50), "center")
    group.addSeparator(new DOMRect(90, 0, 10, 50), "right")
    group.addPanel(new DOMRect(100, 0, 40, 50), "right")

    expect(serialize(group)).toMatchInlineSnapshot(`
      "[
        {
          "panels": [
            "group-1-left",
            "group-1-center"
          ],
          "rect": "40,0 10 x 50",
          "separator": "group-1-left"
        },
        {
          "panels": [
            "group-1-center",
            "group-1-right"
          ],
          "rect": "90,0 10 x 50",
          "separator": "group-1-right"
        }
      ]"
    `)
  })

  test("panels and some explicit separators", () => {
    const group = mockGroup(new DOMRect(0, 0, 125, 50))
    group.addPanel(new DOMRect(0, 0, 40, 50), "a")
    group.addPanel(new DOMRect(40, 0, 40, 50), "b")
    group.addSeparator(new DOMRect(80, 0, 5, 50), "separator")
    group.addPanel(new DOMRect(85, 0, 40, 50), "c")

    expect(serialize(group)).toMatchInlineSnapshot(`
      "[
        {
          "panels": [
            "group-1-a",
            "group-1-b"
          ],
          "rect": "35,0 10 x 50"
        },
        {
          "panels": [
            "group-1-b",
            "group-1-c"
          ],
          "rect": "77.5,0 10 x 50",
          "separator": "group-1-separator"
        }
      ]"
    `)
  })

  test("mixed panels and non-panel children", () => {
    const group = mockGroup(new DOMRect(0, 0, 230, 50))
    group.addHTMLElement(new DOMRect(0, 0, 10, 50))
    group.addPanel(new DOMRect(10, 0, 50, 50), "a")
    group.addPanel(new DOMRect(60, 0, 50, 50), "b")
    group.addHTMLElement(new DOMRect(110, 0, 10, 50))
    group.addPanel(new DOMRect(120, 0, 50, 50), "c")
    group.addPanel(new DOMRect(170, 0, 50, 50), "d")
    group.addHTMLElement(new DOMRect(220, 0, 10, 50))

    expect(serialize(group)).toMatchInlineSnapshot(`
      "[
        {
          "panels": [
            "group-1-a",
            "group-1-b"
          ],
          "rect": "55,0 10 x 50"
        },
        {
          "panels": [
            "group-1-b",
            "group-1-c"
          ],
          "rect": "105,0 10 x 50"
        },
        {
          "panels": [
            "group-1-b",
            "group-1-c"
          ],
          "rect": "115,0 10 x 50"
        },
        {
          "panels": [
            "group-1-c",
            "group-1-d"
          ],
          "rect": "165,0 10 x 50"
        }
      ]"
    `)
  })

  test("CSS styles (e.g. padding and flex gap)", () => {
    const group = mockGroup(new DOMRect(0, 0, 190, 70))
    group.addPanel(new DOMRect(10, 10, 50, 40), "left")
    group.addPanel(new DOMRect(70, 10, 50, 40), "center")
    group.addPanel(new DOMRect(130, 10, 50, 40), "right")

    expect(serialize(group)).toMatchInlineSnapshot(`
      "[
        {
          "panels": [
            "group-1-left",
            "group-1-center"
          ],
          "rect": "60,10 10 x 40"
        },
        {
          "panels": [
            "group-1-center",
            "group-1-right"
          ],
          "rect": "120,10 10 x 40"
        }
      ]"
    `)
  })

  test("out of order children (e.g. dynamic rendering)", () => {
    const group = mockGroup(new DOMRect(0, 0, 150, 50))
    group.addPanel(new DOMRect(0, 0, 50, 50), "left")
    group.addPanel(new DOMRect(100, 0, 50, 50), "right")

    // Simulate conditionally rendering a new middle panel
    group.addPanel(new DOMRect(50, 0, 50, 50), "center")

    expect(serialize(group)).toMatchInlineSnapshot(`
      "[
        {
          "panels": [
            "group-1-left",
            "group-1-center"
          ],
          "rect": "45,0 10 x 50"
        },
        {
          "panels": [
            "group-1-center",
            "group-1-right"
          ],
          "rect": "95,0 10 x 50"
        }
      ]"
    `)
  })

  // Covers conditionally rendered panels and separators
  test("should sort elements and separators by offset", () => {
    const group = mockGroup(new DOMRect(0, 0, 260, 50))
    group.addPanel(new DOMRect(200, 0, 60, 50), "d")
    group.addPanel(new DOMRect(70, 0, 60, 50), "b")
    group.addPanel(new DOMRect(0, 0, 60, 50), "a")
    group.addPanel(new DOMRect(130, 0, 60, 50), "c")
    group.addSeparator(new DOMRect(190, 0, 10, 50), "right")
    group.addSeparator(new DOMRect(60, 0, 10, 50), "left")

    expect(serialize(group)).toMatchInlineSnapshot(`
      "[
        {
          "panels": [
            "group-1-a",
            "group-1-b"
          ],
          "rect": "60,0 10 x 50",
          "separator": "group-1-left"
        },
        {
          "panels": [
            "group-1-b",
            "group-1-c"
          ],
          "rect": "125,0 10 x 50"
        },
        {
          "panels": [
            "group-1-c",
            "group-1-d"
          ],
          "rect": "190,0 10 x 50",
          "separator": "group-1-right"
        }
      ]"
    `)
  })

  test("should disable a hit region if the separator is disabled", () => {
    const group = mockGroup(new DOMRect(0, 0, 100, 50))
    group.addPanel(new DOMRect(0, 0, 50, 50), "left")
    group.addSeparator(new DOMRect(50, 0, 5, 50), "separator", true)
    group.addPanel(new DOMRect(55, 0, 50, 50), "right")

    expect(serialize(group)).toMatchInlineSnapshot(`
      "[]"
    `)
  })

  test("should not disable a hit region if one or both panels are disabled but there is an enabled separator", () => {
    const group = mockGroup(new DOMRect(0, 0, 100, 50))
    group.addPanel(new DOMRect(0, 0, 50, 50), "left")
    group.addSeparator(new DOMRect(50, 0, 5, 50), "separator")
    group.addPanel(new DOMRect(55, 0, 50, 50), "center", { disabled: true })
    group.addPanel(new DOMRect(105, 0, 50, 50), "right")

    expect(serialize(group)).toMatchInlineSnapshot(`
        "[
          {
            "panels": [
              "group-1-left",
              "group-1-center"
            ],
            "rect": "47.5,0 10 x 50",
            "separator": "group-1-separator"
          },
          {
            "panels": [
              "group-1-center",
              "group-1-right"
            ],
            "rect": "100,0 10 x 50"
          }
        ]"
      `)
  })

  test("should disable all hit regions if there is one or fewer enabled panels", () => {
    {
      const group = mockGroup(new DOMRect(0, 0, 100, 50))
      group.addPanel(new DOMRect(0, 0, 50, 50), "left", { disabled: true })
      group.addPanel(new DOMRect(50, 0, 50, 50), "right")

      expect(serialize(group)).toMatchInlineSnapshot(`
        "[]"
      `)
    }

    {
      const group = mockGroup(new DOMRect(0, 0, 100, 50))
      group.addPanel(new DOMRect(0, 0, 50, 50), "left")
      group.addPanel(new DOMRect(50, 0, 50, 50), "right", { disabled: true })

      expect(serialize(group)).toMatchInlineSnapshot(`
        "[]"
      `)
    }

    {
      const group = mockGroup(new DOMRect(0, 0, 100, 50))
      group.addPanel(new DOMRect(0, 0, 50, 50), "left", { disabled: true })
      group.addPanel(new DOMRect(50, 0, 50, 50), "right", { disabled: true })

      expect(serialize(group)).toMatchInlineSnapshot(`
        "[]"
      `)
    }

    {
      const group = mockGroup(new DOMRect(0, 0, 100, 50))
      group.addPanel(new DOMRect(0, 0, 50, 50), "left")
      group.addSeparator(new DOMRect(50, 0, 5, 50), "separator")
      group.addPanel(new DOMRect(55, 0, 50, 50), "right", { disabled: true })

      expect(serialize(group)).toMatchInlineSnapshot(`
        "[]"
      `)
    }

    {
      const group = mockGroup(new DOMRect(0, 0, 100, 50))
      group.addPanel(new DOMRect(0, 0, 50, 50), "left", { disabled: true })
      group.addSeparator(new DOMRect(50, 0, 5, 50), "separator")
      group.addPanel(new DOMRect(55, 0, 50, 50), "right")

      expect(serialize(group)).toMatchInlineSnapshot(`
        "[]"
      `)
    }
  })

  test("should disable panel boundaries if there are no resizable panels before the current boundary", () => {
    const group = mockGroup(new DOMRect(0, 0, 100, 50))
    group.addPanel(new DOMRect(0, 0, 25, 50), "a", { disabled: true })
    group.addPanel(new DOMRect(25, 0, 25, 50), "b")
    group.addPanel(new DOMRect(50, 0, 25, 50), "c", { disabled: true })
    group.addPanel(new DOMRect(75, 0, 25, 50), "d")

    expect(serialize(group)).toMatchInlineSnapshot(`
      "[
        {
          "panels": [
            "group-1-b",
            "group-1-c"
          ],
          "rect": "45,0 10 x 50"
        },
        {
          "panels": [
            "group-1-c",
            "group-1-d"
          ],
          "rect": "70,0 10 x 50"
        }
      ]"
    `)
  })

  test("should disable panel boundaries if there are no resizable panels after the current boundary", () => {
    const group = mockGroup(new DOMRect(0, 0, 100, 50))
    group.addPanel(new DOMRect(0, 0, 25, 50), "a")
    group.addPanel(new DOMRect(25, 0, 25, 50), "b", { disabled: true })
    group.addPanel(new DOMRect(50, 0, 25, 50), "c")
    group.addPanel(new DOMRect(75, 0, 25, 50), "d", { disabled: true })

    expect(serialize(group)).toMatchInlineSnapshot(`
      "[
        {
          "panels": [
            "group-1-a",
            "group-1-b"
          ],
          "rect": "20,0 10 x 50"
        },
        {
          "panels": [
            "group-1-b",
            "group-1-c"
          ],
          "rect": "45,0 10 x 50"
        }
      ]"
    `)
  })

  test("ignores resize previews and overlay templates among the children", () => {
    const group = mockGroup(new DOMRect(0, 0, 100, 50))
    group.addPanel(new DOMRect(0, 0, 50, 50), "left")

    const preview = document.createElement("div")
    preview.setAttribute("data-resize-preview", "")
    group.element.appendChild(preview)

    const overlay = document.createElement("div")
    overlay.setAttribute("data-separator-overlay-source", "")
    group.element.appendChild(overlay)

    group.addPanel(new DOMRect(50, 0, 50, 50), "right")

    expect(serialize(group)).toMatchInlineSnapshot(`
      "[
        {
          "panels": [
            "group-1-left",
            "group-1-right"
          ],
          "rect": "45,0 10 x 50"
        }
      ]"
    `)
  })
})

describe("findMatchingHitRegions", () => {
  const unmounts = []

  function mount(group) {
    unmounts.push(mountGroup(group))
  }

  afterEach(() => {
    while (unmounts.length) unmounts.pop()()
  })

  function serialize(event, mountedGroups) {
    const hitRegions = findMatchingHitRegions(event, mountedGroups)

    return JSON.stringify(
      hitRegions.map(region => ({
        panels: region.panels.map(panel => panel.id),
        rect: `${region.rect.x},${region.rect.y} ${region.rect.width} x ${region.rect.height}`,
        separator: region.separator?.id
      })),
      null,
      2
    )
  }

  test("empty groups", () => {
    mount(mockGroup(new DOMRect(0, 0, 10, 50)))

    expect(serialize(mockPointerEvent(), getMountedGroups())).toMatchInlineSnapshot("\"[]\"")
  })

  test("group with no separator", () => {
    const group = mockGroup(new DOMRect(0, 0, 100, 50))
    group.addPanel(new DOMRect(0, 0, 50, 50), "left")
    group.addPanel(new DOMRect(50, 0, 50, 50), "right")
    mount(group)

    expect(serialize(mockPointerEvent({ clientX: 50 }), getMountedGroups()))
      .toMatchInlineSnapshot(`
        "[
          {
            "panels": [
              "group-1-left",
              "group-1-right"
            ],
            "rect": "45,0 10 x 50"
          }
        ]"
      `)
  })

  test("group with separator", () => {
    const group = mockGroup(new DOMRect(0, 0, 1200, 50))
    group.addPanel(new DOMRect(0, 0, 50, 50), "left")
    group.addSeparator(new DOMRect(50, 0, 20, 50), "separator")
    group.addPanel(new DOMRect(70, 0, 50, 50), "right")
    mount(group)

    expect(serialize(mockPointerEvent({ clientX: 60 }), getMountedGroups()))
      .toMatchInlineSnapshot(`
        "[
          {
            "panels": [
              "group-1-left",
              "group-1-right"
            ],
            "rect": "50,0 20 x 50",
            "separator": "group-1-separator"
          }
        ]"
      `)
  })

  test("nested groups", () => {
    const outerGroup = mockGroup(new DOMRect(0, 0, 100, 50))
    outerGroup.addPanel(new DOMRect(0, 0, 50, 50), "left")
    outerGroup.addPanel(new DOMRect(50, 0, 50, 50), "right")
    mount(outerGroup)

    const innerGroup = mockGroup(new DOMRect(0, 0, 50, 50), { orientation: "vertical" })
    innerGroup.addPanel(new DOMRect(0, 0, 50, 25), "top")
    innerGroup.addPanel(new DOMRect(0, 25, 50, 25), "bottom")
    mount(innerGroup)

    expect(serialize(mockPointerEvent({ clientX: 50, clientY: 25 }), getMountedGroups())).toMatchInlineSnapshot(`
      "[
        {
          "panels": [
            "group-1-left",
            "group-1-right"
          ],
          "rect": "45,0 10 x 50"
        },
        {
          "panels": [
            "group-2-top",
            "group-2-bottom"
          ],
          "rect": "0,20 50 x 10"
        }
      ]"
    `)
  })

  test("should skip disabled groups", () => {
    const group = mockGroup(new DOMRect(0, 0, 100, 50), { disabled: true })
    group.addPanel(new DOMRect(0, 0, 50, 50), "left")
    group.addPanel(new DOMRect(50, 0, 50, 50), "right")
    mount(group)

    expect(serialize(mockPointerEvent({ clientX: 50 }), getMountedGroups()))
      .toMatchInlineSnapshot(`
      "[]"
    `)
  })
})

describe("isViableHitTarget", () => {
  const hitRegion = new DOMRect(0, 0, 10, 10)

  afterEach(() => {
    document.body.innerHTML = ""
  })

  // jsdom supports neither showModal() nor the ":modal" pseudo-class.
  function mockModal(dialog, modal) {
    const matches = dialog.matches.bind(dialog)
    vi.spyOn(dialog, "matches").mockImplementation(selector => (selector === ":modal" ? modal : matches(selector)))
  }

  test("allows targets inside of the group", () => {
    const groupElement = document.createElement("div")
    const target = document.createElement("div")
    groupElement.appendChild(target)
    document.body.appendChild(groupElement)

    expect(isViableHitTarget({ groupElement, hitRegion, pointerEventTarget: target })).toBe(true)
  })

  test("ignores targets inside of a modal dialog that is inside of the group", () => {
    const groupElement = document.createElement("div")
    const dialog = document.createElement("dialog")
    const target = document.createElement("div")
    dialog.appendChild(target)
    groupElement.appendChild(dialog)
    document.body.appendChild(groupElement)

    mockModal(dialog, true)

    expect(isViableHitTarget({ groupElement, hitRegion, pointerEventTarget: target })).toBe(false)

    // The dialog itself (e.g. its ::backdrop) should also be ignored
    expect(isViableHitTarget({ groupElement, hitRegion, pointerEventTarget: dialog })).toBe(false)
  })

  test("ignores targets inside of a modal dialog that is outside of the group", () => {
    const groupElement = document.createElement("div")
    const dialog = document.createElement("dialog")
    const target = document.createElement("div")
    dialog.appendChild(target)
    document.body.appendChild(dialog)
    document.body.appendChild(groupElement)

    mockModal(dialog, true)

    expect(isViableHitTarget({ groupElement, hitRegion, pointerEventTarget: target })).toBe(false)
  })

  test("allows targets inside of a modal dialog that contains the group", () => {
    const dialog = document.createElement("dialog")
    const groupElement = document.createElement("div")
    const target = document.createElement("div")
    groupElement.appendChild(target)
    dialog.appendChild(groupElement)
    document.body.appendChild(dialog)

    mockModal(dialog, true)

    expect(isViableHitTarget({ groupElement, hitRegion, pointerEventTarget: target })).toBe(true)
  })

  test("allows targets inside of a non-modal dialog that is inside of the group", () => {
    const groupElement = document.createElement("div")
    const dialog = document.createElement("dialog")
    const target = document.createElement("div")
    dialog.appendChild(target)
    groupElement.appendChild(dialog)
    document.body.appendChild(groupElement)

    mockModal(dialog, false)

    expect(isViableHitTarget({ groupElement, hitRegion, pointerEventTarget: target })).toBe(true)
  })

  test("falls back to previous behavior if the :modal pseudo-class is not supported", () => {
    const groupElement = document.createElement("div")
    const dialog = document.createElement("dialog")
    const target = document.createElement("div")
    dialog.appendChild(target)
    groupElement.appendChild(dialog)
    document.body.appendChild(groupElement)

    // Older jsdom (and older browsers) throw for ":modal"; the jsdom used here
    // supports it, so the throw is simulated.
    const matches = dialog.matches.bind(dialog)
    vi.spyOn(dialog, "matches").mockImplementation(selector => {
      if (selector === ":modal") throw new SyntaxError("unsupported")
      return matches(selector)
    })
    expect(() => dialog.matches(":modal")).toThrow()

    expect(isViableHitTarget({ groupElement, hitRegion, pointerEventTarget: target })).toBe(true)
  })

  test("rejects a target painted over the hit region", () => {
    const groupElement = document.createElement("div")
    const overlay = document.createElement("div")
    document.body.appendChild(groupElement)
    document.body.appendChild(overlay)

    overlay.getBoundingClientRect = () => new DOMRect(0, 0, 20, 20)

    expect(isViableHitTarget({ groupElement, hitRegion, pointerEventTarget: overlay })).toBe(false)
  })

  test("allows a target painted elsewhere", () => {
    const groupElement = document.createElement("div")
    const overlay = document.createElement("div")
    document.body.appendChild(groupElement)
    document.body.appendChild(overlay)

    overlay.getBoundingClientRect = () => new DOMRect(50, 50, 20, 20)

    expect(isViableHitTarget({ groupElement, hitRegion, pointerEventTarget: overlay })).toBe(true)
  })
})
