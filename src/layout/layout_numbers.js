// Every layout is a map of panel id to a percentage between 0 and 100, kept to
// three decimals. Comparing at that precision stops floating-point noise from
// looking like a real change and triggering another round of events.
export function formatLayoutNumber(number) {
  return parseFloat(number.toFixed(3))
}

export function layoutNumbersEqual(actual, expected, minimumDelta = 0) {
  return Math.abs(formatLayoutNumber(actual) - formatLayoutNumber(expected)) <= minimumDelta
}

export function compareLayoutNumbers(actual, expected) {
  if (layoutNumbersEqual(actual, expected)) return 0
  return actual > expected ? 1 : -1
}

export function layoutsEqual(a, b) {
  if (Object.keys(a).length !== Object.keys(b).length) return false

  for (const id in a) {
    // A panel whose id changed shows up as a key missing from the other side.
    if (b[id] === undefined || compareLayoutNumbers(a[id], b[id]) !== 0) return false
  }

  return true
}

export function isArrayEqual(a, b) {
  if (a.length !== b.length) return false

  for (let index = 0; index < a.length; index++) {
    if (a[index] != b[index]) return false
  }

  return true
}

export function objectsEqual(a, b) {
  if (Object.keys(a).length !== Object.keys(b).length) return false

  for (const key in a) {
    if (a[key] !== b[key]) return false
  }

  return true
}

export function panelConstraintsEqual(a, b) {
  if (a.length !== b.length) return false
  return a.every((current, index) => objectsEqual(current, b[index]))
}
