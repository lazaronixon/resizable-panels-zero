import { expect, test } from "../test_helper.js"

const GROUP = `
  <resizable-group>
    <resizable-panel id="left" default-size="25%" min-size="150px"></resizable-panel>
    <resizable-separator></resizable-separator>
    <resizable-panel id="right"></resizable-panel>
  </resizable-group>
`

async function expectSizes(group, left, right) {
  await expect.poll(async () => (await group.panelSize("left")).panelSize?.asPercentage).toBe(left)
  await expect.poll(async () => (await group.panelSize("right")).panelSize?.asPercentage).toBe(right)
  await expect(group.separator()).toBeVisible()
}

test.describe("visibility", () => {
  // Stands in for React's <Activity>, which takes the subtree out of the
  // picture while hidden: here the group is removed and put back.
  test("a group added to the document later lays out when it arrives", async ({ group, page }) => {
    await group.render(`<template id="template">${GROUP}</template><div id="host"></div>`)

    const show = () => page.evaluate(() => {
      document.getElementById("host").replaceChildren(document.getElementById("template").content.cloneNode(true))
    })
    const hide = () => page.evaluate(() => document.getElementById("host").replaceChildren())

    await group.expectCounts(0)

    await show()
    await group.expectCounts(1)
    await expectSizes(group, 25, 75)

    await hide()
    await group.expectCounts(1)

    await page.setViewportSize({ width: 500, height: 500 })
    await show()

    await group.expectCounts(2)
    await expectSizes(group, 32, 68)
  })

  test("display: none defers the default layout until visible", async ({ group, page }) => {
    await group.render(`<div id="host" style="display: none">${GROUP}</div>`)

    const setVisible = visible => page.evaluate(value => {
      document.getElementById("host").style.display = value ? "block" : "none"
    }, visible)

    await group.expectCounts(0)

    await setVisible(true)
    await group.expectCounts(1)
    await expectSizes(group, 25, 75)

    await setVisible(false)
    await group.expectCounts(1)

    await page.setViewportSize({ width: 500, height: 500 })
    await setVisible(true)

    await group.expectCounts(2)
    await expectSizes(group, 32, 68)
  })
})
