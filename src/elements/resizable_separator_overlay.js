// A template for the previews shown in separator preview mode. Placed in a
// group it styles every preview; placed in a separator it styles that one.
// It is never shown where it is written; each preview gets a copy, marked
// `data-separator-overlay="active"` for the boundary being dragged and
// `"inactive"` for the ones pushed along with it.
export default class ResizableSeparatorOverlayElement extends HTMLElement {
  connectedCallback() {
    const parent = this.parentElement?.localName
    this.toggleAttribute("data-separator-overlay-source", parent === "resizable-group" || parent === "resizable-separator")
  }
}
