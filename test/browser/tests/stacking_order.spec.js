import { expect, test } from "../test_helper.js"

// "w-25 h-25 min-h-25" in the React harness, merged with its default
// "min-w-full": a full-width group 100px tall, so the blockers sit over its
// top edge.
const SMALL_GROUP = "height: 100px; min-height: 100px"

const WITH_TWO_BLOCKERS = `
  <div style="position: relative">
    <resizable-group style="${SMALL_GROUP}">
      <resizable-panel id="left"></resizable-panel>
      <resizable-separator id="separator"></resizable-separator>
      <resizable-panel id="center"></resizable-panel>
      <resizable-panel id="right"></resizable-panel>
    </resizable-group>
    <div class="blocker" style="left: 30%">blocker</div>
    <div class="blocker" style="left: 65%">blocker</div>
  </div>
`

test.describe("stacking order", () => {
  test("ignores pointer events on overlapping targets painted above", async ({ group, page }) => {
    await group.render(WITH_TWO_BLOCKERS)
    await group.expectCounts(1)

    const box = await group.separator().boundingBox()

    await page.mouse.move(box.x, box.y)
    await page.mouse.down()
    await page.mouse.move(0, 0)
    await page.mouse.up()

    await group.expectCounts(1)

    const hitArea = await group.hitArea([ "center", "right" ])

    await page.mouse.move(hitArea.x, hitArea.y)
    await page.mouse.down()
    await page.mouse.move(1000, 0)
    await page.mouse.up()

    await page.waitForTimeout(100)
    await group.expectCounts(1)
  })

  test("allows pointer events near, but not on, targets painted above", async ({ group, page }) => {
    await group.render(WITH_TWO_BLOCKERS)
    await group.expectCounts(1)

    const box = await group.separator().boundingBox()

    await page.mouse.move(box.x, box.y + box.height)
    await page.mouse.down()
    await page.mouse.move(0, 0)
    await page.mouse.up()

    await group.expectCounts(2)

    const hitArea = await group.hitArea([ "center", "right" ])

    await page.mouse.move(hitArea.x, hitArea.y + hitArea.height)
    await page.mouse.down()
    await page.mouse.move(1000, 0)
    await page.mouse.up()

    await group.expectCounts(3)
  })

  test("allows a drag that starts outside an overlapping element and moves under it", async ({ group, page }) => {
    await group.render(`
      <div style="position: relative">
        <resizable-group style="${SMALL_GROUP}">
          <resizable-panel id="left"></resizable-panel>
          <resizable-separator id="separator"></resizable-separator>
          <resizable-panel id="right"></resizable-panel>
        </resizable-group>
        <div class="blocker" style="left: 0">blocker</div>
      </div>
    `)

    const separator = group.separator()
    const panelBox = await group.box("left")
    const separatorBox = await separator.boundingBox()

    await group.expectCounts(1)

    await page.mouse.move(separatorBox.x, separatorBox.y)
    await expect(separator).toHaveAttribute("data-separator", "hover")

    await page.mouse.down()
    await expect(separator).toHaveAttribute("data-separator", "active")
    await group.expectCounts(1)

    await page.mouse.move(panelBox.x, separatorBox.y)
    await expect(separator).toHaveAttribute("data-separator", "active")
    await group.expectCounts(2, 1)

    await page.mouse.move(panelBox.x + 25, separatorBox.y)
    await expect(separator).toHaveAttribute("data-separator", "active")
    await group.expectCounts(3, 1)

    // Releasing under the overlay ends the drag and commits the layout.
    await page.mouse.up()
    await expect(separator).not.toHaveAttribute("data-separator", "active")
    await group.expectCounts(3, 2)

    // No-op
    await page.mouse.down()
    await page.mouse.move(separatorBox.x, separatorBox.y)
    await page.mouse.up()
    await group.expectCounts(3, 2)
  })
})
