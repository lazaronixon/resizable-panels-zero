import { expect, test } from "../test_helper.js"

const TWO_PANELS = `
  <resizable-group>
    <resizable-panel id="left" default-size="30%" min-size="50px"></resizable-panel>
    <resizable-separator></resizable-separator>
    <resizable-panel id="right" min-size="50px"></resizable-panel>
  </resizable-group>
`

const THREE_PANELS = `
  <resizable-group>
    <resizable-panel id="left" min-size="50px"></resizable-panel>
    <resizable-separator></resizable-separator>
    <resizable-panel id="center" min-size="50px"></resizable-panel>
    <resizable-separator></resizable-separator>
    <resizable-panel id="right" min-size="50px"></resizable-panel>
  </resizable-group>
`

test.describe("pointer interactions", () => {
  test("drag separator to resize group", async ({ group }) => {
    await group.render(TWO_PANELS)

    await group.expectCounts(1)
    await group.expectLayout({ left: 30 })

    await group.resize([ "left", "right" ], 100, 0)
    await group.expectCounts(2)
    await group.expectLayout({ left: 40 })

    await group.resize([ "left", "right" ], 1000, 0)
    await group.expectCounts(3)
    await group.expectLayout({ left: 95 })

    await group.resize([ "left", "right" ], -1000, 0)
    await group.expectCounts(4)
    await group.expectLayout({ left: 5 })
  })

  // github.com/bvaughn/react-resizable-panels/issues/581
  test("does not handle or prevent right-click events", async ({ group, page }) => {
    await group.render(TWO_PANELS)

    await group.expectCounts(1)
    await group.expectLayout({ left: 30 })

    const separator = group.separator()
    const box = await separator.boundingBox()

    await page.mouse.move(box.x, box.y)
    await page.mouse.down({ button: "right" })

    await expect(separator).not.toHaveAttribute("data-separator", "active")

    await page.mouse.move(box.x - 100, box.y)
    await page.mouse.click(0, 0)
    await page.waitForTimeout(100)

    await group.expectCounts(1)
    await group.expectLayout({ left: 30 })
  })

  // github.com/bvaughn/react-resizable-panels/issues/594
  test("only prevents the pointerup of a pointerdown it handled", async ({ group, page }) => {
    await group.render(`
      <div style="position: relative">
        ${TWO_PANELS}
        <pre data-clickable class="blocker" style="left: 0; margin: 0"></pre>
      </div>
    `)

    const clickable = page.getByText("Clickable")
    const clickableBox = await clickable.boundingBox()
    const separatorBox = await group.separator().boundingBox()

    // A handled pointerdown also prevents the matching pointerup.
    await page.mouse.move(separatorBox.x, separatorBox.y + separatorBox.height)
    await page.mouse.down()
    await page.mouse.move(clickableBox.x, clickableBox.y)
    await page.mouse.up()

    await expect(page.getByText("Clickable down:0 up:0")).toBeVisible()

    // An unhandled one does not.
    await page.mouse.move(1000, 0)
    await page.mouse.down()
    await page.mouse.move(clickableBox.x, clickableBox.y)
    await page.mouse.up()

    await expect(page.getByText("Clickable down:0 up:1")).toBeVisible()
  })

  test("drag panel boundary to resize group", async ({ group }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="left" default-size="30%" min-size="50px"></resizable-panel>
        <resizable-panel id="right" min-size="50px"></resizable-panel>
      </resizable-group>
    `)

    await group.expectCounts(1)
    await group.expectLayout({ left: 30 })

    await group.resize([ "left", "right" ], 100, 0)
    await group.expectCounts(2)
    await group.expectLayout({ left: 40 })

    await group.resize([ "left", "right" ], 1000, 0)
    await group.expectCounts(3)
    await group.expectLayout({ left: 95 })

    await group.resize([ "left", "right" ], -1000, 0)
    await group.expectCounts(4)
    await group.expectLayout({ left: 5 })
  })

  test("does not resize when the group is disabled", async ({ group }) => {
    await group.render(`
      <resizable-group disabled>
        <resizable-panel id="left" default-size="30%" min-size="50px"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="right" min-size="50px"></resizable-panel>
      </resizable-group>
    `)

    await group.expectCounts(1)
    await group.expectLayout({ left: 30 })

    await group.resize([ "left", "right" ], 100, 0)
    await group.expectCounts(1)
    await group.expectLayout({ left: 30 })
  })

  test("dragging a handle resizes multiple panels", async ({ group }) => {
    await group.render(THREE_PANELS)

    await group.expectCounts(1)
    await group.expectLayout({ left: 33, center: 33, right: 33 })

    await group.resize([ "left", "center" ], 1000, 0)
    await group.expectCounts(2)
    await group.expectLayout({ left: 89, center: 5, right: 5 })

    await group.resize([ "center", "right" ], -1000, 0)
    await group.expectCounts(3)
    await group.expectLayout({ left: 5, center: 5, right: 89 })

    await group.resize([ "center", "right" ], 1000, 0)
    await group.expectCounts(4)
    await group.expectLayout({ left: 5, center: 89, right: 5 })
  })

  test("the initial position is the anchor while a drag is in progress", async ({ group, page }) => {
    await group.render(THREE_PANELS)

    await group.expectCounts(1, 1)
    await group.expectLayout({ left: 33, center: 33, right: 33 })

    const { x, y } = group.center(await group.hitArea([ "left", "center" ]))

    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 500, y, { steps: 1 })

    await group.expectCounts(2, 1)
    await group.expectLayout({ left: 86, center: 5, right: 9 })

    await group.moveTo(x - 500, y)

    await group.expectCounts(3, 1)
    await group.expectLayout({ left: 5, center: 61, right: 33 })

    await page.mouse.move(x, y)
    await page.mouse.up()

    // Released on the starting spot: back to the starting layout.
    await group.expectCounts(4, 1)
    await group.expectLayout({ left: 33, center: 33, right: 33 })
  })

  test("measures the delta against the group size minus the flex gap", async ({ group }) => {
    await group.render(`
      <resizable-group style="gap: 80px">
        <resizable-panel id="left" default-size="10%" min-size="5%"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="right" min-size="5%"></resizable-panel>
      </resizable-group>
    `)

    await group.expectCounts(1)
    await group.expectLayout({ left: 10 })

    await group.resize([ "left", "right" ], 800, 0)

    // It would be ~91% and 9% if the gap counted.
    await group.expectCounts(2)
    await group.expectLayout({ left: 95 })
  })

  test("does not report a finished change until the pointer resize finishes", async ({ group, page }) => {
    await group.render(THREE_PANELS)

    await group.expectCounts(1, 1)

    const { x, y } = group.center(await group.hitArea([ "left", "center" ]))

    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 500, y, { steps: 1 })

    await group.expectCounts(2, 1)
    await group.expectLayout({ left: 86, center: 5, right: 9 })

    await group.moveTo(x - 500, y)

    await group.expectCounts(3, 1)
    await group.expectLayout({ left: 5, center: 61, right: 33 })

    await page.mouse.up()

    await group.expectCounts(3, 2)
    await group.expectLayout({ left: 5, center: 61, right: 33 })
  })

  test("double-clicking a separator resets the primary panel to its default size", async ({ group }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="left" default-size="30%" min-size="50px"></resizable-panel>
        <resizable-separator id="separator"></resizable-separator>
        <resizable-panel id="right" min-size="50px"></resizable-panel>
      </resizable-group>
    `)

    await group.expectCounts(1)
    await group.expectLayout({ left: 30 })

    await group.resize([ "left", "right" ], 100, 0)
    await group.expectCounts(2)
    await group.expectLayout({ left: 40 })

    await group.separator("separator").dblclick()
    await group.expectCounts(3)
    await group.expectLayout({ left: 30 })
  })

  test("double-clicking a separator resets the secondary panel to its default size", async ({ group }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="left" min-size="50px"></resizable-panel>
        <resizable-separator id="separator"></resizable-separator>
        <resizable-panel id="right" default-size="70%" min-size="50px"></resizable-panel>
      </resizable-group>
    `)

    await group.expectCounts(1)
    await group.expectLayout({ left: 30 })

    await group.resize([ "left", "right" ], 100, 0)
    await group.expectCounts(2)
    await group.expectLayout({ left: 40 })

    await group.separator("separator").dblclick()
    await group.expectCounts(3)
    await group.expectLayout({ left: 30 })
  })

  test("double-clicking does not reset when disable-double-click is set", async ({ group }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="left" default-size="30%" min-size="50px"></resizable-panel>
        <resizable-separator id="separator" disable-double-click></resizable-separator>
        <resizable-panel id="right" min-size="50px"></resizable-panel>
      </resizable-group>
    `)

    await group.expectCounts(1)

    await group.resize([ "left", "right" ], 100, 0)
    await group.expectCounts(2)
    await group.expectLayout({ left: 40 })

    await group.separator("separator").dblclick()
    await group.page.waitForTimeout(100)
    await group.expectCounts(2)
  })

  test.describe("focus", () => {
    for (const returnToStart of [ false, true ]) {
      test(`blurs after dragging${returnToStart ? " back to the starting point" : ""}`, async ({ group, page }) => {
        await group.render(`
          <resizable-group>
            <resizable-panel id="left"></resizable-panel>
            <resizable-separator></resizable-separator>
            <resizable-panel id="right"></resizable-panel>
          </resizable-group>
        `)

        const separator = group.separator()
        const { x, y } = group.center(await separator.boundingBox())

        await page.mouse.move(x, y)
        await page.mouse.down()
        await expect(separator).toBeFocused()
        await page.mouse.move(x + 25, y)
        if (returnToStart) await page.mouse.move(x, y)
        await page.mouse.up()
        await expect(separator).not.toBeFocused()

        const valueAfterDrag = await separator.getAttribute("aria-valuenow")
        await page.keyboard.press("ArrowRight")
        await expect(separator).toHaveAttribute("aria-valuenow", valueAfterDrag)

        // A later click still focuses it and keyboard resizing works.
        await separator.click()
        await expect(separator).toBeFocused()
        const value = await separator.getAttribute("aria-valuenow")
        await page.keyboard.press("ArrowRight")
        await expect(separator).not.toHaveAttribute("aria-valuenow", value)
      })
    }

    test("focuses the nearest separator", async ({ group, page }) => {
      await group.render(`
        <resizable-group>
          <resizable-panel id="left"></resizable-panel>
          <resizable-separator id="separator-left"></resizable-separator>
          <resizable-panel id="center"></resizable-panel>
          <resizable-separator id="separator-right"></resizable-separator>
          <resizable-panel id="right"></resizable-panel>
        </resizable-group>
      `)

      const { x, y } = group.center(await group.hitArea([ "center", "right" ]))
      const separator = group.separator("separator-right")
      await expect(separator).not.toBeFocused()

      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.up()

      await expect(separator).toBeFocused()
    })

    test("activates the closest of two separators", async ({ group, page }) => {
      await group.render(`
        <resizable-group>
          <resizable-panel id="left"></resizable-panel>
          <resizable-separator id="separator-left"></resizable-separator>
          <div>fixed size</div>
          <resizable-separator id="separator-right"></resizable-separator>
          <resizable-panel id="right"></resizable-panel>
        </resizable-group>
      `)

      const separatorLeft = group.separator("separator-left")
      const separatorRight = group.separator("separator-right")

      {
        const { x, y } = group.center(await separatorRight.boundingBox())
        await expect(separatorRight).not.toBeFocused()

        await page.mouse.move(x, y)
        await expect(separatorLeft).not.toHaveAttribute("data-separator", "hover")
        await expect(separatorRight).toHaveAttribute("data-separator", "hover")

        await page.mouse.down()
        await expect(separatorLeft).not.toHaveAttribute("data-separator", "active")
        await expect(separatorRight).toHaveAttribute("data-separator", "active")

        await page.mouse.up()
        await expect(separatorRight).toBeFocused()
      }

      {
        const { x, y } = group.center(await separatorLeft.boundingBox())
        await expect(separatorLeft).not.toBeFocused()

        await page.mouse.move(x, y)
        await expect(separatorLeft).toHaveAttribute("data-separator", "hover")
        await expect(separatorRight).not.toHaveAttribute("data-separator", "hover")

        await page.mouse.down()
        await expect(separatorLeft).toHaveAttribute("data-separator", "active")
        await expect(separatorRight).not.toHaveAttribute("data-separator", "active")

        await page.mouse.up()
        await expect(separatorLeft).toBeFocused()
      }
    })
  })

  // github.com/bvaughn/react-resizable-panels/issues/645
  test("updates the separator state when the pointer moves over an iframe", async ({ group, page }) => {
    await group.render(`
      <resizable-group style="gap: 0">
        <resizable-panel id="left"><iframe style="display: block; width: 100%; height: 100%; border: 0"></iframe></resizable-panel>
        <resizable-separator id="separator"></resizable-separator>
        <resizable-panel id="right"></resizable-panel>
      </resizable-group>
    `)

    const separator = group.separator("separator")
    const { x, y } = group.center(await separator.boundingBox())

    await expect(separator).toHaveAttribute("data-separator", "inactive")

    await page.mouse.move(x, y)
    await expect(separator).toHaveAttribute("data-separator", "hover")

    await page.mouse.move(x - 25, y)
    await expect(separator).toHaveAttribute("data-separator", "inactive")
  })

  // github.com/bvaughn/react-resizable-panels/issues/688
  test("updates the separator state when the pointer is released over an iframe", async ({ group, page }) => {
    await group.render(`
      <resizable-group style="gap: 0">
        <resizable-panel id="left" min-size="25%"><iframe style="display: block; width: 100%; height: 100%; border: 0; background: #fca5a5"></iframe></resizable-panel>
        <resizable-separator id="separator"></resizable-separator>
        <resizable-panel id="right"></resizable-panel>
      </resizable-group>
    `)

    const separator = group.separator("separator")
    const { x, y } = group.center(await separator.boundingBox())

    await expect(separator).toHaveAttribute("data-separator", "inactive")

    await page.mouse.move(x, y)
    await expect(separator).toHaveAttribute("data-separator", "hover")

    await page.mouse.down()
    await expect(separator).toHaveAttribute("data-separator", "active")

    await page.mouse.move(x - 25, y, { steps: 10 })
    await expect(separator).toHaveAttribute("data-separator", "active")

    await page.mouse.up()
    await expect(separator).not.toBeFocused()
    await expect(separator).not.toHaveAttribute("data-separator", "active")

    await page.mouse.move(0, 0)
    await page.mouse.down()
    await expect(separator).toHaveAttribute("data-separator", "inactive")
  })

  test("ignores pointer capture for a group removed during a drag", async ({ group, page }) => {
    await group.render(`
      <div style="display: flex; flex-direction: column; gap: 16px">
        <div id="removable">
          <resizable-group>
            <resizable-panel id="left"></resizable-panel>
            <resizable-separator id="unmounted-separator"></resizable-separator>
            <resizable-panel id="right"></resizable-panel>
          </resizable-group>
        </div>
        <resizable-group>
          <resizable-panel id="persistent-left"></resizable-panel>
          <resizable-separator></resizable-separator>
          <resizable-panel id="persistent-right"></resizable-panel>
        </resizable-group>
      </div>
    `)

    const errors = []
    page.on("pageerror", error => errors.push(error))

    const separator = group.separator("unmounted-separator")
    const { x, y } = group.center(await separator.boundingBox())

    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 25, y)
    await expect(separator).toHaveAttribute("data-separator", "active")

    await page.evaluate(() => document.getElementById("removable").replaceChildren())
    await expect(separator).toHaveCount(0)

    await page.mouse.move(x - 50, y)
    await page.mouse.up()

    expect(errors).toEqual([])
  })

  test("does not prevent click events when no drag happens", async ({ group, page }) => {
    await group.render(`
      <resizable-group style="gap: 0">
        <resizable-panel id="left"><pre data-clickable style="margin: 0; height: 100%; width: 100%; background: #fca5a5"></pre></resizable-panel>
        <resizable-separator id="separator" style="min-width: 1px; width: 1px"></resizable-separator>
        <resizable-panel id="right"></resizable-panel>
      </resizable-group>
    `)

    const { x, y } = group.center(await group.separator().boundingBox())

    const clickable = page.getByText("click")
    await expect(clickable).toContainText("click:0")

    // A press that resizes nothing is an ordinary click.
    await page.mouse.move(x - 2, y)
    await page.mouse.down()
    await page.mouse.up()
    await expect(clickable).toContainText("click:1")

    // A press that resizes is not.
    await page.mouse.move(x - 2, y)
    await page.mouse.down()
    await page.mouse.move(x - 3, y)
    await page.mouse.up()
    await expect(clickable).toContainText("click:1")
  })

  test("a disabled separator cannot resize its panels", async ({ group }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="left"></resizable-panel>
        <resizable-separator disabled></resizable-separator>
        <resizable-panel id="right"></resizable-panel>
      </resizable-group>
    `)

    await group.expectCounts(1)
    await group.expectLayout({ left: 50 })

    await group.resize([ "left", "right" ], 100, 0)
    await group.expectCounts(1)
    await group.expectLayout({ left: 50 })
  })

  test("a disabled panel cannot be resized", async ({ group }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="left" disabled></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="right"></resizable-panel>
      </resizable-group>
    `)

    await group.expectCounts(1)
    await group.expectLayout({ left: 50 })

    await group.resize([ "left", "right" ], 100, 0)
    await group.expectCounts(1)
    await group.expectLayout({ left: 50 })
  })

  test("a disabled panel's edge can resize another panel indirectly", async ({ group }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="left"></resizable-panel>
        <resizable-panel id="center" disabled></resizable-panel>
        <resizable-panel id="right"></resizable-panel>
      </resizable-group>
    `)

    await group.expectCounts(1)
    await group.expectLayout({ left: 33, center: 33, right: 33 })

    await group.resize([ "left", "center" ], 100, 0)
    await group.expectCounts(2)
    await group.expectLayout({ left: 43, center: 33, right: 23 })

    await group.resize([ "center", "right" ], -200, 0)
    await group.expectCounts(3)
    await group.expectLayout({ left: 23, center: 33, right: 43 })

    await group.resize([ "center", "right" ], 200, 0)
    await group.expectCounts(4)
    await group.expectLayout({ left: 43, center: 33, right: 23 })

    await group.resize([ "center", "right" ], -100, 0)
    await group.expectCounts(5)
    await group.expectLayout({ left: 33, center: 33, right: 33 })
  })
})
