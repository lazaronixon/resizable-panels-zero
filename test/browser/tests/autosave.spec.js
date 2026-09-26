import { expect, test } from "../test_helper.js"

// Ports the React library's default-layout specs, which drive its
// useDefaultLayout hook; the `autosave` attribute does that job here.
test.describe("autosave", () => {
  test("restores a saved layout after a reload without layout shift", async ({ group, page, browserName }) => {
    await page.goto("/autosave.html")
    await page.evaluate(() => localStorage.clear())
    await page.reload()

    await group.expectLayout({ top: 50, bottom: 50 }, "group-two")
    await group.resize([ "top", "bottom" ], 0, -25)

    const saved = await group.layout("group-two")
    expect(saved.top).toBeLessThan(50)

    await page.reload({ waitUntil: "domcontentloaded" })

    await group.expectLayout(saved, "group-two")
    expect(await page.evaluate(() => localStorage.getItem("resizable-panels-zero:group-two:top:bottom"))).not.toBeNull()

    // Only Chromium reports layout shift.
    if (browserName === "chromium") {
      await page.waitForTimeout(250)
      expect(await page.evaluate(() => globalThis.layoutShift)).toBe(0)
    }
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
