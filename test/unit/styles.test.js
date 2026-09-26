import { describe, expect, test } from "vitest"
import { installStyles } from "src/elements/styles"

function styleElementsIn(ownerDocument) {
  return ownerDocument.querySelectorAll("#resizable-panels-zero-style")
}

describe("installStyles", () => {
  test("adds the rules to the given document once, first in its head", () => {
    const ownerDocument = document.implementation.createHTMLDocument()
    ownerDocument.head.append(ownerDocument.createElement("link"))

    installStyles(ownerDocument, "abc")
    installStyles(ownerDocument, "abc")

    const elements = styleElementsIn(ownerDocument)
    expect(elements).toHaveLength(1)
    expect(ownerDocument.head.firstElementChild).toBe(elements[0])
    expect(elements[0].getAttribute("nonce")).toBe("abc")
    expect(elements[0].textContent).toContain("resizable-group")
  })

  // A group in a popup or an iframe needs the rules in that document; the
  // script's own document having them already is not enough.
  test("gives each document its own copy", () => {
    const first = document.implementation.createHTMLDocument()
    const second = document.implementation.createHTMLDocument()

    installStyles(first)
    installStyles(second)

    expect(styleElementsIn(first)).toHaveLength(1)
    expect(styleElementsIn(second)).toHaveLength(1)
    expect(styleElementsIn(second)[0].hasAttribute("nonce")).toBe(false)
  })

  test("a connected group installs them in its own document", async () => {
    await import("resizable-panels-zero")

    const ownerDocument = document.implementation.createHTMLDocument()
    const group = document.createElement("resizable-group")
    ownerDocument.body.append(ownerDocument.adoptNode(group))

    expect(styleElementsIn(ownerDocument)).toHaveLength(1)
    group.remove()
  })
})
