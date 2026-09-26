import { attachToGroup, setOrRemoveAttribute, sizeAttributeValue } from "./group_member"
import { getImperativePanelMethods } from "../engine/imperative_methods"
import { getMountedGroupState } from "../engine/groups_state"
import { sizeToCss } from "../sizes/parse_size"
import { uniqueId } from "../helpers/dom_helper"

// Changing any of these changes the layout math, so the group is rebuilt.
// `disabled` is the exception and takes a cheaper path.
const CONSTRAINT_ATTRIBUTES = [
  "default-size", "min-size", "max-size", "collapsed-size", "collapsed-threshold",
  "collapsible", "group-resize-behavior"
]

export default class ResizablePanelElement extends HTMLElement {
  static observedAttributes = [ "id", "disabled", ...CONSTRAINT_ATTRIBUTES ]

  #group = null

  connectedCallback() {
    if (!this.id) this.id = uniqueId("resizable-panel")
    this.setAttribute("data-panel", "")
    this.toggleAttribute("data-disabled", this.disabled)

    this.#paintFallback()

    attachToGroup(this, group => {
      this.#group = group
      group.registerPanel(this)
    })
  }

  disconnectedCallback() {
    this.#group?.unregisterPanel(this)
    this.#group = null
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return

    if (name === "disabled") {
      this.toggleAttribute("data-disabled", this.disabled)
      this.#group?.panelDisabledDidChange(this)
    } else {
      this.#group?.panelDidChange(this)
    }
  }

  get defaultSize() {
    return this.getAttribute("default-size")
  }

  set defaultSize(newValue) {
    setOrRemoveAttribute(this, "default-size", sizeAttributeValue(newValue))
  }

  get minSize() {
    return this.getAttribute("min-size") ?? "0%"
  }

  set minSize(newValue) {
    setOrRemoveAttribute(this, "min-size", sizeAttributeValue(newValue))
  }

  get maxSize() {
    return this.getAttribute("max-size") ?? "100%"
  }

  set maxSize(newValue) {
    setOrRemoveAttribute(this, "max-size", sizeAttributeValue(newValue))
  }

  get collapsedSize() {
    return this.getAttribute("collapsed-size") ?? "0%"
  }

  set collapsedSize(newValue) {
    setOrRemoveAttribute(this, "collapsed-size", sizeAttributeValue(newValue))
  }

  get collapsedThreshold() {
    return this.getAttribute("collapsed-threshold")
  }

  set collapsedThreshold(newValue) {
    setOrRemoveAttribute(this, "collapsed-threshold", sizeAttributeValue(newValue))
  }

  get collapsible() {
    return this.hasAttribute("collapsible")
  }

  set collapsible(newValue) {
    this.toggleAttribute("collapsible", Boolean(newValue))
  }

  get disabled() {
    return this.hasAttribute("disabled")
  }

  set disabled(newValue) {
    this.toggleAttribute("disabled", Boolean(newValue))
  }

  get groupResizeBehavior() {
    return this.getAttribute("group-resize-behavior") === "preserve-pixel-size" ? "preserve-pixel-size" : "preserve-relative-size"
  }

  set groupResizeBehavior(newValue) {
    this.setAttribute("group-resize-behavior", newValue)
  }

  // The constraints as the group's layout math reads them, still in whatever
  // unit they were written in.
  get panelConstraints() {
    return {
      collapsedSize: this.collapsedSize,
      collapsedThreshold: this.collapsedThreshold ?? undefined,
      collapsible: this.collapsible,
      defaultSize: this.defaultSize ?? undefined,
      disabled: this.disabled,
      groupResizeBehavior: this.groupResizeBehavior,
      maxSize: this.maxSize,
      minSize: this.minSize
    }
  }

  // Collapses the panel to its collapsed size. Does nothing unless the panel is
  // collapsible and not collapsed already.
  collapse() {
    this.#methods()?.collapse()
  }

  // Restores a collapsed panel to the size it had before it collapsed.
  expand() {
    this.#methods()?.expand()
  }

  getSize() {
    return this.#methods()?.getSize() ?? { asPercentage: 0, inPixels: 0 }
  }

  isCollapsed() {
    return this.#methods()?.isCollapsed() ?? false
  }

  // Takes the same sizes as the attributes: a number is pixels, a bare string
  // a percentage, and a suffix picks any other unit.
  resize(size) {
    this.#methods()?.resize(size)
  }

  // Called by the group each time the layout changes.
  paintSize(flexGrow) {
    this.style.flexGrow = String(flexGrow)
    this.style.removeProperty("flex-basis")
  }

  // Until the group has measured itself there are no percentages to hand out,
  // so the panel sizes itself from its default size, or takes an equal share.
  #paintFallback() {
    if (this.style.flexGrow) return

    const defaultSize = this.defaultSize
    if (defaultSize !== null) {
      this.style.flexBasis = sizeToCss(defaultSize)
    } else {
      this.style.flexGrow = "1"
    }
  }

  // The methods do nothing until the group has mounted with this panel in it.
  #methods() {
    const groupId = this.#group?.id
    if (!groupId || getMountedGroupState(groupId)?.layout[this.id] === undefined) return null

    return getImperativePanelMethods({ groupId, panelId: this.id })
  }
}
