import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { getImperativeGroupMethods, getImperativePanelMethods } from "src/engine/imperative_methods"
import { mockGroup, setDefaultElementStyle } from "./test_helper"
import { mountGroup } from "src/engine/mount_group"
import { subscribeToMountedGroup } from "src/engine/groups_state"

describe("getImperativeGroupMethods", () => {
  let removeChangeListener
  let unmountGroup
  let onGroupChange

  function init(panelConstraints) {
    const group = mockGroup(new DOMRect(0, 0, 1000, 50), { id: "group", orientation: "horizontal" })

    panelConstraints.forEach(current => {
      group.addPanel(
        new DOMRect(0, 0, typeof current.defaultSize === "number" ? current.defaultSize : 1000 / panelConstraints.length, 50),
        current.panelId,
        current
      )
    })

    unmountGroup = mountGroup(group)

    removeChangeListener = subscribeToMountedGroup("group", onGroupChange)

    return {
      api: getImperativeGroupMethods({ groupId: group.id }),
      group
    }
  }

  beforeEach(() => {
    onGroupChange = vi.fn()
  })

  afterEach(() => {
    removeChangeListener?.()
    removeChangeListener = undefined

    unmountGroup?.()
    unmountGroup = undefined
  })

  describe("getLayout", () => {
    test("throws if group not mounted", () => {
      expect(() => getImperativeGroupMethods({ groupId: "group" }).getLayout()).toThrowError("Could not find Group with id \"group\"")
    })

    test("returns the current group layout", () => {
      const { api } = init([ { defaultSize: 200 }, { defaultSize: 500 }, { defaultSize: 300 } ])

      expect(api.getLayout()).toMatchInlineSnapshot(`
        {
          "group-1": 20,
          "group-2": 50,
          "group-3": 30,
        }
      `)
    })
  })

  describe("setLayout", () => {
    test("matches constraints by panel ID regardless of layout key order", () => {
      const { api } = init([ { defaultSize: 500, minSize: 400 }, { defaultSize: 500 } ])

      api.setLayout({ "group-2": 80, "group-1": 20 })

      expect(api.getLayout()).toEqual({ "group-1": 40, "group-2": 60 })
    })

    test("throws if group not mounted", () => {
      expect(() => getImperativeGroupMethods({ groupId: "group" }).setLayout({})).toThrowError("Could not find Group with id \"group\"")
    })

    test("ignores a no-op layout update", () => {
      const { api } = init([ { defaultSize: 200 }, { defaultSize: 800 } ])
      api.setLayout({ "group-1": 20, "group-2": 80 })

      expect(onGroupChange).not.toHaveBeenCalled()
    })

    test("ignores an invalid layout update", () => {
      const { api } = init([ { defaultSize: 200, minSize: 200 }, { defaultSize: 800 } ])
      api.setLayout({ "group-1": 10, "group-2": 90 })

      expect(onGroupChange).not.toHaveBeenCalled()
    })

    test("validates and updates the group layout", () => {
      const { api } = init([ { defaultSize: 200, minSize: 100 }, { defaultSize: 800 } ])
      api.setLayout({ "group-1": 0, "group-2": 100 })

      expect(onGroupChange).toHaveBeenCalledTimes(1)
      expect(api.getLayout()).toMatchInlineSnapshot(`
        {
          "group-1": 10,
          "group-2": 90,
        }
      `)
    })

    test("allows disabled panels to be resized", () => {
      const { api } = init([ { defaultSize: 200, disabled: true, minSize: 100 }, { defaultSize: 800, disabled: true } ])

      expect(api.getLayout()).toMatchInlineSnapshot(`
        {
          "group-1": 20,
          "group-2": 80,
        }
      `)

      api.setLayout({ "group-1": 30, "group-2": 70 })

      expect(onGroupChange).toHaveBeenCalledTimes(1)
      expect(api.getLayout()).toMatchInlineSnapshot(`
        {
          "group-1": 30,
          "group-2": 70,
        }
      `)
    })
  })
})

