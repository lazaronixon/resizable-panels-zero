import { afterEach, beforeEach, expect, vi } from "vitest"
import { EventEmitter } from "node:events"

import "resizable-panels-zero"

// jsdom has no layout: every size is 0 and every rect is empty. These mocks,
// ported from the React library's test setup, let a test say where each
// element sits and have `getBoundingClientRect`, the offset properties and a
// ResizeObserver agree with it. Importing this file installs them around every
// test in the importing file.

// Rects -----------------------------------------------------------------------

const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
const originalGetComputedStyle = window.getComputedStyle
const originalResizeObserver = window.ResizeObserver

const boundsEmitter = new EventEmitter()
boundsEmitter.setMaxListeners(100)

const elementToDOMRect = new Map()
const elementToStyle = new Map()

let defaultDomRect = new DOMRect(0, 0, 0, 0)
let getDOMRect
let defaultStyle
let resizeObserverDisabled = false

// An element can carry its own bounds as "x,y widthxheight" in its data-group,
// data-panel, data-separator or data-testid attribute.
// Each attribute is tried in turn because the elements write state into some of
// them — a separator's data-separator says "inactive", not where it is.
function boundsFromAttributes(element) {
  for (const name of [ "data-group", "data-panel", "data-separator", "data-testid" ]) {
    const match = element.getAttribute(name)?.match(/(\d+),(\d+) (\d+)x(\d+)/)
    if (!match) continue

    const [ , x, y, width, height ] = match
    return new DOMRect(parseInt(x), parseInt(y), parseInt(width), parseInt(height))
  }

  return undefined
}

export function setDefaultElementBounds(rect) {
  defaultDomRect = rect
  boundsEmitter.emit("change")
}

export function setElementBoundsFunction(value) {
  getDOMRect = value
  boundsEmitter.emit("change")
}

export function setElementBounds(element, rect) {
  elementToDOMRect.set(element, rect)
  boundsEmitter.emit("change", element)
}

function mockBoundingClientRect() {
  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (getDOMRect) {
      const rectOverride = getDOMRect(this)
      if (rectOverride) return rectOverride
    }

    return elementToDOMRect.get(this) || boundsFromAttributes(this) || defaultDomRect
  }

  const properties = {
    clientHeight: rect => rect.height,
    clientWidth: rect => rect.width,
    offsetHeight: rect => rect.height,
    offsetLeft: rect => rect.left,
    offsetTop: rect => rect.top,
    offsetWidth: rect => rect.width
  }

  Object.entries(properties).forEach(([ name, read ]) => {
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get() {
        return read(this.getBoundingClientRect())
      }
    })
  })
}

function unmockBoundingClientRect() {
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect

  defaultDomRect = new DOMRect(0, 0, 0, 0)
  getDOMRect = undefined

  elementToDOMRect.clear()
}

// Computed styles ---------------------------------------------------------------

export function setDefaultElementStyle(style) {
  defaultStyle = style
}

export function setElementStyle(element, style) {
  elementToStyle.set(element, style)
}

function mockGetComputedStyle() {
  const emptyStyle = {}

  window.getComputedStyle = function getComputedStyle(element) {
    return new Proxy(emptyStyle, {
      get(_, name) {
        const mockedStyle = elementToStyle.get(element) ?? defaultStyle ?? emptyStyle
        const actualStyle = originalGetComputedStyle(element)
        const value = name in mockedStyle ? mockedStyle[name] : actualStyle[name]

        return typeof value === "function" ? value.bind(actualStyle) : value
      }
    })
  }
}

function unmockGetComputedStyle() {
  window.getComputedStyle = originalGetComputedStyle
  elementToStyle.clear()
  defaultStyle = undefined
}

// ResizeObserver -----------------------------------------------------------------

// Observing an element reports it straight away, as a real observer does, and
// again whenever a test changes its bounds.
class MockResizeObserver {
  #callback
  #disconnected = false
  #elements = new Set()

