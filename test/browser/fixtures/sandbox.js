import { logEvents } from "./setup.js"

// The sandbox takes its markup from the spec, the way the React library's
// harness decodes a component tree from the URL, so each spec keeps the tree it
// is testing right next to its assertions.
globalThis.render = async function render(html, ownerDocument = document) {
  const root = ownerDocument.getElementById("root")

  globalThis.recordedEvents.length = 0

  if (ownerDocument === document) {
    root.innerHTML = html
  } else {
    const template = document.createElement("template")
    template.innerHTML = html
    root.replaceChildren(importUpgraded(template.content))
  }

  // Groups mount in a microtask; a task later every group has laid out.
  await new Promise(resolve => setTimeout(resolve))

  // Dialogs open once they are in the document, as the harness's Dialog does.
  root.querySelectorAll("dialog[data-open='modal']").forEach(dialog => dialog.showModal())
  root.querySelectorAll("dialog[data-open='show']").forEach(dialog => dialog.show())

  root.querySelectorAll("[data-clickable]").forEach(watchClicks)
}

// A copy of `node` whose custom elements are already upgraded. Elements made
// in a popup never upgrade on their own, because the elements are defined only
// in this window, so specs build any markup they add later through this.
function importUpgraded(node) {
  const copy = document.importNode(node, true)
  customElements.upgrade(copy)
  return copy
}

globalThis.importUpgraded = importUpgraded

// Mirrors the React library's PopupWindow: the groups live in another window
// while the library runs in this one, so anything that reaches for this
// window's `document` or `window` instead of the element's own shows up.
globalThis.openPopup = function openPopup() {
  const popup = window.open("", "", "width=1000,height=600,left=0,top=0")

  // The library's own rules are left behind on purpose: it has to install them
  // in the popup by itself.
  const style = popup.document.createElement("style")
  for (const styleSheet of document.styleSheets) {
    if (styleSheet.ownerNode?.id === "resizable-panels-zero-style") continue
    for (const rule of styleSheet.cssRules) style.textContent += `${rule.cssText}\n`
  }
  popup.document.head.append(style)

  const root = popup.document.createElement("div")
  root.id = "root"
  popup.document.body.append(root)

  popup.recordedEvents = globalThis.recordedEvents
  popup.render = html => globalThis.render(html, popup.document)
  popup.importUpgraded = importUpgraded
  logEvents(popup.document)

  addEventListener("beforeunload", () => popup.close())
}

// A stand-in for the harness's Clickable: counts the pointer events and clicks
// that reach it without having been claimed by the library.
function watchClicks(element) {
  const counts = { down: 0, up: 0, click: 0 }
  const paint = () => {
    element.textContent = `Clickable down:${counts.down} up:${counts.up} click:${counts.click}`
  }

  element.addEventListener("pointerdown", event => {
    if (!event.defaultPrevented) counts.down++
    paint()
  })
  element.addEventListener("pointerup", event => {
    if (!event.defaultPrevented) counts.up++
    paint()
  })
  element.addEventListener("click", event => {
    if (!event.defaultPrevented) counts.click++
    paint()
  })

  paint()
}
