import { afterEach, beforeEach, vi } from "vitest"

// As in the React library's test setup, a warning or error nobody asked for
// fails the test. A test that expects one spies on the console itself, which
// replaces this spy's implementation for that test.
let unexpected = []

beforeEach(() => {
  unexpected = []

  for (const method of [ "warn", "error" ]) {
    vi.spyOn(console, method).mockImplementation((...args) => {
      unexpected.push(`console.${method}: ${args.map(String).join(" ")}`)
    })
  }
})

afterEach(() => {
  console.warn.mockRestore?.()
  console.error.mockRestore?.()

  if (unexpected.length > 0) {
    throw new Error(`Unexpected console output:\n${unexpected.join("\n")}`)
  }
})
