import { test } from "../test_helper.js"

// Static content between panels: the spaces around it can be dragged, the
// content itself cannot.
const MARKUP = `
  <resizable-group>
    <resizable-panel id="foo"><div>id: foo</div></resizable-panel>
    <div>foo+bar</div>
    <resizable-panel id="bar"><div>id: bar</div></resizable-panel>
    <resizable-separator id="bar+baz"></resizable-separator>
    <div>bar+baz</div>
    <resizable-panel id="baz"><div>id: baz</div></resizable-panel>
    <resizable-separator id="baz+qux+left"></resizable-separator>
    <div>baz+qux</div>
    <resizable-separator id="baz+qux+right"></resizable-separator>
    <resizable-panel id="qux"><div>id: qux</div></resizable-panel>
  </resizable-group>
`

async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y)
  await page.mouse.up()
}

test.describe("fixed size elements", () => {
  test("are not interactive themselves", async ({ group, page }) => {
    await group.render(MARKUP)
    await group.expectCounts(1)

    for (const text of [ "foo+bar", "bar+baz", "baz+qux" ]) {
      const box = await page.getByText(text, { exact: true }).boundingBox()
      await drag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, { x: 0, y: 0 })
    }

    await page.waitForTimeout(100)
    await group.expectCounts(1)
  })

  test("work without an explicit separator", async ({ group, page }) => {
    await group.render(MARKUP)
    await group.expectCounts(1)

    const boxFoo = await group.box("foo")
    await drag(page, { x: boxFoo.x + boxFoo.width, y: boxFoo.y }, { x: 0, y: 0 })
    await group.expectCounts(2)

    const boxBar = await group.box("bar")
    await drag(page, { x: boxBar.x, y: boxBar.y }, { x: 1000, y: 0 })
    await group.expectCounts(3)
  })

  test("work with an explicit separator", async ({ group, page }) => {
    await group.render(MARKUP)

    const separatorBox = await group.box("bar+baz")
    await drag(page, { x: separatorBox.x, y: separatorBox.y }, { x: 0, y: 0 })
    await group.expectCounts(2)

    const boxBaz = await group.box("baz")
    await drag(page, { x: boxBaz.x, y: boxBaz.y }, { x: 1000, y: 0 })
    await group.expectCounts(3)
  })

  test("work with two explicit separators", async ({ group, page }) => {
    await group.render(MARKUP)

    let separatorBox = await group.box("baz+qux+left")
    await drag(page, { x: separatorBox.x, y: separatorBox.y }, { x: 0, y: 0 })
    await group.expectCounts(2)

    separatorBox = await group.box("baz+qux+right")
    await drag(page, { x: separatorBox.x, y: separatorBox.y }, { x: 1000, y: 0 })
    await group.expectCounts(3)
  })
})
