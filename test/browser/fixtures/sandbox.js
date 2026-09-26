import "./setup.js"

// The sandbox takes its markup from the spec, the way the React library's
// harness decodes a component tree from the URL, so each spec keeps the tree it
// is testing right next to its assertions.
globalThis.render = async function render(html) {
  const root = document.getElementById("root")

  globalThis.recordedEvents.length = 0
  root.innerHTML = html

  // Groups mount in a microtask; a task later every group has laid out.
  await new Promise(resolve => setTimeout(resolve))

  // Dialogs open once they are in the document, as the harness's Dialog does.
  root.querySelectorAll("dialog[data-open='modal']").forEach(dialog => dialog.showModal())
  root.querySelectorAll("dialog[data-open='show']").forEach(dialog => dialog.show())

  root.querySelectorAll("[data-clickable]").forEach(watchClicks)
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