describe("getImperativePanelMethods", () => {
  test.each([ [ "collapse" ], [ "expand" ], [ "getSize" ], [ "isCollapsed" ], [ "resize" ] ])("method %o: throws if group or panel not mounted", key => {
    const group = mockGroup(new DOMRect(), { id: "group", orientation: "horizontal" })

    const api = getImperativePanelMethods({ groupId: "group", panelId: "B" })

    expect(() => (key === "resize" ? api[key](1) : api[key]())).toThrow("Could not find Group with id \"group\"")

    const unmountGroup = mountGroup(group)

    expect(() => (key === "resize" ? api[key](1) : api[key]())).toThrow(/not found for Panel B/)

    unmountGroup()
  })

  describe("mounted", () => {
    let onLayoutChange
    let removeChangeListener
    let unmountGroup

    const originalInnerHeight = window.innerHeight
    const originalInnerWidth = window.innerWidth

    function init(panelConstraints) {
      const bounds = new DOMRect(0, 0, 1000, 50)
      const group = mockGroup(bounds, { id: "group", orientation: "horizontal" })

      panelConstraints.forEach(({ collapsedSize, collapsedThreshold, collapsible, defaultSize, disabled, maxSize, minSize }) => {
        group.addPanel(
          new DOMRect(0, 0, defaultSize !== undefined ? defaultSize * 10 : 1000 / panelConstraints.length, 50),
          undefined,
          {
            collapsedSize: collapsedSize !== undefined ? `${collapsedSize}%` : 0,
            collapsedThreshold: collapsedThreshold !== undefined ? `${collapsedThreshold}%` : undefined,
            collapsible,
            defaultSize: defaultSize !== undefined ? `${defaultSize}%` : undefined,
            disabled,
            maxSize: maxSize !== undefined ? `${maxSize}%` : undefined,
            minSize: minSize !== undefined ? `${minSize}%` : 0
          }
        )
      })

      unmountGroup = mountGroup(group)

      removeChangeListener = subscribeToMountedGroup("group", ({ next }) => {
        onLayoutChange(Object.values(next.layout))
      })

      return {
        group,
        panelApis: panelConstraints.map((_, index) => getImperativePanelMethods({ groupId: group.id, panelId: group.panels[index].id }))
      }
    }

    beforeEach(() => {
      onLayoutChange = vi.fn()
    })

    afterEach(() => {
      removeChangeListener?.()
      removeChangeListener = undefined

      unmountGroup?.()
      unmountGroup = undefined

      window.innerHeight = originalInnerHeight
      window.innerWidth = originalInnerWidth
    })

    describe("collapse", () => {
      test.each([ 20, 30 ])("collapses and restores a panel with threshold %s", collapsedThreshold => {
        const { panelApis } = init([
          { collapsedSize: 5, collapsedThreshold, collapsible: true, defaultSize: 25, minSize: 25 },
          {}
        ])

        panelApis[0].collapse()

        expect(panelApis[0].isCollapsed()).toBe(true)
        expect(onLayoutChange).toHaveBeenLastCalledWith([ 5, 95 ])

        panelApis[0].expand()

        expect(panelApis[0].isCollapsed()).toBe(false)
        expect(onLayoutChange).toHaveBeenLastCalledWith([ 25, 75 ])
      })

      test("does nothing if panel is not collapsible", () => {
        const { panelApis } = init([ {}, {} ])
        panelApis[0].collapse()

        expect(onLayoutChange).not.toHaveBeenCalled()
      })

      test("does nothing if panel is already collapsed", () => {
        const { panelApis } = init([ { defaultSize: 0, collapsible: true }, {} ])
        panelApis[0].collapse()

        expect(onLayoutChange).not.toHaveBeenCalled()
      })

      test("resizes panel to collapsed size", () => {
        const { panelApis } = init([ { defaultSize: 50, collapsible: true }, {} ])
        panelApis[0].collapse()

        expect(onLayoutChange).toHaveBeenCalledTimes(1)
        expect(onLayoutChange).toHaveBeenCalledWith([ 0, 100 ])
      })

      test("allows disabled panel to be collapsed", () => {
        const { panelApis } = init([ { collapsible: true, defaultSize: 50, disabled: true }, {} ])
        panelApis[0].collapse()

        expect(onLayoutChange).toHaveBeenCalledTimes(1)
        expect(onLayoutChange).toHaveBeenCalledWith([ 0, 100 ])
      })
    })

    describe("expand", () => {
      test("does nothing if panel is not collapsible", () => {
        const { panelApis } = init([ { defaultSize: 0 }, {} ])
        panelApis[0].expand()

        expect(onLayoutChange).not.toHaveBeenCalled()
      })

      test("does nothing if panel is not collapsed", () => {
        const { panelApis } = init([ { collapsible: true, defaultSize: 50 }, {} ])
        panelApis[0].expand()

        expect(onLayoutChange).not.toHaveBeenCalled()
      })

      test("expands the panel to the previous pre-collapse size", () => {
        const { panelApis } = init([ { collapsible: true, defaultSize: 50, minSize: 25 }, {} ])

        panelApis[0].resize("35")
        expect(onLayoutChange).toHaveBeenCalledTimes(1)
        expect(onLayoutChange).toHaveBeenLastCalledWith([ 35, 65 ])

        panelApis[0].collapse()
        expect(onLayoutChange).toHaveBeenCalledTimes(2)
        expect(onLayoutChange).toHaveBeenLastCalledWith([ 0, 100 ])

        panelApis[0].expand()
        expect(onLayoutChange).toHaveBeenCalledTimes(3)
        expect(onLayoutChange).toHaveBeenLastCalledWith([ 35, 65 ])
      })

      test("expands panel to the minimum size as a fallback", () => {
        const { panelApis } = init([ { collapsible: true, defaultSize: 0, minSize: 25 }, {} ])
        panelApis[0].expand()

        expect(onLayoutChange).toHaveBeenCalledTimes(1)
        expect(onLayoutChange).toHaveBeenCalledWith([ 25, 75 ])
      })

      // See github.com/bvaughn/react-resizable-panels/issues/561
      test("edge case: expands panel to a non-zero size if minSize is 0", () => {
        const { panelApis } = init([ { collapsible: true, defaultSize: 0, minSize: 0 }, {} ])
        panelApis[0].expand()

        expect(onLayoutChange).toHaveBeenCalledTimes(1)
        expect(onLayoutChange).toHaveBeenCalledWith([ 1, 99 ])
      })

      test("allows disabled panel to be expanded", () => {
        const { panelApis } = init([ { defaultSize: 0, collapsible: true, disabled: true, minSize: 10 }, {} ])

        panelApis[0].expand()
        expect(onLayoutChange).toHaveBeenCalledTimes(1)
        expect(onLayoutChange).toHaveBeenCalledWith([ 10, 90 ])
      })
    })

    describe("getSize", () => {
      test("returns the current panel size", () => {
        const { panelApis } = init([ { defaultSize: 25 }, { defaultSize: 75 } ])

        expect(panelApis[0].getSize()).toMatchInlineSnapshot(`
          {
            "asPercentage": 25,
            "inPixels": 250,
          }
        `)
        expect(panelApis[1].getSize()).toMatchInlineSnapshot(`
          {
            "asPercentage": 75,
            "inPixels": 750,
          }
        `)
      })
    })

    describe("isCollapsed", () => {
      test("returns true if collapsible and collapsed", () => {
        const { panelApis } = init([ { collapsible: true, collapsedSize: 10, defaultSize: 10 }, {} ])

        expect(panelApis[0].isCollapsed()).toBe(true)
      })

      test("returns false if collapsible and expanded", () => {
        const { panelApis } = init([ { collapsible: true, collapsedSize: 10, defaultSize: 25 }, {} ])

        expect(panelApis[0].isCollapsed()).toBe(false)
      })

      test("returns false if not collapsible", () => {
        const { panelApis } = init([ { defaultSize: 0 }, {} ])

        expect(panelApis[0].isCollapsed()).toBe(false)
      })
    })

    describe("resize", () => {
      describe("units", () => {
        test("accepts percentage units", () => {
          const { panelApis } = init([ {}, {} ])
          panelApis[0].resize("35%")

          expect(onLayoutChange).toHaveBeenCalledTimes(1)
          expect(onLayoutChange).toHaveBeenCalledWith([ 35, 65 ])
        })

        test("accepts pixel units", () => {
          // Computed group size is 1,000
          const { panelApis } = init([ {}, {} ])
          panelApis[0].resize(400)

          expect(onLayoutChange).toHaveBeenCalledTimes(1)
          expect(onLayoutChange).toHaveBeenCalledWith([ 40, 60 ])
        })

        test("accepts rem units", () => {
          setDefaultElementStyle({ fontSize: 16, writingMode: "" })

          const { panelApis } = init([ {}, {} ])
          panelApis[0].resize("10rem")

          expect(onLayoutChange).toHaveBeenCalledTimes(1)
          expect(onLayoutChange).toHaveBeenCalledWith([ 16, 84 ])
        })

        test("accepts viewport units", () => {
          window.innerHeight = 2000
          window.innerWidth = 2000

          const { panelApis } = init([ {}, {} ])
          panelApis[0].resize("15vw")

          expect(onLayoutChange).toHaveBeenCalledTimes(1)
          expect(onLayoutChange).toHaveBeenCalledWith([ 30, 70 ])
        })
      })

      test("ignores a no-op size update", () => {
        const { panelApis } = init([ { defaultSize: 10 }, {} ])
        panelApis[0].resize("10%")

        expect(onLayoutChange).not.toHaveBeenCalled()
      })

      test("ignores an invalid size update", () => {
        const { panelApis } = init([ { defaultSize: 10, minSize: 10 }, {} ])
        panelApis[0].resize("0%")

        expect(onLayoutChange).not.toHaveBeenCalled()
      })

      test("validates and updates the panel size", () => {
        const { panelApis } = init([ { defaultSize: 25, minSize: 10 }, {} ])
        panelApis[0].resize("0%")

        expect(onLayoutChange).toHaveBeenCalledTimes(1)
        expect(onLayoutChange).toHaveBeenCalledWith([ 10, 90 ])
      })

      test("allows disabled panel to be resized", () => {
        const { panelApis } = init([ { defaultSize: 25, disabled: true, minSize: 10 }, {} ])

        panelApis[0].resize("0%")

        expect(onLayoutChange).toHaveBeenCalledTimes(1)
        expect(onLayoutChange).toHaveBeenCalledWith([ 10, 90 ])
      })

      describe("edge cases", () => {
        test("does not throw when resizing the only panel in the group", () => {
          const { panelApis } = init([ { defaultSize: 100 } ])

          expect(() => panelApis[0].resize("50%")).not.toThrow()
          expect(onLayoutChange).not.toHaveBeenCalled()
        })

        test("last panel keeps the remainder when all preceding panels are collapsed and it is resized smaller", () => {
          const { panelApis } = init([
            { collapsible: true, defaultSize: 0, minSize: 20 },
            { collapsible: true, defaultSize: 0, minSize: 20 },
            { defaultSize: 100 }
          ])

          panelApis[2].resize("50%")

          // The last panel should remain at 100% (the remainder) rather than
          // cascading the freed space to the first panel.
          expect(onLayoutChange).not.toHaveBeenCalled()
        })

        test("last panel can still be resized normally when preceding panels are not all collapsed", () => {
          const { panelApis } = init([ { defaultSize: 30 }, { defaultSize: 30 }, { defaultSize: 40 } ])

          panelApis[2].resize("20%")

          expect(onLayoutChange).toHaveBeenCalledTimes(1)
          expect(onLayoutChange).toHaveBeenCalledWith([ 30, 50, 20 ])
        })
      })
    })
  })
})
