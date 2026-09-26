import {
  CURSOR_FLAG_HORIZONTAL_MAX,
  CURSOR_FLAG_HORIZONTAL_MIN,
  CURSOR_FLAG_VERTICAL_MAX,
  CURSOR_FLAG_VERTICAL_MIN,
  getCursorStyle,
  updateCursorStyle
} from "src/cursor/cursor_style"
import { afterAll, afterEach, beforeEach, describe, expect, test } from "vitest"
import { mockGroup } from "./test_helper"
import { overrideSupportsAdvancedCursorStylesForTesting } from "src/helpers/platform_helper"
import { updateInteractionState } from "src/engine/interaction_state"

describe("getCursorStyle", () => {
  const horizontalGroup = mockGroup(new DOMRect(0, 0, 100, 50), { orientation: "horizontal" })
  horizontalGroup.addPanel(new DOMRect(0, 0, 50, 50))
  horizontalGroup.addPanel(new DOMRect(50, 0, 50, 50))

  const verticalGroup = mockGroup(new DOMRect(0, 0, 100, 50), { orientation: "vertical" })
  verticalGroup.addPanel(new DOMRect(0, 0, 50, 50))
  verticalGroup.addPanel(new DOMRect(50, 0, 50, 50))

  const disabledGroup = mockGroup(new DOMRect(0, 0, 100, 50))
  disabledGroup.mutableState.disableCursor = true
  disabledGroup.addPanel(new DOMRect(0, 0, 50, 50))
  disabledGroup.addPanel(new DOMRect(50, 0, 50, 50))

  afterAll(() => {
    overrideSupportsAdvancedCursorStylesForTesting(undefined)
  })

  describe("advanced cursor style support", () => {
    beforeEach(() => {
      overrideSupportsAdvancedCursorStylesForTesting(true)
    })

    describe("state: inactive", () => {
      test("should return null", () => {
        expect(getCursorStyle({ cursorFlags: 0, groups: [ horizontalGroup, verticalGroup ], state: "inactive" })).toBeUndefined()
      })
    })

    describe("state: hover", () => {
      test("horizontal", () => {
        expect(getCursorStyle({ cursorFlags: 0, groups: [ horizontalGroup ], state: "hover" })).toBe("ew-resize")
      })

      test("vertical", () => {
        expect(getCursorStyle({ cursorFlags: 0, groups: [ verticalGroup ], state: "hover" })).toBe("ns-resize")
      })

      test("horizontal and vertical", () => {
        expect(getCursorStyle({ cursorFlags: 0, groups: [ horizontalGroup, verticalGroup ], state: "hover" })).toBe("move")
      })

      test("cursor flags should be ignored", () => {
        expect(getCursorStyle({ cursorFlags: CURSOR_FLAG_HORIZONTAL_MAX, groups: [ horizontalGroup ], state: "hover" })).toBe("ew-resize")
      })

      test("disabled groups", () => {
        expect(getCursorStyle({ cursorFlags: 0, groups: [ disabledGroup ], state: "hover" })).toBeUndefined()
      })
    })

    describe("state: active", () => {
      test("horizontal", () => {
        expect(getCursorStyle({ cursorFlags: 0, groups: [ horizontalGroup ], state: "active" })).toBe("ew-resize")
      })

      test("vertical", () => {
        expect(getCursorStyle({ cursorFlags: 0, groups: [ verticalGroup ], state: "active" })).toBe("ns-resize")
      })

      test("horizontal and vertical", () => {
        expect(getCursorStyle({ cursorFlags: 0, groups: [ horizontalGroup, verticalGroup ], state: "active" })).toBe("move")
      })

      test.each([
        [ CURSOR_FLAG_HORIZONTAL_MIN, "e-resize" ],
        [ CURSOR_FLAG_HORIZONTAL_MIN | CURSOR_FLAG_VERTICAL_MIN, "se-resize" ],
        [ CURSOR_FLAG_HORIZONTAL_MIN | CURSOR_FLAG_VERTICAL_MAX, "ne-resize" ],
        [ CURSOR_FLAG_HORIZONTAL_MAX, "w-resize" ],
        [ CURSOR_FLAG_HORIZONTAL_MAX | CURSOR_FLAG_VERTICAL_MIN, "sw-resize" ],
        [ CURSOR_FLAG_HORIZONTAL_MAX | CURSOR_FLAG_VERTICAL_MAX, "nw-resize" ],
        [ CURSOR_FLAG_VERTICAL_MIN, "s-resize" ],
        [ CURSOR_FLAG_VERTICAL_MAX, "n-resize" ]
      ])("cursor flags: %i -> %s", (cursorFlags, expected) => {
        expect(getCursorStyle({ cursorFlags, groups: [ horizontalGroup, verticalGroup ], state: "active" })).toBe(expected)
      })

      test("disabled groups", () => {
        expect(getCursorStyle({ cursorFlags: 0, groups: [ disabledGroup ], state: "active" })).toBeUndefined()
      })
    })
  })

  describe("basic cursor style support", () => {
    beforeEach(() => {
      overrideSupportsAdvancedCursorStylesForTesting(false)
    })

    describe("state: inactive", () => {
      test("should return null", () => {
        expect(getCursorStyle({ cursorFlags: 0, groups: [ horizontalGroup, verticalGroup ], state: "inactive" })).toBeUndefined()
      })
    })

    describe("state: hover", () => {
      test("horizontal", () => {
        expect(getCursorStyle({ cursorFlags: 0, groups: [ horizontalGroup ], state: "hover" })).toBe("col-resize")
      })

      test("vertical", () => {
        expect(getCursorStyle({ cursorFlags: 0, groups: [ verticalGroup ], state: "hover" })).toBe("row-resize")
      })

      test("horizontal and vertical", () => {
        expect(getCursorStyle({ cursorFlags: 0, groups: [ horizontalGroup, verticalGroup ], state: "hover" })).toBe("grab")
      })

      test("cursor flags should be ignored", () => {
        expect(getCursorStyle({ cursorFlags: CURSOR_FLAG_HORIZONTAL_MAX, groups: [ horizontalGroup ], state: "hover" })).toBe("col-resize")
      })

      test("disabled groups", () => {
        expect(getCursorStyle({ cursorFlags: 0, groups: [ disabledGroup ], state: "hover" })).toBeUndefined()
      })
    })

    describe("state: active", () => {
      test("horizontal", () => {
        expect(getCursorStyle({ cursorFlags: 0, groups: [ horizontalGroup ], state: "active" })).toBe("col-resize")
      })

      test("vertical", () => {
        expect(getCursorStyle({ cursorFlags: 0, groups: [ verticalGroup ], state: "active" })).toBe("row-resize")
      })

      test("horizontal and vertical", () => {
        expect(getCursorStyle({ cursorFlags: 0, groups: [ horizontalGroup, verticalGroup ], state: "active" })).toBe("grab")
      })

      test.each([
        [ CURSOR_FLAG_HORIZONTAL_MIN, "grab" ],
        [ CURSOR_FLAG_HORIZONTAL_MIN | CURSOR_FLAG_VERTICAL_MIN, "grab" ],
        [ CURSOR_FLAG_HORIZONTAL_MIN | CURSOR_FLAG_VERTICAL_MAX, "grab" ],
        [ CURSOR_FLAG_HORIZONTAL_MAX, "grab" ],
        [ CURSOR_FLAG_HORIZONTAL_MAX | CURSOR_FLAG_VERTICAL_MIN, "grab" ],
        [ CURSOR_FLAG_HORIZONTAL_MAX | CURSOR_FLAG_VERTICAL_MAX, "grab" ],
        [ CURSOR_FLAG_VERTICAL_MIN, "grab" ],
        [ CURSOR_FLAG_VERTICAL_MAX, "grab" ]
      ])("cursor flags: %i -> %s", (cursorFlags, expected) => {
        expect(getCursorStyle({ cursorFlags, groups: [ horizontalGroup, verticalGroup ], state: "active" })).toBe(expected)
      })

      test("disabled groups", () => {
        expect(getCursorStyle({ cursorFlags: 0, groups: [ disabledGroup ], state: "active" })).toBeUndefined()
      })
    })
  })
})