  constructor(callback) {
    this.#callback = callback
    boundsEmitter.addListener("change", this.#onChange)
  }

  observe(element) {
    if (this.#disconnected) return

    this.#elements.add(element)
    this.#notify([ element ])
  }

  unobserve(element) {
    this.#elements.delete(element)
  }

  disconnect() {
    this.#disconnected = true
    this.#elements.clear()

    boundsEmitter.removeListener("change", this.#onChange)
  }

  #notify(elements) {
    if (resizeObserverDisabled) return

    const entries = elements.map(element => {
      const contentRect = element.getBoundingClientRect()

      return {
        borderBoxSize: [ { blockSize: contentRect.height, inlineSize: contentRect.width } ],
        contentBoxSize: [],
        contentRect,
        devicePixelContentBoxSize: [],
        target: element
      }
    })

    this.#callback(entries, this)
  }

  #onChange = target => {
    if (target) {
      if (this.#elements.has(target)) this.#notify([ target ])
    } else {
      this.#notify(Array.from(this.#elements))
    }
  }
}

export function disableResizeObserverForCurrentTest() {
  resizeObserverDisabled = true
}

// Mock registration records ------------------------------------------------------

let groupIdCounter = 0

// Builds a registration record — what an element hands the engine — without
// any custom elements, for testing the engine on its own. Bounds are relative
// to the group.
export function mockGroup(groupBounds, config = {}) {
  const groupId = config.id ?? `group-${++groupIdCounter}`

  let panelIdCounter = 0
  let separatorIdCounter = 0

  const groupElement = document.createElement("div")
  groupElement.setAttribute("data-group", groupId)

  setElementBounds(groupElement, groupBounds)

  const mockPanels = new Set()
  const mockSeparators = new Set()

  function relativeBoundsToBounds(relativeBounds) {
    return new DOMRect(
      groupBounds.x + relativeBounds.x,
      groupBounds.y + relativeBounds.y,
      relativeBounds.width,
      relativeBounds.height
    )
  }

  return {
    disabled: false,
    element: groupElement,
    id: groupId,
    mutableState: {
      defaultLayout: undefined,
      disableCursor: false,
      expandedPanelSizes: {},
      layouts: {}
    },
    orientation: "horizontal",
    resizePreviewMode: "panel",
    resizeTargetMinimumSize: { coarse: 20, fine: 10 },
    ...config,

    get panels() {
      return Array.from(mockPanels.values())
    },

    get separators() {
      return Array.from(mockSeparators.values())
    },

    addHTMLElement(relativeBounds) {
      const element = document.createElement("div")
      setElementBounds(element, relativeBoundsToBounds(relativeBounds))
      groupElement.appendChild(element)

      return function removeHTMLElement() {
        groupElement.removeChild(element)
      }
    },

    addPanel(relativeBounds, id = `${++panelIdCounter}`, constraints = {}) {
      const panelId = `${groupId}-${id}`

      const element = document.createElement("div")
      element.setAttribute("data-panel", panelId)
      if (constraints?.disabled) element.setAttribute("data-disabled", "")

      setElementBounds(element, relativeBoundsToBounds(relativeBounds))

      const panel = {
        element,
        id: panelId,
        idIsStable: true,
        mutableValues: { expandToSize: undefined, prevSize: undefined },
        panelConstraints: constraints,
        onResize: vi.fn()
      }

      mockPanels.add(panel)
      groupElement.appendChild(element)

      return function removePanel() {
        mockPanels.delete(panel)
        groupElement.removeChild(element)
      }
    },

    addSeparator(relativeBounds, id = `${groupId}-${++separatorIdCounter}`, disabled, disableDoubleClick) {
      const separatorId = `${groupId}-${id}`

      const element = document.createElement("div")
      element.setAttribute("data-separator", separatorId)
      if (disabled) element.setAttribute("aria-disabled", "")

      setElementBounds(element, relativeBoundsToBounds(relativeBounds))

      const separator = { disabled, disableDoubleClick, element, id: separatorId }

      mockSeparators.add(separator)
      groupElement.appendChild(element)

      return function removeSeparator() {
        mockSeparators.delete(separator)
        groupElement.removeChild(element)
      }
    }
  }
}

export function mockPointerEvent({ clientX = 0, clientY = 0, type = "pointermove" } = {}) {
  return { clientX, clientY, type }
}

// Elements ------------------------------------------------------------------------

// Groups mount in a microtask, once all their children have registered.
export async function flush() {
  await Promise.resolve()
  await Promise.resolve()
}

export async function mount(html) {
  document.body.innerHTML = html
  await flush()
  return document.querySelector("resizable-group")
}

export function unmount() {
  document.body.innerHTML = ""
}

// jsdom's PointerEvent may be missing or ignore some fields, so every field the
// library reads is pinned on the event itself.
export function pointerEvent(type, { clientX = 0, clientY = 0, buttons = 1, button = 0, pointerType = "mouse", pointerId = 1, movementX = 1, movementY = 1, relatedTarget = null } = {}) {
  const EventClass = window.PointerEvent ?? window.MouseEvent
  const event = new EventClass(type, { bubbles: true, cancelable: true, composed: true, clientX, clientY, buttons, button })

  const properties = { clientX, clientY, buttons, button, pointerType, pointerId, movementX, movementY, relatedTarget }
  Object.entries(properties).forEach(([ name, value ]) => {
    Object.defineProperty(event, name, { configurable: true, value })
  })

  return event
}

// Presses on the first separator (or the one with the given id), moves by
// `deltaInPixels` along the group's axis, and lets go.
export function moveSeparator(deltaInPixels, separatorId) {
  const separatorElement = separatorId
    ? document.getElementById(separatorId)
    : document.querySelector("[data-separator]")

  const groupOrientation = separatorElement.getAttribute("aria-orientation") === "horizontal" ? "vertical" : "horizontal"

  let clientX
  let clientY
  if (groupOrientation === "horizontal") {
    clientX = separatorElement.offsetLeft
    clientY = separatorElement.offsetHeight / 2
  } else {
    clientX = separatorElement.offsetWidth / 2
    clientY = separatorElement.offsetTop
  }

  const toX = groupOrientation === "horizontal" ? clientX + deltaInPixels : clientX
  const toY = groupOrientation === "vertical" ? clientY + deltaInPixels : clientY

  separatorElement.dispatchEvent(pointerEvent("pointerdown", { clientX, clientY }))
  separatorElement.dispatchEvent(pointerEvent("pointermove", { clientX: toX, clientY: toY }))
  separatorElement.dispatchEvent(pointerEvent("pointerup", { clientX: toX, clientY: toY, buttons: 0 }))
}

// Records every event of the given types dispatched inside the document.
export function recordEvents(...types) {
  const recorded = []
  const listeners = types.map(type => {
    const listener = event => recorded.push({ type, target: event.target, detail: event.detail })
    document.addEventListener(type, listener)
    return () => document.removeEventListener(type, listener)
  })

  recorded.stop = () => listeners.forEach(stop => stop())
  return recorded
}

// Only the details of recorded events of one type, optionally from one target.
export function detailsOf(recorded, type, target) {
  return recorded
    .filter(event => event.type === type && (!target || event.target === target))
    .map(event => event.detail)
}

export function keyDown(element, key, init = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init })
  element.dispatchEvent(event)
  return event
}

