import { getInteractionState } from "../engine/interaction_state"
import { supportsAdvancedCursorStyles } from "../helpers/platform_helper"

// Set while a drag pushes a boundary past a limit, so the cursor can point the
// only way the boundary is still able to go.
export const CURSOR_FLAG_HORIZONTAL_MIN = 0b0001
export const CURSOR_FLAG_HORIZONTAL_MAX = 0b0010
export const CURSOR_FLAG_VERTICAL_MIN = 0b0100
export const CURSOR_FLAG_VERTICAL_MAX = 0b1000
export const CURSOR_FLAGS_HORIZONTAL = 0b0011
export const CURSOR_FLAGS_VERTICAL = 0b1100

const documentToStyleMap = new WeakMap()

export function getCursorStyle({ cursorFlags, groups, state }) {
  let horizontalCount = 0
  let verticalCount = 0

  if (state === "active" || state === "hover") {
    groups.forEach(group => {
      if (group.mutableState.disableCursor) return

      if (group.orientation === "horizontal") {
        horizontalCount++
      } else {
        verticalCount++
      }
    })
  }

  if (horizontalCount === 0 && verticalCount === 0) return undefined

  if (state === "active" && cursorFlags && supportsAdvancedCursorStyles()) {
    const horizontalMin = (cursorFlags & CURSOR_FLAG_HORIZONTAL_MIN) !== 0
    const horizontalMax = (cursorFlags & CURSOR_FLAG_HORIZONTAL_MAX) !== 0
    const verticalMin = (cursorFlags & CURSOR_FLAG_VERTICAL_MIN) !== 0
    const verticalMax = (cursorFlags & CURSOR_FLAG_VERTICAL_MAX) !== 0

    if (horizontalMin) {
      if (verticalMin) return "se-resize"
      if (verticalMax) return "ne-resize"
      return "e-resize"
    } else if (horizontalMax) {
      if (verticalMin) return "sw-resize"
      if (verticalMax) return "nw-resize"
      return "w-resize"
    } else if (verticalMin) {
      return "s-resize"
    } else if (verticalMax) {
      return "n-resize"
    }
  }

  if (supportsAdvancedCursorStyles()) {
    if (horizontalCount > 0 && verticalCount > 0) return "move"
    if (horizontalCount > 0) return "ew-resize"
    return "ns-resize"
  }

  if (horizontalCount > 0 && verticalCount > 0) return "grab"
  if (horizontalCount > 0) return "col-resize"
  return "row-resize"
}

// The cursor has to hold everywhere while dragging — over panel content, over
// an iframe, past the edge of the group — so it is forced on every element
// through one adopted stylesheet per document rather than set on the separator.
export function updateCursorStyle(ownerDocument) {
  // Missing in Safari before 16.4 and in jsdom; the cursor simply does not change.
  if (!ownerDocument.defaultView || !ownerDocument.adoptedStyleSheets) return

  let { prevStyle, styleSheet } = documentToStyleMap.get(ownerDocument) ?? {}

  if (styleSheet === undefined) {
    styleSheet = new ownerDocument.defaultView.CSSStyleSheet()

    if (Object.isExtensible(ownerDocument.adoptedStyleSheets)) {
      ownerDocument.adoptedStyleSheets.push(styleSheet)
    } else {
      ownerDocument.adoptedStyleSheets = [ ...ownerDocument.adoptedStyleSheets, styleSheet ]
    }
  }

  const interactionState = getInteractionState()

  if (interactionState.state === "inactive") {
    prevStyle = undefined
    if (styleSheet.cssRules.length === 1) styleSheet.deleteRule(0)
  } else {
    const cursorStyle = getCursorStyle({
      cursorFlags: interactionState.cursorFlags,
      groups: interactionState.hitRegions.map(current => current.group),
      state: interactionState.state
    })

    const nextStyle = `*, *:hover {cursor: ${cursorStyle} !important; }`
    if (prevStyle === nextStyle) return

    prevStyle = nextStyle

    if (cursorStyle) {
      if (styleSheet.cssRules.length === 0) {
        styleSheet.insertRule(nextStyle)
      } else {
        styleSheet.replaceSync(nextStyle)
      }
    } else if (styleSheet.cssRules.length === 1) {
      styleSheet.deleteRule(0)
    }
  }

  documentToStyleMap.set(ownerDocument, { prevStyle, styleSheet })
}
