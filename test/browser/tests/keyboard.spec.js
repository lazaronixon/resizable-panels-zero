import { expect, test } from "../test_helper.js"

// https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
// https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/separator_role
test.describe("keyboard interactions: window splitter", () => {
  test("horizontal: arrow keys", async ({ group, page }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="left" default-size="30%" min-size="5%"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="right" min-size="5%"></resizable-panel>
      </resizable-group>
    `)

    await group.expectCounts(1)
    await group.expectLayout({ left: 30 })
    expect(await group.aria()).toEqual({ "aria-controls": "left", "aria-valuemax": "95", "aria-valuemin": "5", "aria-valuenow": "30" })

    await group.separator().focus()
    await page.keyboard.press("ArrowLeft")

    await group.expectCounts(2)
    await group.expectLayout({ left: 25 })
    expect(await group.aria()).toEqual({ "aria-controls": "left", "aria-valuemax": "95", "aria-valuemin": "5", "aria-valuenow": "25" })

    await page.keyboard.press("ArrowRight")

    await group.expectCounts(3)
    await group.expectLayout({ left: 30 })
    expect(await group.aria()).toEqual({ "aria-controls": "left", "aria-valuemax": "95", "aria-valuemin": "5", "aria-valuenow": "30" })

    // Up and down do nothing in a horizontal group.
    await page.keyboard.press("ArrowUp")
    await page.keyboard.press("ArrowDown")
    await group.expectCounts(3)
  })

  test("vertical: arrow keys", async ({ group, page }) => {
    await group.render(`
      <resizable-group orientation="vertical">
        <resizable-panel id="top" default-size="30%" min-size="5%"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="bottom" min-size="5%"></resizable-panel>
      </resizable-group>
    `)

    await group.expectCounts(1)
    await group.expectLayout({ top: 30 })
    expect(await group.aria()).toEqual({ "aria-controls": "top", "aria-valuemax": "95", "aria-valuemin": "5", "aria-valuenow": "30" })

    const separator = group.separator()
    await expect(separator).toHaveAttribute("data-separator", "inactive")

    await separator.focus()
    await expect(separator).toHaveAttribute("data-separator", "focus")

    await page.keyboard.press("ArrowDown")

    await group.expectCounts(2)
    await group.expectLayout({ top: 35 })
    expect(await group.aria()).toEqual({ "aria-controls": "top", "aria-valuemax": "95", "aria-valuemin": "5", "aria-valuenow": "35" })

    await page.keyboard.press("ArrowUp")

    await group.expectCounts(3)
    await group.expectLayout({ top: 30 })
    expect(await group.aria()).toEqual({ "aria-controls": "top", "aria-valuemax": "95", "aria-valuemin": "5", "aria-valuenow": "30" })

    // Left and right do nothing in a vertical group.
    await page.keyboard.press("ArrowLeft")
    await page.keyboard.press("ArrowRight")
    await group.expectCounts(3)
  })

  test("enter key and a collapsible panel", async ({ group, page }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="left" collapsible collapsed-size="5%" min-size="20%"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="right" min-size="20%"></resizable-panel>
      </resizable-group>
    `)

    const aria = valueNow => ({ "aria-controls": "left", "aria-valuemax": "80", "aria-valuemin": "5", "aria-valuenow": valueNow })

    await group.expectCounts(1)
    await group.expectLayout({ left: 50, right: 50 })
    expect(await group.aria()).toEqual(aria("50"))

    await group.separator().focus()
    await page.keyboard.press("Enter")

    await group.expectCounts(2)
    await group.expectLayout({ left: 5, right: 95 })
    expect(await group.aria()).toEqual(aria("5"))

    await page.keyboard.press("Enter")

    await group.expectCounts(3)
    await group.expectLayout({ left: 50, right: 50 })
    expect(await group.aria()).toEqual(aria("50"))

    await page.keyboard.press("ArrowLeft")

    await group.expectCounts(4)
    await group.expectLayout({ left: 45, right: 55 })
    expect(await group.aria()).toEqual(aria("45"))

    await page.keyboard.press("Enter")

    await group.expectCounts(5)
    await group.expectLayout({ left: 5, right: 95 })
    expect(await group.aria()).toEqual(aria("5"))

    await page.keyboard.press("Enter")

    await group.expectCounts(6)
    await group.expectLayout({ left: 45, right: 55 })
    expect(await group.aria()).toEqual(aria("45"))
  })

  test("enter key and a non-collapsible panel", async ({ group, page }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="left" min-size="20%"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="right" min-size="20%"></resizable-panel>
      </resizable-group>
    `)

    await group.expectCounts(1)
    await group.expectLayout({ left: 50, right: 50 })

    await group.separator().focus()
    await page.keyboard.press("Enter")

    await page.waitForTimeout(100)
    await group.expectCounts(1)
  })

  test("home and end keys", async ({ group, page }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel id="left" min-size="20%"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="right" collapsible collapsed-size="5%" min-size="20%"></resizable-panel>
      </resizable-group>
    `)

    await group.expectCounts(1)
    await group.expectLayout({ left: 50, right: 50 })

    await group.separator().focus()
    await page.keyboard.press("Home")

    await group.expectCounts(2)
    await group.expectLayout({ left: 20, right: 80 })

    await page.keyboard.press("End")

    await group.expectCounts(3)
    await group.expectLayout({ left: 95, right: 5 })
  })

  test("f6 cycles through separators", async ({ group, page }) => {
    await group.render(`
      <resizable-group>
        <resizable-panel></resizable-panel>
        <resizable-separator id="separator-left"></resizable-separator>
        <resizable-panel></resizable-panel>
        <resizable-separator id="separator-center"></resizable-separator>
        <div></div>
        <resizable-separator id="separator-right"></resizable-separator>
        <resizable-panel></resizable-panel>
      </resizable-group>
    `)

    await group.separator("separator-left").focus()
    await expect(group.separator("separator-left")).toBeFocused()

    await page.keyboard.press("F6")
    await expect(group.separator("separator-center")).toBeFocused()

    await page.keyboard.press("F6")
    await expect(group.separator("separator-right")).toBeFocused()

    await page.keyboard.press("F6")
    await expect(group.separator("separator-left")).toBeFocused()

    await page.keyboard.press("Shift+F6")
    await expect(group.separator("separator-right")).toBeFocused()
  })

  test("respects a disabled parent group", async ({ group, page }) => {
    await group.render(`
      <resizable-group disabled>
        <resizable-panel id="left" default-size="30%" min-size="5%"></resizable-panel>
        <resizable-separator></resizable-separator>
        <resizable-panel id="right" min-size="5%"></resizable-panel>
      </resizable-group>
    `)

    await group.expectCounts(1)
    await group.expectLayout({ left: 30 })

    await group.separator().focus()
    for (const key of [ "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Home" ]) {
      await page.keyboard.press(key)
    }

    await page.waitForTimeout(100)
    await group.expectCounts(1)
    await group.expectLayout({ left: 30 })
  })

  test("disabled separators cannot be focused", async ({ group }) => {
    await group.render(`
      <resizable-group disabled>
        <resizable-panel></resizable-panel>
        <resizable-separator id="separator" disabled></resizable-separator>
        <resizable-panel></resizable-panel>
      </resizable-group>
    `)

    const separator = group.separator("separator")
    await expect(separator).toHaveAttribute("aria-disabled", "true")
    await expect(separator).not.toHaveAttribute("tabindex")
  })
})