// Groups mount in a microtask, where a thrown error would otherwise surface as
// an unhandled exception. This collects them instead while `callback` runs.
export async function captureMicrotaskErrors(callback) {
  const errors = []
  const original = globalThis.queueMicrotask
  const capturing = task => original(() => {
    try {
      task()
    } catch (error) {
      errors.push(error)
    }
  })

  globalThis.queueMicrotask = capturing
  window.queueMicrotask = capturing

  try {
    await callback()
    await flush()
  } finally {
    globalThis.queueMicrotask = original
    window.queueMicrotask = original
  }

  return errors
}

// Setup ---------------------------------------------------------------------------

expect.addSnapshotSerializer({
  serialize(value) {
    return `${value.x}, ${value.y} (${value.width} x ${value.height})`
  },
  test(value) {
    return value !== null && typeof value === "object" && "x" in value && "y" in value && "width" in value && "height" in value
  }
})

beforeEach(() => {
  mockBoundingClientRect()
  mockGetComputedStyle()
  resizeObserverDisabled = false
  window.ResizeObserver = MockResizeObserver
})

afterEach(() => {
  unmount()

  groupIdCounter = 0

  unmockBoundingClientRect()
  unmockGetComputedStyle()
  window.ResizeObserver = originalResizeObserver
  resizeObserverDisabled = false
})
