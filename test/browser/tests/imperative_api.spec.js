import { expect, test } from "../test_helper.js"

// The React library reaches these through refs; here they are methods on the
// elements themselves.
test.describe("imperative API", () => {
  test.beforeEach(async ({ group }) => {
    await group.render(`
      <resizable-group id="group">
        <resizable-panel id="left" default-size="30"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="right" collapsible collapsed-size="10%" min-size="20%"></resizable-panel>
      </resizable-group>
    `)
  })

  test("group.getLayout()", async ({ page }) => {
    await expect.poll(() => page.evaluate(() => document.getElementById("group").getLayout())).toMatchObject({ left: 30 })
  })

  test("panel.getSize()", async ({ page }) => {
    await expect.poll(() => page.evaluate(() => document.getElementById("right").getSize().asPercentage)).toBe(70)
  })

  test("group.setLayout()", async ({ group, page }) => {
    const applied = await page.evaluate(() => document.getElementById("group").setLayout({ left: 60, right: 40 }))

    expect(applied).toEqual({ left: 60, right: 40 })
    await group.expectLayout({ left: 60, right: 40 })
    await expect.poll(async () => (await group.events("layout-changed")).at(-1).detail.isUserInteraction).toBe(false)
  })

  test("panel.resize(), collapse(), expand() and isCollapsed()", async ({ group, page }) => {
    await page.evaluate(() => document.getElementById("left").resize("40%"))
    await group.expectLayout({ left: 40, right: 60 })

    await page.evaluate(() => document.getElementById("right").collapse())
    await group.expectLayout({ left: 90, right: 10 })
    expect(await page.evaluate(() => document.getElementById("right").isCollapsed())).toBe(true)

    await page.evaluate(() => document.getElementById("right").expand())
    await group.expectLayout({ left: 40, right: 60 })
    expect(await page.evaluate(() => document.getElementById("right").isCollapsed())).toBe(false)
  })
})
