import { expect, test } from "../test_helper.js"

// resize-preview-mode="separator": the panels stay put while dragging and a
// copy of each boundary slides instead. There are no upstream browser specs
// for this mode; these cover the behaviour its unit tests describe.
test.describe("separator preview mode", () => {
  test("defers the layout until release and shows a preview meanwhile", async ({ group, page }) => {
    await group.render(`
      <resizable-group resize-preview-mode="separator">
        <resizable-panel id="left"></resizable-panel>
        <resizable-separator id="separator"></resizable-separator>
        <resizable-panel id="right"></resizable-panel>
      </resizable-group>
    `)

    await group.expectCounts(1)
    await group.expectLayout({ left: 50 })

    const { x, y } = group.center(await group.separator("separator").boundingBox())
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 100, y, { steps: 5 })

    const preview = page.locator("[data-resize-preview]")
    await expect(preview).toHaveCount(1)
    await expect(preview.locator("[data-separator-clone]")).toHaveCount(1)
    await group.expectCounts(1)
    await group.expectLayout({ left: 50 })

    await page.mouse.up()

    await expect(preview).toHaveCount(0)
    await group.expectCounts(2)
    await group.expectLayout({ left: 60 })
  })

  test("copies the declared overlay and marks the dragged one active", async ({ group, page }) => {
    await group.render(`
      <resizable-group resize-preview-mode="separator">
        <resizable-separator-overlay class="overlay" style="background: blue"></resizable-separator-overlay>
        <resizable-panel id="left"></resizable-panel>
        <resizable-separator id="first"></resizable-separator>
        <resizable-panel id="center" min-size="10%"></resizable-panel>
        <resizable-separator id="second"></resizable-separator>
        <resizable-panel id="right" min-size="10%"></resizable-panel>
      </resizable-group>
    `)

    await expect(page.locator("resizable-separator-overlay[data-separator-overlay-source]")).toBeHidden()

    const { x, y } = group.center(await group.separator("first").boundingBox())
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 600, y, { steps: 10 })

    // Far enough to push the second boundary along with the first.
    await expect(page.locator("[data-resize-preview] > [data-separator-overlay='active']")).toHaveCount(1)
    await expect(page.locator("[data-resize-preview] > [data-separator-overlay='inactive']")).toHaveCount(1)

    await page.mouse.up()
    await expect(page.locator("[data-resize-preview]")).toHaveCount(0)
  })
})
