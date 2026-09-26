import ResizableGroupElement from "./resizable_group"
import ResizablePanelElement from "./resizable_panel"
import ResizableSeparatorElement from "./resizable_separator"
import ResizableSeparatorOverlayElement from "./resizable_separator_overlay"

const ELEMENTS = {
  // The group comes first so that panels and separators upgrading in the same
  // pass find a parent that is ready to take their registration.
  "resizable-group": ResizableGroupElement,
  "resizable-panel": ResizablePanelElement,
  "resizable-separator": ResizableSeparatorElement,
  "resizable-separator-overlay": ResizableSeparatorOverlayElement
}

// Importing the library calls this for you. Defining a name twice throws, so an
// already-defined one is left alone and calling this more than once is harmless.
export function defineElements() {
  Object.entries(ELEMENTS).forEach(([ name, element ]) => {
    if (!customElements.get(name)) customElements.define(name, element)
  })
}
