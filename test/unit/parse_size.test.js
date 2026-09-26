import { beforeEach, describe, expect, test } from "vitest"
import { parseSizeAndUnit, sizeStyleToPixels, sizeToCss } from "src/sizes/parse_size"
import { setDefaultElementStyle, setElementStyle } from "./test_helper"

describe("parseSizeAndUnit", () => {
  describe("implicit units", () => {
    test("% units", () => {
      expect(parseSizeAndUnit("50")).toEqual([ 50, "%" ])
    })

    test("px units", () => {
      expect(parseSizeAndUnit(50)).toEqual([ 50, "px" ])
    })
  })

  describe("explicit units", () => {
    test("% units", () => {
      expect(parseSizeAndUnit("50%")).toEqual([ 50, "%" ])
    })

    test("px units", () => {
      expect(parseSizeAndUnit("50px")).toEqual([ 50, "px" ])
    })

    test("rem units", () => {
      expect(parseSizeAndUnit("50rem")).toEqual([ 50, "rem" ])
    })

    test("em units", () => {
      expect(parseSizeAndUnit("50em")).toEqual([ 50, "em" ])
    })

    test("vh units", () => {
      expect(parseSizeAndUnit("50vh")).toEqual([ 50, "vh" ])
    })

    test("vw units", () => {
      expect(parseSizeAndUnit("50vw")).toEqual([ 50, "vw" ])
    })
  })
})

describe("sizeStyleToPixels", () => {
  let panelElement

  beforeEach(() => {
    panelElement = document.createElement("div")
  })

  function toPixels(groupSize, styleProp) {
    return sizeStyleToPixels({ groupSize, panelElement, styleProp })
  }

  describe("implicit units", () => {
    test("% units", () => {
      expect(toPixels(800, "100")).toBe(800)
      expect(toPixels(800, "50")).toBe(400)
      expect(toPixels(800, "0")).toBe(0)
    })

    test("px units", () => {
      expect(toPixels(800, 800)).toBe(800)
      expect(toPixels(800, 400)).toBe(400)
      expect(toPixels(800, 0)).toBe(0)
    })
  })

  describe("explicit units", () => {
    test("% units", () => {
      expect(toPixels(800, "100%")).toBe(800)
      expect(toPixels(800, "50%")).toBe(400)
      expect(toPixels(800, "0%")).toBe(0)
    })

    test("px units", () => {
      expect(toPixels(800, "800px")).toBe(800)
      expect(toPixels(800, "400px")).toBe(400)
      expect(toPixels(800, "0px")).toBe(0)
    })

    test("rem units", () => {
      setElementStyle(document.body, { fontSize: 10 })
      setElementStyle(document.documentElement, { fontSize: 20 })

      expect(toPixels(100, "1rem")).toBe(20)
      expect(toPixels(100, ".5rem")).toBe(10)
      expect(toPixels(100, "0rem")).toBe(0)
    })

    test("em units", () => {
      setDefaultElementStyle({ fontSize: 20 })

      expect(toPixels(100, "1em")).toBe(20)
      expect(toPixels(100, ".5em")).toBe(10)
      expect(toPixels(100, "0em")).toBe(0)
    })

    test("vh units", () => {
      window.innerHeight = 800
      window.innerWidth = 1200

      expect(toPixels(1600, "100vh")).toBe(800)
      expect(toPixels(1600, "50vh")).toBe(400)
      expect(toPixels(1600, "0vh")).toBe(0)
    })

    test("vw units", () => {
      window.innerHeight = 1200
      window.innerWidth = 800

      expect(toPixels(1600, "100vw")).toBe(800)
      expect(toPixels(1600, "50vw")).toBe(400)
      expect(toPixels(1600, "0vw")).toBe(0)
    })
  })
})

describe("sizeToCss", () => {
  test("gives a bare string a percentage unit", () => {
    expect(sizeToCss("30")).toBe("30%")
  })

  test("gives a number a pixel unit", () => {
    expect(sizeToCss(200)).toBe("200px")
  })

  test("keeps an explicit unit", () => {
    expect(sizeToCss("25%")).toBe("25%")
    expect(sizeToCss("200px")).toBe("200px")
    expect(sizeToCss("2rem")).toBe("2rem")
    expect(sizeToCss("1.5em")).toBe("1.5em")
    expect(sizeToCss("50vh")).toBe("50vh")
    expect(sizeToCss("50vw")).toBe("50vw")
  })
})
