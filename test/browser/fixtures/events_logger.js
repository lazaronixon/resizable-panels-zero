// Every event the elements dispatch, in order, so specs can count them the way
// the React library's test harness counts callback invocations.
globalThis.recordedEvents = []

function record(type, event) {
  globalThis.recordedEvents.push({ type, id: event.target.id, detail: event.detail })
}

document.addEventListener("resizable-group:layout-change", event => record("layout-change", event))
document.addEventListener("resizable-group:layout-changed", event => record("layout-changed", event))
document.addEventListener("resizable-panel:resize", event => record("resize", event))
