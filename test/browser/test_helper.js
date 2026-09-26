import { test as base } from "@playwright/test"
import { GroupHandle } from "./helpers/group_handle.js"

export const test = base.extend({
  // The viewport the React library's specs were written against; many of the
  // expected percentages depend on it.
  viewport: { width: 1000, height: 600 },

  // Set by the popup project: every spec then runs against groups that live in
  // a popup window while the library runs in the page that opened it, as the
  // React library's "chromium: popup" project does.
  usePopupWindow: [ false, { option: true } ],

  page: async ({ page, usePopupWindow }, use) => {
    if (!usePopupWindow) {
      await use(page)
      return
    }

    await page.goto("/sandbox.html")
    await page.waitForFunction(() => typeof globalThis.openPopup === "function")

    const [ popup ] = await Promise.all([
      page.waitForEvent("popup"),
      page.evaluate(() => globalThis.openPopup())
    ])
    await popup.setViewportSize({ width: 1000, height: 600 })

    await use(popup)
  },

  group: async ({ page, browserName, usePopupWindow }, use) => {
    await use(new GroupHandle(page, browserName, { popup: usePopupWindow }))
  }
})

export { expect } from "@playwright/test"
