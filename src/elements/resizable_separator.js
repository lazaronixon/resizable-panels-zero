import { attachToGroup } from "./group_member"
import { ListenerBin } from "../helpers/listener_helper"
import { uniqueId } from "../helpers/dom_helper"

// Separators are optional — the edge between two panels can be dragged without
// one — but they are what makes a group usable from the keyboard, and they
// are the thing to style.
export default class ResizableSeparatorElement extends HTMLElement {
  static observedAttributes = [ "id", "disabled", "disable-double-click" ]

  #group = null
  #listeners = new ListenerBin()
  #dragState = "inactive"
  #isFocused = false

  connectedCallback() {
    if (!this.id) this.id = uniqueId("resizable-separator", this.ownerDocument)
    this.setAttribute("role", "separator")

    this.#listeners.listen(this, "focus", () => this.#setFocused(true))
    this.#listeners.listen(this, "blur", () => this.#setFocused(false))
    this.#isFocused = this.ownerDocument.activeElement === this

    this.#paint()

    attachToGroup(this, group => {
      this.#group = group
      group.registerSeparator(this)
    })
  }

  disconnectedCallback() {
    this.#listeners.dispose()
    this.#group?.unregisterSeparator(this)
    this.#group = null
    this.#dragState = "inactive"
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return

    if (name === "id") {
      this.#group?.separatorIdDidChange(this)
    } else {
      this.#paint()
      this.#group?.separatorDidChange(this)
    }
  }

  get disabled() {
    return this.hasAttribute("disabled")
  }

  set disabled(newValue) {
    this.toggleAttribute("disabled", Boolean(newValue))
  }

  get disableDoubleClick() {
    return this.hasAttribute("disable-double-click")
  }

  set disableDoubleClick(newValue) {
    this.toggleAttribute("disable-double-click", Boolean(newValue))
  }

  // Called by the group.

  paintInteraction(dragState) {
    if (this.#dragState === dragState) return
    this.#dragState = dragState
    this.#paint()
  }

  // A separator between side-by-side panels is itself a vertical line.
  paintOrientation(groupOrientation) {
    this.setAttribute("aria-orientation", groupOrientation === "horizontal" ? "vertical" : "horizontal")
  }

  paintAria({ valueControls, valueMax, valueMin, valueNow }) {
    this.#setOrRemove("aria-controls", valueControls)
    this.#setOrRemove("aria-valuemax", valueMax)
    this.#setOrRemove("aria-valuemin", valueMin)
    this.#setOrRemove("aria-valuenow", valueNow)
  }

  #setFocused(isFocused) {
    this.#isFocused = isFocused
    this.#paint()
  }

  #setOrRemove(name, value) {
    if (value === undefined) {
      this.removeAttribute(name)
    } else {
      this.setAttribute(name, String(value))
    }
  }

  // `data-separator` is the one attribute to style against: "inactive",
  // "hover", "active" while dragged, "focus" and "disabled".
  #paint() {
    const disabled = this.disabled

    if (disabled) {
      this.removeAttribute("tabindex")
      this.setAttribute("aria-disabled", "true")
    } else {
      this.setAttribute("tabindex", "0")
      this.removeAttribute("aria-disabled")
    }

    let state
    if (disabled) {
      state = "disabled"
    } else if (this.#dragState === "active") {
      state = "active"
    } else if (this.#isFocused) {
      state = "focus"
    } else {
      state = this.#dragState
    }

    this.setAttribute("data-separator", state)
  }
}
