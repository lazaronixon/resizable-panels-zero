const STYLE_ELEMENT_ID = "resizable-panels-zero-style"

// These rules are the machinery: the layout math assumes a flex row or column
// whose panels are sized by `flex-grow` alone, and it does not work without
// them. That is why they ship with the script instead of with the theme —
// forgetting a stylesheet should leave the separators looking plain, not leave
// the panels stacked on top of each other.
//
// The declarations marked `!important` are the ones the React library forces
// no matter what the page says: padding, a border or a fixed size on a panel,
// or a separator allowed to grow, would throw every percentage off.
const RULES = `
resizable-group { display: flex !important; flex-direction: row !important; flex-wrap: nowrap !important; width: 100%; height: 100%; overflow: hidden; touch-action: pan-y !important; }

resizable-group[orientation="vertical"] { flex-direction: column !important; touch-action: pan-x !important; }

resizable-group[resize-preview-mode="separator"] { position: relative; }

/* The panel is the flex item and the scroll container in one; put padding on
   the content inside it. */
resizable-panel { display: block; flex-basis: 0; flex-shrink: 1; overflow: auto; box-sizing: border-box; min-width: 0 !important; min-height: 0 !important; max-width: 100% !important; max-height: 100% !important; width: auto !important; height: auto !important; padding: 0 !important; margin: 0 !important; border: none !important; border-width: 0 !important; }

/* Panels can still scroll along the axis the group does not resize. */
resizable-group > resizable-panel { touch-action: pan-y !important; }

resizable-group[orientation="vertical"] > resizable-panel { touch-action: pan-x !important; }

resizable-separator { display: block; flex-basis: auto; flex-grow: 0 !important; flex-shrink: 0 !important; touch-action: none !important; }

resizable-group:not([disable-cursor]) > resizable-separator[disabled] { cursor: not-allowed; }

/* An overlay declared in the markup is only a template for the previews. */
resizable-separator-overlay[data-separator-overlay-source] { display: none !important; }

[data-resize-preview] { position: absolute; pointer-events: none !important; }

/* Zero specificity, so a class on the overlay can size it. */
:where(resizable-group > [data-resize-preview] > [data-separator-overlay]) { display: block; height: 100%; min-width: 1px; }

:where(resizable-group[orientation="vertical"] > [data-resize-preview] > [data-separator-overlay]) { height: auto; width: 100%; min-width: 0; min-height: 1px; }

[data-resize-preview] > [data-separator-overlay] { flex-shrink: 0 !important; pointer-events: none !important; }

[data-resize-preview] > [data-separator-clone] { height: 100%; width: 100%; opacity: 0.65; pointer-events: none !important; }
`

// The tag goes first in `head` so everything the page loads — the theme
// included — comes later in the cascade and wins a specificity tie. The few
// declarations that must hold regardless carry `!important` above. Each
// document needs its own copy, since a group can live in an iframe or popup.
export function installStyles(ownerDocument, nonce) {
  if (ownerDocument.getElementById(STYLE_ELEMENT_ID)) return

  const element = ownerDocument.createElement("style")
  element.id = STYLE_ELEMENT_ID
  if (nonce) element.setAttribute("nonce", nonce)
  element.textContent = RULES

  ownerDocument.head.prepend(element)
}
