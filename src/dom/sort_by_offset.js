// Orders panels and separators the way they appear on screen, which is what
// resizing cares about, even when CSS `order` has moved them away from their
// place in the markup.
export function sortByElementOffset(orientation, panelsOrSeparators) {
  return Array.from(panelsOrSeparators).sort((a, b) => {
    const delta = orientation === "horizontal" ? horizontalSort(a, b) : verticalSort(a, b)
    if (delta !== 0) return delta

    // jsdom and hidden elements report identical offsets and sizes, so fall back
    // to document order rather than to whatever order they registered in.
    const position = a.element.compareDocumentPosition(b.element)
    if (position & Node.DOCUMENT_POSITION_DISCONNECTED) return 0
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1

    return 0
  })
}

function horizontalSort(a, b) {
  const delta = a.element.offsetLeft - b.element.offsetLeft
  if (delta !== 0) return delta
  return a.element.offsetWidth - b.element.offsetWidth
}

function verticalSort(a, b) {
  const delta = a.element.offsetTop - b.element.offsetTop
  if (delta !== 0) return delta
  return a.element.offsetHeight - b.element.offsetHeight
}
