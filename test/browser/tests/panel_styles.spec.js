import { expect, test } from "../test_helper.js"

// The unit tests cover the size properties; jsdom cannot tell whether the
// !important shorthands beat inline ones, so border, padding and margin are
// checked here, in a real browser.
test.describe("panel styles", () => {
  test("border, padding and margin on a panel are suppressed", async ({ group, page }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="styled" style="border: 100px solid black; padding: 100px; margin: 100px"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="plain"></resizable-panel>
      </resizable-group>
    `)

    await group.expectLayout({ styled: 50, plain: 50 })

    const style = await page.evaluate(() => {
      const computed = getComputedStyle(document.getElementById("styled"))
      return {
        borderWidth: computed.borderTopWidth,
        borderStyle: computed.borderTopStyle,
        padding: computed.paddingTop,
        margin: computed.marginTop
      }
    })
    expect(style).toEqual({ borderWidth: "0px", borderStyle: "none", padding: "0px", margin: "0px" })

    // Anything left over would throw the two halves off.
    const styled = await group.box("styled")
    const plain = await group.box("plain")
    expect(Math.round(styled.width)).toBe(Math.round(plain.width))
    expect(Math.round(styled.height)).toBe(Math.round(plain.height))
  })
})
