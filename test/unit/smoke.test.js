import { describe, expect, test } from "vitest"
import { mount, moveSeparator, recordEvents } from "./test_helper"

describe("smoke", () => {
  test("mounts, lays out and drags", async () => {
    const events = recordEvents("resizable-group:layout-changed")

    const group = await mount(`
      <resizable-group id="group" data-testid="0,0 100x50">
        <resizable-panel id="left" data-testid="0,0 50x50"></resizable-panel>
        <resizable-separator id="separator" data-testid="50,0 0x50"></resizable-separator>
        <resizable-panel id="right" data-testid="50,0 50x50"></resizable-panel>
      </resizable-group>
    `)

    expect(group.getLayout()).toEqual({ left: 50, right: 50 })
    expect(events.at(-1).detail).toEqual({ layout: { left: 50, right: 50 }, isUserInteraction: false })
    expect(document.getElementById("separator").getAttribute("aria-valuenow")).toBe("50")
    expect(document.getElementById("left").style.flexGrow).toBe("50")

    moveSeparator(10)
    expect(group.getLayout()).toEqual({ left: 60, right: 40 })
    expect(events.at(-1).detail).toEqual({ layout: { left: 60, right: 40 }, isUserInteraction: true })
  })
})
