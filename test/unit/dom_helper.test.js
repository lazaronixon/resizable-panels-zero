import {
  doRectsIntersect,
  getDistanceBetweenPointAndRect,
  isHTMLElement,
  isModal,
  isShadowRoot,
  uniqueId
} from "src/helpers/dom_helper"
import { afterEach, describe, expect, test } from "vitest"

describe("getDistanceBetweenPointAndRect", () => {
  const rect = new DOMRect(25, 25, 100, 50)

  test("should report the distance between the nearest border and an external point", () => {
    expect(getDistanceBetweenPointAndRect({ x: 5, y: 10 }, rect)).toEqual({ x: 20, y: 15 })
    expect(getDistanceBetweenPointAndRect({ x: 175, y: 100 }, rect)).toEqual({ x: 50, y: 25 })
  })

  test("should report the distance between the nearest border and an external point alt", () => {
    expect(getDistanceBetweenPointAndRect({ x: 35, y: 10 }, rect)).toEqual({ x: 0, y: 15 })
    expect(getDistanceBetweenPointAndRect({ x: 175, y: 75 }, rect)).toEqual({ x: 50, y: 0 })
  })

  test("should report the distance between the nearest border and an internal point", () => {
    expect(getDistanceBetweenPointAndRect({ x: 35, y: 55 }, rect)).toEqual({ x: 0, y: 0 })
    expect(getDistanceBetweenPointAndRect({ x: 110, y: 70 }, rect)).toEqual({ x: 0, y: 0 })
  })
})

describe("doRectsIntersect", () => {
  const emptyRect = { x: 0, y: 0, width: 0, height: 0 }
  const rect = { x: 25, y: 25, width: 50, height: 50 }

  function forkRect(partial) {
    return { ...rect, ...partial }
  }

  function verify(rectOne, rectTwo, expected) {
    expect(doRectsIntersect(rectOne, rectTwo), `${JSON.stringify(rectOne)} vs ${JSON.stringify(rectTwo)}`).toBe(expected)
  }

  test("should handle empty rects", () => {
    verify(emptyRect, emptyRect, false)
  })

  test("should support fully overlapping rects", () => {
    verify(rect, rect, true)

    verify(rect, forkRect({ x: 35, width: 30 }), true)
    verify(rect, forkRect({ y: 35, height: 30 }), true)
    verify(rect, forkRect({ x: 35, y: 35, width: 30, height: 30 }), true)

    verify(rect, forkRect({ x: 10, width: 100 }), true)
    verify(rect, forkRect({ y: 10, height: 100 }), true)
    verify(rect, forkRect({ x: 10, y: 10, width: 100, height: 100 }), true)
  })

  test.each([ [ { x: 0 } ], [ { y: 0 } ] ])("should support partially overlapping rects: %o", partial => {
    verify(forkRect(partial), rect, true)
  })

  test.each([
    [ { x: 100 } ],
    [ { x: -100 } ],
    [ { y: 100 } ],
    [ { y: -100 } ],
    [ { x: -100, y: -100 } ],
    [ { x: 100, y: 100 } ],
    [ { x: -25 } ],
    [ { x: 75 } ],
    [ { y: -25 } ],
    [ { y: 75 } ],
    [ { x: -25, y: -25 } ],
    [ { x: 75, y: 75 } ]
  ])("should support non-overlapping rects: %o", partial => {
    verify(forkRect(partial), rect, false)
  })

  test("should support all negative coordinates", () => {
    expect(doRectsIntersect({ x: -100, y: -100, width: 50, height: 50 }, { x: -110, y: -90, width: 50, height: 50 })).toBe(true)
  })
})

describe("isHTMLElement", () => {
  test("recognises elements", () => {
    expect(isHTMLElement(document.createElement("div"))).toBe(true)
  })

  test("rejects everything else", () => {
    expect(isHTMLElement(null)).toBe(false)
    expect(isHTMLElement(undefined)).toBe(false)
    expect(isHTMLElement(document.createTextNode("text"))).toBe(false)
    expect(isHTMLElement(document)).toBe(false)
    expect(isHTMLElement({})).toBe(false)
  })
})

describe("isShadowRoot", () => {
  test("recognises shadow roots", () => {
    const host = document.createElement("div")
    expect(isShadowRoot(host.attachShadow({ mode: "open" }))).toBe(true)
  })

  test("rejects everything else", () => {
    expect(isShadowRoot(null)).toBe(false)
    expect(isShadowRoot(document.createElement("div"))).toBe(false)
    expect(isShadowRoot({})).toBe(false)
  })
})

describe("isModal", () => {
  test("is false for an element that is not a modal", () => {
    expect(isModal(document.createElement("div"))).toBe(false)
  })

  test("is false when :modal cannot be matched", () => {
    const element = { matches: () => { throw new Error("unsupported") } }
    expect(isModal(element)).toBe(false)
  })

  test("reports what :modal matches", () => {
    expect(isModal({ matches: selector => selector === ":modal" })).toBe(true)
  })
})

describe("uniqueId", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  test("makes ids with the prefix", () => {
    const first = uniqueId("thing")
    const second = uniqueId("thing")

    expect(first).toMatch(/^thing-\d+$/)
    expect(second).not.toBe(first)
  })

  test("skips ids already in the document", () => {
    const probe = uniqueId("taken")
    const next = Number(probe.split("-")[1]) + 1
    document.body.innerHTML = `<div id="taken-${next}"></div>`

    expect(uniqueId("taken")).toBe(`taken-${next + 1}`)
  })

  test("skips ids already in the given document", () => {
    const ownerDocument = document.implementation.createHTMLDocument()
    const probe = uniqueId("elsewhere", ownerDocument)
    const next = Number(probe.split("-")[1]) + 1
    ownerDocument.body.innerHTML = `<div id="elsewhere-${next}"></div>`

    expect(uniqueId("elsewhere", ownerDocument)).toBe(`elsewhere-${next + 1}`)
  })
})
