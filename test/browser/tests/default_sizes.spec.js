import { expect, test } from "../test_helper.js"

// High level only; the finer cases are covered by the unit tests.
test.describe("default panel sizes", () => {
  for (const { name, left, middle, expected } of [
    { name: "percentages", left: "30%", middle: "0%", expected: { left: { asPercentage: 30 }, middle: { asPercentage: 0 }, right: { asPercentage: 70 } } },
    { name: "pixels", left: "200px", middle: "0px", expected: { left: { inPixels: 200 }, middle: { inPixels: 0 }, right: { inPixels: 752 } } },
    { name: "rems", left: "10rem", middle: "0rem", expected: { left: { inPixels: 160 }, middle: { inPixels: 0 }, right: { inPixels: 792 } } },
    { name: "vw", left: "25vw", middle: "0vw", expected: { left: { inPixels: 250 }, middle: { inPixels: 0 }, right: { inPixels: 702 } } }
  ]) {
    test(name, async ({ group }) => {
      await group.render(`
        <resizable-group>
          <resizable-panel id="left" default-size="${left}" min-size="50px"></resizable-panel>
          <resizable-separator></resizable-separator>
          <resizable-panel id="middle" collapsible default-size="${middle}" min-size="50px"></resizable-panel>
          <resizable-separator></resizable-separator>
          <resizable-panel id="right" min-size="50px"></resizable-panel>
        </resizable-group>
      `)

      for (const [ panelId, size ] of Object.entries(expected)) {
        await expect.poll(async () => (await group.panelSize(panelId)).panelSize).toMatchObject(size)
      }

      await expect(group.separator()).toHaveCount(2)
    })
  }

  test("a number assigned to the property is pixels", async ({ group, page }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="left" min-size="50px"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="right" min-size="50px"></resizable-panel>
      </resizable-group>
    `)

    await page.evaluate(() => {
      document.getElementById("left").defaultSize = 200
    })

    await expect(group.element("left")).toHaveAttribute("default-size", "200px")
    await expect.poll(async () => (await group.panelSize("left")).panelSize).toMatchObject({ inPixels: 200 })
  })
})
