const contentSources = new WeakMap()

// Paints one sliding preview in separator preview mode. The content is copied
// when the preview first appears, and again only when `rebuild` is set — the
// group asks for that when an overlay changes mid-drag. Otherwise just the
// position and active state change as the pointer moves.
//
// The content is, in order of preference: a copy of the separator's own
// <resizable-separator-overlay>, a copy of the group's, or a faded snapshot of
// the separator itself.
export function renderPreview(element, preview, groupOverlay, rebuild = false) {
  const { group, offset, rect, separator } = preview
  const horizontal = group.orientation === "horizontal"

  if (!element.hasAttribute("data-resize-preview")) {
    element.setAttribute("data-resize-preview", "")
    element.setAttribute("aria-hidden", "true")
    element.inert = true
    rebuild = true
  }

  if (rebuild) {
    const overlay = separator?.element.querySelector(":scope > resizable-separator-overlay") ?? groupOverlay
    const source = overlay ?? separator?.element

    // A snapshot of the separator itself is costly and never goes stale during
    // a drag, so it is kept; an overlay is copied again.
    if (overlay || contentSources.get(element) !== source) {
      element.replaceChildren()
      if (overlay) {
        element.append(cloneOverlay(overlay))
      } else if (separator) {
        element.append(cloneSeparator(separator.element))
      }

      contentSources.set(element, source)
    }
  }

  element.style.left = `${rect.left}px`
  element.style.top = `${rect.top}px`
  element.style.width = `${rect.width}px`
  element.style.height = `${rect.height}px`
  element.style.transform = horizontal ? `translateX(${offset}px)` : `translateY(${offset}px)`

  const content = element.firstElementChild
  if (content?.localName === "resizable-separator-overlay") {
    content.setAttribute("data-separator-overlay", preview.active ? "active" : "inactive")
  }
}

function cloneOverlay(overlay) {
  const clone = overlay.cloneNode(true)
  clone.removeAttribute("data-separator-overlay-source")
  clone.removeAttribute("id")
  return clone
}

// The copy is a plain element with the separator's attributes and every
// computed style written inline, so it looks and matches like the separator
// without being one — no role, no focus, no registration with a group.
function cloneSeparator(source) {
  const ownerWindow = source.ownerDocument.defaultView

  const clone = source.ownerDocument.createElement("div")
  for (const { name, value } of Array.from(source.attributes)) {
    if (name === "id" || name === "role" || name === "tabindex" || name.startsWith("aria-")) continue
    clone.setAttribute(name, value)
  }

  clone.append(...Array.from(source.childNodes, node => node.cloneNode(true)))

  const sources = [ source, ...source.querySelectorAll("*") ]
  const targets = [ clone, ...clone.querySelectorAll("*") ]

  sources.forEach((sourceElement, index) => {
    const target = targets[index]
    const computed = ownerWindow.getComputedStyle(sourceElement)

    for (let propertyIndex = 0; propertyIndex < computed.length; propertyIndex++) {
      const property = computed.item(propertyIndex)
      target.style.setProperty(property, computed.getPropertyValue(property))
    }

    target.removeAttribute("id")
  })

  Object.assign(clone.style, {
    boxSizing: "border-box",
    height: "100%",
    margin: "0",
    position: "static",
    transform: "none",
    width: "100%"
  })

  const wrapper = source.ownerDocument.createElement("div")
  wrapper.setAttribute("data-separator-clone", "")
  wrapper.append(clone)

  return wrapper
}