describe("updateCursorStyle", () => {
  const originalCSSStyleSheet = window.CSSStyleSheet
  const originalAdoptedStyleSheets = Object.getOwnPropertyDescriptor(Document.prototype, "adoptedStyleSheets")

  afterEach(() => {
    window.CSSStyleSheet = originalCSSStyleSheet
    if (originalAdoptedStyleSheets) {
      Object.defineProperty(Document.prototype, "adoptedStyleSheets", originalAdoptedStyleSheets)
    } else {
      delete Document.prototype.adoptedStyleSheets
    }
    updateInteractionState({ cursorFlags: 0, state: "inactive" })
  })

  test("should not throw if the environment doesn't support constructable stylesheets", () => {
    // e.g. Safari < 16.4, where `new CSSStyleSheet()` throws "TypeError: Illegal constructor".
    window.CSSStyleSheet = class CSSStyleSheet {
      constructor() {
        throw new TypeError("Illegal constructor")
      }
    }
    Object.defineProperty(Document.prototype, "adoptedStyleSheets", {
      configurable: true,
      get() {
        return undefined
      }
    })

    updateInteractionState({ cursorFlags: 0, state: "hover", hitRegions: [] })

    expect(() => updateCursorStyle(document)).not.toThrow()
  })

  test("should apply cursor styles when constructable stylesheets are supported", () => {
    const styleSheet = new CSSStyleSheet()
    Object.defineProperty(Document.prototype, "adoptedStyleSheets", {
      configurable: true,
      value: [ styleSheet ]
    })

    updateInteractionState({ cursorFlags: 0, state: "hover", hitRegions: [] })

    updateCursorStyle(document)

    expect(document.adoptedStyleSheets).toContain(styleSheet)
  })
})
