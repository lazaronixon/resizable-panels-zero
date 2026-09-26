let idCounter = 0

// Panels need an id to key the layout by, so one is made up when the markup
// leaves it out. A made-up id depends on the order elements connect in, so set
// ids yourself when a saved layout has to survive changes to the page.
export function uniqueId(prefix) {
  let id
  do {
    id = `${prefix}-${++idCounter}`
  } while (document.getElementById(id))

  return id
}

// These check `nodeType` rather than `instanceof` so that elements from another
// window — an iframe or a popup the group lives in — are recognised too.
export function isHTMLElement(value) {
  return value !== null && typeof value === "object" && "nodeType" in value && value.nodeType === Node.ELEMENT_NODE
}

export function isShadowRoot(value) {
  return value !== null && typeof value === "object" && "nodeType" in value && value.nodeType === Node.DOCUMENT_FRAGMENT_NODE
}

// `:modal` is missing from older engines and from jsdom, where it throws.
export function isModal(element) {
  try {
    return element.matches(":modal")
  } catch {
    return false
  }
}

export function doRectsIntersect(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

export function getDistanceBetweenPointAndRect(point, rect) {
  return {
    x: point.x >= rect.left && point.x <= rect.right
      ? 0
      : Math.min(Math.abs(point.x - rect.left), Math.abs(point.x - rect.right)),
    y: point.y >= rect.top && point.y <= rect.bottom
      ? 0
      : Math.min(Math.abs(point.y - rect.top), Math.abs(point.y - rect.bottom))
  }
}
