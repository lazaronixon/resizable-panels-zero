import { expect, test } from "../test_helper.js"

// Only Chromium reports layout shift.
async function expectNoLayoutShift(page, browserName) {
  if (browserName !== "chromium") return

  await page.waitForTimeout(250)
  expect(await page.evaluate(() => globalThis.layoutShift)).toBe(0)
}

// Ports the React library's default-layout specs, which drive its
// useDefaultLayout hook in three apps: a client-rendered one saving to
// localStorage, a server-rendered one saving to a cookie, and one using server
// components, where the server renders the saved layout as defaultLayout. The
// `autosave`, `storage` and `default-layout` attributes do those jobs here.
//
// The tests that load a page of their own have no popup variant, like the React
// library's default-layout specs.
const SKIP_IN_POPUP = "loads a page of its own"

test.describe("autosave", () => {
  test("restores a saved layout after a reload without layout shift", async ({ group, page, browserName, usePopupWindow }) => {
    test.skip(usePopupWindow, SKIP_IN_POPUP)

    await page.goto("/autosave.html")
    await page.evaluate(() => localStorage.clear())
    await page.reload()

    await group.expectLayout({ top: 50, bottom: 50 }, "group-two")
    await expectNoLayoutShift(page, browserName)

    // Default sizes in every unit paint at their size from the start.
    await group.expectLayout({ "size-percent-right": 25 }, "size-percent")
    await group.expectLayout({ "size-zero-right": 0 }, "size-zero")
    for (const [ groupId, pixels ] of [ [ "size-px", 100 ], [ "size-vw", 250 ], [ "size-rem", 240 ] ]) {
      await expect.poll(async () => Math.round((await group.box(`${groupId}-right`)).width)).toBe(pixels)
    }

    await group.resize([ "top", "bottom" ], 0, -25)

    const saved = await group.layout("group-two")
    expect(saved.top).toBeLessThan(50)

    await page.reload({ waitUntil: "domcontentloaded" })

    await group.expectLayout(saved, "group-two")
    expect(await page.evaluate(() => localStorage.getItem("resizable-panels-zero:group-two:top:bottom"))).not.toBeNull()
    await expectNoLayoutShift(page, browserName)
  })

  test("restores a layout saved through a custom storage without layout shift", async ({ group, page, browserName, usePopupWindow }) => {
    test.skip(usePopupWindow, SKIP_IN_POPUP)

    await page.context().clearCookies()
    await page.goto("/cookie_storage.html")
    await page.evaluate(() => localStorage.clear())

    await group.expectLayout({ top: 50, bottom: 50 }, "group-two")
    await expectNoLayoutShift(page, browserName)

    await group.resize([ "top", "bottom" ], 0, -25)

    const saved = await group.layout("group-two")
    expect(saved.top).toBeLessThan(50)

    const key = encodeURIComponent("resizable-panels-zero:group-two:top:bottom")
    await expect.poll(() => page.evaluate(() => document.cookie)).toContain(`${key}=`)
    expect(await page.evaluate(() => localStorage.length)).toBe(0)

    await page.reload({ waitUntil: "domcontentloaded" })

    await group.expectLayout(saved, "group-two")
    await expectNoLayoutShift(page, browserName)
  })

  test("paints a default layout from the markup without layout shift", async ({ group, page, browserName, usePopupWindow }) => {
    test.skip(usePopupWindow, SKIP_IN_POPUP)

    await page.goto("/default_layout.html")

    await group.expectLayout({ left: 20, center: 30, right: 50 }, "group-one")
    await group.expectLayout({ top: 30, bottom: 70 }, "group-two")

    // It is the first layout the group reports, not one it moves to later.
    const [ first ] = await group.events("layout-change", "group-two")
    expect(first.detail.layout).toEqual({ top: 30, bottom: 70 })

    await expectNoLayoutShift(page, browserName)
  })

  test("autosave-user-only skips layouts the user did not cause", async ({ group, page }) => {
    await group.render(`
      <resizable-group id="group" autosave="user-only" autosave-user-only>
        <resizable-panel id="left"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="right"></resizable-panel>
      </resizable-group>
    `)
    await page.evaluate(() => localStorage.clear())

    const key = "resizable-panels-zero:user-only:left:right"

    await page.evaluate(() => document.getElementById("group").setLayout({ left: 70, right: 30 }))
    await group.expectLayout({ left: 70 })
    expect(await page.evaluate(storageKey => localStorage.getItem(storageKey), key)).toBeNull()

    await group.separator().focus()
    await page.keyboard.press("ArrowLeft")
    await group.expectLayout({ left: 65 })
    await expect.poll(() => page.evaluate(storageKey => localStorage.getItem(storageKey), key)).toBe(JSON.stringify({ left: 65, right: 35 }))
  })
})
