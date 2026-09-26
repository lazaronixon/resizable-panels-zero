import { expect, test } from "../test_helper.js"

// Located by id rather than role: inert elements drop out of the accessibility tree.
async function drag(group, id, deltaX) {
  const { x, y } = group.center(await group.box(id))

  await group.page.mouse.move(x, y)
  await group.page.mouse.down()
  await group.page.mouse.move(x + deltaX, y)
  await group.page.mouse.up()
}

test.describe("modal dialogs", () => {
  test("ignores separators behind a modal dialog rendered inside the group", async ({ group, page }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="left">
          <dialog data-open="modal" class="full-screen-dialog"><div>modal dialog</div></dialog>
        </resizable-panel>
        <resizable-separator id="separator"></resizable-separator>
        <resizable-panel id="right"></resizable-panel>
      </resizable-group>
    `)

    await group.expectCounts(1)
    await expect(page.getByText("modal dialog")).toBeVisible()

    await drag(group, "separator", 100)
    await expect(group.separator("separator")).not.toHaveAttribute("data-separator", "active")
    await group.expectCounts(1)

    // Closing the dialog makes the separator usable again.
    await page.evaluate(() => document.querySelector("dialog").close())

    await drag(group, "separator", 100)
    await group.expectCounts(2)
  })

  test("only resizes the group inside a modal dialog when separators overlap", async ({ group, page }) => {
    await group.render(`
      <resizable-group id="outer-group">
        <resizable-panel id="outer-left">
          <dialog data-open="modal" style="position: fixed; margin: 0; padding: 0; border: 0; max-width: none; max-height: none; background: transparent">
            <resizable-group id="inner-group" style="height: 100%">
              <resizable-panel id="inner-left"></resizable-panel>
              <resizable-separator id="inner-separator"></resizable-separator>
              <resizable-panel id="inner-right"></resizable-panel>
            </resizable-group>
          </dialog>
        </resizable-panel>
        <resizable-separator id="outer-separator"></resizable-separator>
        <resizable-panel id="outer-right"></resizable-panel>
      </resizable-group>
    `)

    // Lay the dialog exactly over the outer group, so both separators overlap.
    await page.evaluate(() => {
      const dialog = document.querySelector("dialog")
      const rect = document.getElementById("outer-group").getBoundingClientRect()

      dialog.style.top = `${rect.top}px`
      dialog.style.left = `${rect.left}px`
      dialog.style.width = `${rect.width}px`
      dialog.style.height = `${rect.height}px`
    })

    const outerSeparator = group.separator("outer-separator")
    const innerSeparator = group.separator("inner-separator")

    await expect(async () => {
      const outerBox = await outerSeparator.boundingBox()
      const innerBox = await innerSeparator.boundingBox()

      expect(Math.abs(outerBox.x - innerBox.x)).toBeLessThan(1)
      expect(Math.abs(outerBox.y - innerBox.y)).toBeLessThan(1)
    }).toPass()

    const outerBoxBefore = await outerSeparator.boundingBox()
    const innerBoxBefore = await innerSeparator.boundingBox()

    await drag(group, "inner-separator", 100)

    await expect(async () => {
      const innerBoxAfter = await innerSeparator.boundingBox()
      expect(innerBoxAfter.x - innerBoxBefore.x).toBeGreaterThan(50)
    }).toPass()

    const outerBoxAfter = await outerSeparator.boundingBox()
    expect(outerBoxAfter.x).toBeCloseTo(outerBoxBefore.x, 0)
  })

  // Content behind a non-modal dialog stays interactive, so this is left alone
  // like any other overlay inside the group.
  test("does not ignore separators behind a non-modal dialog", async ({ group, page }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="left">
          <dialog data-open="show" class="full-screen-dialog"><div>non-modal dialog</div></dialog>
        </resizable-panel>
        <resizable-separator id="separator"></resizable-separator>
        <resizable-panel id="right"></resizable-panel>
      </resizable-group>
    `)

    await group.expectCounts(1)
    await expect(page.getByText("non-modal dialog")).toBeVisible()

    await drag(group, "separator", 100)
    await group.expectCounts(2)
  })
})
