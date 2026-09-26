import { expect, test } from "../test_helper.js"

// The limit check relies on the layout not changing between two moves ("the
// pointer has gone too far, nothing more can be resized"). One move across a
// big gap is unrealistic, so every move is split into several events.
const moveConfig = { steps: 10 }

// Chrome and Firefox get directional cursors at a limit; WebKit keeps the
// plain ones (see supportsAdvancedCursorStyles), so each expectation names the
// cursor for both.
const INTERSECTING = `
  <resizable-group orientation="vertical" style="height: 250px">
    <resizable-panel id="top" min-size="25%"></resizable-panel>
    <resizable-separator id="vertical-separator"></resizable-separator>
    <resizable-panel id="bottom" min-size="25%">
      <resizable-group orientation="horizontal" style="position: relative; top: -5rem">
        <resizable-panel id="left" min-size="25%"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="right" min-size="25%"></resizable-panel>
      </resizable-group>
    </resizable-panel>
  </resizable-group>
`

test.describe("cursor", () => {
  test("horizontal", async ({ group, page }) => {
    await group.render(`
      <resizable-group orientation="horizontal">
        <resizable-panel id="left" min-size="25%"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="right" min-size="25%"></resizable-panel>
      </resizable-group>
    `)

    const { x, y } = group.center(await group.hitArea([ "left", "right" ]))

    await group.expectCursor("auto")

    await page.mouse.move(x, y, moveConfig)
    await group.expectCursor("ew-resize", "col-resize")

    await page.mouse.down()
    await page.mouse.move(25, y, moveConfig)
    await group.expectCursor("e-resize", "col-resize")

    await page.mouse.move(975, y, moveConfig)
    await group.expectCursor("w-resize", "col-resize")
  })

  test("vertical", async ({ group, page }) => {
    await group.render(`
      <resizable-group orientation="vertical">
        <resizable-panel id="top" min-size="25%"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="bottom" min-size="25%"></resizable-panel>
      </resizable-group>
    `)

    const { x, y } = group.center(await group.hitArea([ "top", "bottom" ]))

    await group.expectCursor("auto")

    await page.mouse.move(x, y, moveConfig)
    await group.expectCursor("ns-resize", "row-resize")

    await page.mouse.down()
    await page.mouse.move(x, 0, moveConfig)
    await group.expectCursor("s-resize", "row-resize")

    await page.mouse.move(x, 600, moveConfig)
    await group.expectCursor("n-resize", "row-resize")
  })

  test("intersecting", async ({ group, page }) => {
    await group.render(INTERSECTING)

    const box = await group.separator("vertical-separator").boundingBox()
    const x = box.x + box.width / 2
    const y = box.y

    await group.expectCursor("auto")

    // Centred
    await page.mouse.move(x, y, moveConfig)
    await group.expectCursor("move", "grab")

    // Top left
    await page.mouse.down()
    await page.mouse.move(1, 1, moveConfig)
    await group.expectCursor("se-resize", "grab")

    // Top
    await page.mouse.move(x, 0, moveConfig)
    await group.expectCursor("s-resize", "grab")

    // Top right
    await page.mouse.move(1000, 1, moveConfig)
    await group.expectCursor("sw-resize", "grab")

    // Right
    await page.mouse.move(975, y, moveConfig)
    await group.expectCursor("w-resize", "grab")

    // Bottom right
    await page.mouse.move(1000, 600, moveConfig)
    await group.expectCursor("nw-resize", "grab")

    // Bottom
    await page.mouse.move(x, 600, moveConfig)
    await group.expectCursor("n-resize", "grab")

    // Bottom left
    await page.mouse.move(1, 600, moveConfig)
    await group.expectCursor("ne-resize", "grab")

    // Left
    await page.mouse.move(25, y, moveConfig)
    await group.expectCursor("e-resize", "grab")

    // Centred
    await page.mouse.move(x, y, moveConfig)
    await group.expectCursor("move", "grab")
  })

  test("moving along one axis only leaves the cursor alone", async ({ group, page }) => {
    await group.render(INTERSECTING)

    const box = await group.separator("vertical-separator").boundingBox()
    const x = box.x + box.width / 2
    const y = box.y

    await group.expectCursor("auto")

    await page.mouse.move(x, y, moveConfig)
    await group.expectCursor("move", "grab")

    await page.mouse.down()
    await page.mouse.move(x, y - 25, moveConfig)
    await group.expectCursor("move", "grab")
  })

  test("disable-cursor", async ({ group, page }) => {
    await group.render(`
      <resizable-group disable-cursor orientation="vertical">
        <resizable-panel id="top" min-size="25%"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="bottom" min-size="25%"></resizable-panel>
      </resizable-group>
    `)

    const { x, y } = group.center(await group.hitArea([ "top", "bottom" ]))

    await group.expectCursor("auto")
    await page.mouse.move(x, y, moveConfig)
    await group.expectCursor("auto")
  })

  test("all panels disabled", async ({ group, page }) => {
    for (const [ leftDisabled, rightDisabled ] of [ [ true, true ], [ true, false ], [ false, true ] ]) {
      await group.render(`
        <resizable-group>
          <resizable-panel id="left" ${leftDisabled ? "disabled" : ""}></resizable-panel>
          <resizable-panel id="right" ${rightDisabled ? "disabled" : ""}></resizable-panel>
        </resizable-group>
      `)

      const { x, y } = group.center(await group.hitArea([ "left", "right" ]))

      await group.expectCursor("auto")
      await page.mouse.move(x, y, moveConfig)
      await group.expectCursor("auto")
    }
  })

  test("all but one panel disabled", async ({ group, page }) => {
    for (const [ leftDisabled, centerDisabled, rightDisabled ] of [ [ true, true, false ], [ false, true, true ], [ true, false, true ] ]) {
      await group.render(`
        <resizable-group>
          <resizable-panel id="left" ${leftDisabled ? "disabled" : ""}></resizable-panel>
          <resizable-panel id="center" ${centerDisabled ? "disabled" : ""}></resizable-panel>
          <resizable-panel id="right" ${rightDisabled ? "disabled" : ""}></resizable-panel>
        </resizable-group>
      `)

      await group.expectCursor("auto")

      for (const pair of [ [ "left", "center" ], [ "center", "right" ] ]) {
        const { x, y } = group.center(await group.hitArea(pair))
        await page.mouse.move(x, y, moveConfig)
        await group.expectCursor("auto")
      }
    }
  })

  test("only some panels disabled", async ({ group, page }) => {
    for (const [ leftDisabled, centerDisabled, rightDisabled ] of [ [ true, false, false ], [ false, true, false ], [ false, false, true ] ]) {
      await group.render(`
        <resizable-group>
          <resizable-panel id="left" ${leftDisabled ? "disabled" : ""}></resizable-panel>
          <resizable-panel id="center" ${centerDisabled ? "disabled" : ""}></resizable-panel>
          <resizable-panel id="right" ${rightDisabled ? "disabled" : ""}></resizable-panel>
        </resizable-group>
      `)

      await group.expectCursor("auto")

      if (!leftDisabled) {
        const { x, y } = group.center(await group.hitArea([ "left", "center" ]))
        await page.mouse.move(x, y, moveConfig)
        await group.expectCursor("ew-resize", "col-resize")
      }

      if (!rightDisabled) {
        const { x, y } = group.center(await group.hitArea([ "center", "right" ]))
        await page.mouse.move(x, y, moveConfig)
        await group.expectCursor("ew-resize", "col-resize")
      }
    }
  })

  for (const { name, groupAttributes, expected } of [
    { name: "disabled separator", groupAttributes: "", expected: "not-allowed" },
    { name: "disabled separator within a disabled group", groupAttributes: "disabled", expected: "not-allowed" },
    { name: "disabled separator within a cursor-disabled group", groupAttributes: "disable-cursor", expected: "auto" }
  ]) {
    test(name, async ({ group, page }) => {
      await group.render(`
        <resizable-group ${groupAttributes}>
          <resizable-panel id="left"></resizable-panel>
          <resizable-separator id="separator" disabled></resizable-separator>
          <resizable-panel id="right"></resizable-panel>
        </resizable-group>
      `)

      const { x, y } = group.center(await group.separator("separator").boundingBox())

      await group.expectCursor("auto")
      await page.mouse.move(x, y, moveConfig)

      expect(await page.evaluate(() => getComputedStyle(document.querySelector("[role='separator']")).cursor)).toBe(expected)
    })
  }

  test("no cursor at an edge when every panel before or after it is disabled", async ({ group, page }) => {
    {
      await group.render(`
        <resizable-group>
          <resizable-panel id="left" disabled></resizable-panel>
          <resizable-panel id="center"></resizable-panel>
          <resizable-panel id="right"></resizable-panel>
        </resizable-group>
      `)

      await group.expectCursor("auto")

      let center = group.center(await group.hitArea([ "left", "center" ]))
      await page.mouse.move(center.x, center.y, moveConfig)
      await group.expectCursor("auto")

      center = group.center(await group.hitArea([ "center", "right" ]))
      await page.mouse.move(center.x, center.y, moveConfig)
      await group.expectCursor("ew-resize", "col-resize")
    }

    {
      await group.render(`
        <resizable-group>
          <resizable-panel id="left"></resizable-panel>
          <resizable-panel id="center"></resizable-panel>
          <resizable-panel id="right" disabled></resizable-panel>
        </resizable-group>
      `)

      await group.expectCursor("auto")

      let center = group.center(await group.hitArea([ "left", "center" ]))
      await page.mouse.move(center.x, center.y, moveConfig)
      await group.expectCursor("ew-resize", "col-resize")

      center = group.center(await group.hitArea([ "center", "right" ]))
      await page.mouse.move(center.x, center.y, moveConfig)
      await group.expectCursor("auto")
    }
  })
})
