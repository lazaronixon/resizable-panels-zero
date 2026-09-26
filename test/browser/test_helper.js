import { test as base } from "@playwright/test"
import { GroupHandle } from "./helpers/group_handle.js"

export const test = base.extend({
  // The viewport the React library's specs were written against; many of the
  // expected percentages depend on it.
  viewport: { width: 1000, height: 600 },

  group: async ({ page, browserName }, use) => {
    await use(new GroupHandle(page, browserName))
  }
})

export { expect } from "@playwright/test"
