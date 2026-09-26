// Watches for layout shift from the very first paint, which is what a layout
// restored or applied too late would cause. Load it as a classic script at the
// top of `head`, so it is watching before anything renders. Only Chromium
// reports layout shift.
globalThis.layoutShift = 0

if (globalThis.PerformanceObserver?.supportedEntryTypes?.includes("layout-shift")) {
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) globalThis.layoutShift += entry.value
    }
  }).observe({ type: "layout-shift", buffered: true })
}
