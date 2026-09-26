// Every event the elements dispatch, in order, so specs can count them the way
// the React library's test harness counts callback invocations.
globalThis.recordedEvents = []

function record(type, event) {
  globalThis.recordedEvents.push({ type, id: event.target.id, detail: event.detail })
}

// Events bubble only as far as their own document, so a popup gets listeners of
// its own that record into this window's list.
export function logEvents(ownerDocument) {
  ownerDocument.addEventListener("resizable-group:layout-change", event => record("layout-change", event))
  ownerDocument.addEventListener("resizable-group:layout-changed", event => record("layout-changed", event))
  ownerDocument.addEventListener("resizable-panel:resize", event => record("resize", event))
}

logEvents(document)
