import { expect } from "@playwright/test"

// Drives the sandbox fixture: renders markup, drags boundaries, and reads back
// the events the elements dispatched. Layout numbers are rounded, as the React
// library's harness prints them.
export class GroupHandle {
  constructor(page, browserName, { popup = false } = {}) {
    this.page = page
    this.browserName = browserName
    this.popup = popup
  }

  // A popup is opened blank by the page fixture and has nowhere to navigate
  // to; each render just replaces its contents.
  async open() {
    if (this.popup) return

    await this.page.goto("/sandbox.html")
    await this.page.waitForFunction(() => typeof globalThis.render === "function")
  }

  async render(html) {
    await this.open()
    await this.page.evaluate(markup => globalThis.render(markup), html)
  }

  element(id) {
    return this.page.locator(`[id="${id}"]`)
  }

  separator(id) {
    return id ? this.element(id) : this.page.getByRole("separator")
  }

  async box(id) {
    return this.element(id).boundingBox()
  }

  async events(type, groupId) {
    return this.page.evaluate(([ eventType, id ]) => {
      return globalThis.recordedEvents.filter(event => event.type === eventType && (id === undefined || event.id === id))
    }, [ type, groupId ])
  }

  async counts(groupId) {
    return {
      change: (await this.events("layout-change", groupId)).length,
      changed: (await this.events("layout-changed", groupId)).length
    }
  }

  async layout(groupId) {
    const events = await this.page.evaluate(id => {
      return globalThis.recordedEvents.filter(event => event.type.startsWith("layout-change") && (id === undefined || event.id === id))
    }, groupId)

    const layout = events.at(-1)?.detail.layout ?? {}
    return Object.fromEntries(Object.entries(layout).map(([ key, value ]) => [ key, Math.round(value) ]))
  }

  // The last reported size of a panel, with how many times it was reported.
  async panelSize(panelId) {
    const events = (await this.events("resize")).filter(event => event.id === panelId)
    const round = size => size && { asPercentage: Math.round(size.asPercentage), inPixels: Math.round(size.inPixels) }
    const last = events.at(-1)?.detail

    return {
      onResizeCount: events.length,
      panelSize: round(last?.size),
      prevPanelSize: round(last?.prevSize)
    }
  }

  async expectCounts(change, changed = change, groupId) {
    await expect.poll(() => this.counts(groupId)).toEqual({ change, changed })
  }

  async expectLayout(layout, groupId) {
    await expect.poll(() => this.layout(groupId)).toMatchObject(layout)
  }

  async expectPanelSize(panelId, expected) {
    await expect.poll(() => this.panelSize(panelId)).toEqual({ prevPanelSize: undefined, ...expected })
  }

  // A resize notification whose size equals the previous one reports nothing.
  async expectNoRepeatedResize(panelId) {
    const repeated = (await this.events("resize")).filter(event => {
      const { size, prevSize } = event.detail
      return event.id === panelId && prevSize && size.inPixels === prevSize.inPixels && size.asPercentage === prevSize.asPercentage
    })

    expect(repeated).toEqual([])
  }

  // The space between two panels, where a drag starts when there is no
  // separator, or where the separator sits when there is one.
  async hitArea([ idA, idB ]) {
    const boxA = await this.box(idA)
    const boxB = await this.box(idB)

    if (boxA.y === boxB.y) {
      return { x: boxA.x + boxA.width, y: boxA.y, height: boxA.height, width: boxB.x - (boxA.x + boxA.width) }
    }

    return { x: boxA.x, y: boxA.y + boxA.height, height: boxB.y - (boxA.y + boxA.height), width: boxA.width }
  }

  center(box) {
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }

  async resize(panelIds, deltaX = 0, deltaY = 0) {
    const { x, y } = this.center(await this.hitArea(panelIds))

    await this.page.mouse.move(x, y)
    await this.page.mouse.down()
    await this.moveTo(x + deltaX, y + deltaY, { steps: 1 })
    await this.page.mouse.up()
  }

  // Playwright's Firefox cannot move the mouse past the viewport: it reports
  // a move to x=0 with no buttons held, which reads as a release that happened
  // out of sight. The React library's specs drag well past the edge to hit a
  // limit, so moves are kept just inside it — which reaches the same limit.
  async moveTo(x, y, options) {
    const { width, height } = this.page.viewportSize()
    const clamp = (value, max) => Math.min(Math.max(value, 0), max - 1)

    await this.page.mouse.move(clamp(x, width), clamp(y, height), options)
  }

  async aria(id) {
    return this.page.evaluate(separatorId => {
      const element = separatorId ? document.getElementById(separatorId) : document.querySelector("[role='separator']")
      return {
        "aria-controls": element?.getAttribute("aria-controls"),
        "aria-valuemax": element?.getAttribute("aria-valuemax"),
        "aria-valuemin": element?.getAttribute("aria-valuemin"),
        "aria-valuenow": element?.getAttribute("aria-valuenow")
      }
    }, id)
  }

  async bodyCursor() {
    return this.page.evaluate(() => getComputedStyle(document.body).cursor)
  }

  // WebKit gets the plainer cursor family, and no directional cursors at a
  // limit, because Safari draws the directional ones unreliably.
  get advancedCursors() {
    return this.browserName !== "webkit"
  }

  async expectCursor(advanced, fallback = advanced) {
    expect(await this.bodyCursor()).toBe(this.advancedCursors ? advanced : fallback)
  }
}
