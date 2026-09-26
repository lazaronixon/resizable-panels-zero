import { expect, test } from "../test_helper.js"

test.describe("resize events", () => {
  test("resizing the window revalidates the layout constraints", async ({ group, page }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="left" default-size="30%" min-size="250px"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="right" min-size="50px"></resizable-panel>
      </resizable-group>
    `)

    await group.expectLayout({ left: 30, right: 70 })
    await group.expectCounts(1)
    await group.expectPanelSize("left", { onResizeCount: 1, panelSize: { asPercentage: 30, inPixels: 293 } })
    await group.expectPanelSize("right", { onResizeCount: 1, panelSize: { asPercentage: 70, inPixels: 683 } })

    await page.setViewportSize({ width: 500, height: 500 })

    await group.expectLayout({ left: 53, right: 47 })
    await group.expectCounts(2)

    // The React library reports an intermediate size here ({ 30%, 143px }),
    // because React applies the new layout a render later; this port applies it
    // straight away, so the panels go directly to their final size. What must
    // hold either way is the final size, and no notification that repeats it.
    // So each panel reports once more (React: 3 in all), from its first size.
    await group.expectPanelSize("left", {
      onResizeCount: 2,
      panelSize: { asPercentage: 53, inPixels: 250 },
      prevPanelSize: { asPercentage: 30, inPixels: 293 }
    })
    await group.expectPanelSize("right", {
      onResizeCount: 2,
      panelSize: { asPercentage: 47, inPixels: 226 },
      prevPanelSize: { asPercentage: 70, inPixels: 683 }
    })
    await group.expectNoRepeatedResize("left")
    await group.expectNoRepeatedResize("right")

    await page.setViewportSize({ width: 1000, height: 500 })

    await group.expectLayout({ left: 53, right: 47 })
    await group.expectCounts(2)
  })

  test("resizing the window revalidates the layout constraints, then a drag uses them", async ({ group, page }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="left" min-size="50px"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="right" min-size="50px"></resizable-panel>
      </resizable-group>
    `)

    await group.expectLayout({ left: 50, right: 50 })
    await group.expectCounts(1)

    await page.setViewportSize({ width: 500, height: 500 })

    await group.expectLayout({ left: 50, right: 50 })
    await group.expectCounts(1)

    const bounds = await group.separator().boundingBox()
    await page.mouse.move(bounds.x, bounds.y)
    await page.mouse.down()
    await page.mouse.move(0, bounds.y)

    // Stale constraints would let the left panel reach 5%.
    await group.expectLayout({ left: 11, right: 89 })
    await group.expectCounts(2, 1)
  })

  test("resizing the window notifies the panels", async ({ group, page }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="left" default-size="30%" min-size="250px"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="right" min-size="50px"></resizable-panel>
      </resizable-group>
    `)

    await group.expectLayout({ left: 30, right: 70 })
    await group.expectCounts(1)

    await page.setViewportSize({ width: 500, height: 500 })

    await group.expectLayout({ left: 53, right: 47 })
    await group.expectCounts(2)
    await expect.poll(async () => (await group.panelSize("left")).onResizeCount).toBe(2)
    await expect.poll(async () => (await group.panelSize("right")).onResizeCount).toBe(2)

    await page.setViewportSize({ width: 1000, height: 500 })

    // The layout holds, but the panels grew with the group and hear about it.
    await group.expectLayout({ left: 53, right: 47 })
    await group.expectCounts(2)
    await group.expectPanelSize("left", {
      onResizeCount: 3,
      panelSize: { asPercentage: 53, inPixels: 513 },
      prevPanelSize: { asPercentage: 53, inPixels: 250 }
    })
    await group.expectPanelSize("right", {
      onResizeCount: 3,
      panelSize: { asPercentage: 47, inPixels: 463 },
      prevPanelSize: { asPercentage: 47, inPixels: 226 }
    })
  })

  test("resizing the group leaves preserve-pixel-size panels alone", async ({ group, page }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="left" default-size="30%" group-resize-behavior="preserve-pixel-size" min-size="250px"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="right" min-size="50px"></resizable-panel>
      </resizable-group>
    `)

    await group.expectLayout({ left: 30, right: 70 })
    await group.expectCounts(1)
    await group.expectPanelSize("left", { onResizeCount: 1, panelSize: { asPercentage: 30, inPixels: 293 } })
    await group.expectPanelSize("right", { onResizeCount: 1, panelSize: { asPercentage: 70, inPixels: 683 } })

    await page.setViewportSize({ width: 500, height: 500 })

    await group.expectLayout({ left: 62, right: 38 })
    await group.expectCounts(2)

    // See the first test for why there is no intermediate size to expect. The
    // left panel keeps its pixels, so only its percentage is news.
    await group.expectPanelSize("left", {
      onResizeCount: 2,
      panelSize: { asPercentage: 62, inPixels: 293 },
      prevPanelSize: { asPercentage: 30, inPixels: 293 }
    })
    await group.expectPanelSize("right", {
      onResizeCount: 2,
      panelSize: { asPercentage: 38, inPixels: 183 },
      prevPanelSize: { asPercentage: 70, inPixels: 683 }
    })
    await group.expectNoRepeatedResize("left")
    await group.expectNoRepeatedResize("right")

    await page.setViewportSize({ width: 1000, height: 500 })

    await group.expectLayout({ left: 30, right: 70 })
    await group.expectCounts(3)
  })
})
