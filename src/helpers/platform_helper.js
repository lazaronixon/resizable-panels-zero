let coarsePointer
let advancedCursorStyles

// A finger is far less precise than a mouse, so hit targets grow on devices
// whose primary pointer is coarse.
export function isCoarsePointer() {
  if (coarsePointer === undefined) {
    coarsePointer = typeof matchMedia === "function" && !!matchMedia("(pointer:coarse)").matches
  }

  return coarsePointer
}

// Safari renders the directional resize cursors (`e-resize`, `ns-resize`, …)
// inconsistently, so it gets the plainer `col-resize` family instead.
export function supportsAdvancedCursorStyles() {
  if (advancedCursorStyles === undefined) {
    const userAgent = globalThis.navigator?.userAgent ?? ""
    advancedCursorStyles = userAgent.includes("Chrome") || userAgent.includes("Firefox")
  }

  return advancedCursorStyles
}

export function overrideSupportsAdvancedCursorStylesForTesting(override) {
  advancedCursorStyles = override
}
