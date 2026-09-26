import { getMountedGroupState, subscribeToMountedGroup, updateMountedGroup } from "../engine/groups_state"
import { getImperativeGroupMethods } from "../engine/imperative_methods"
import { getInteractionState, subscribeToInteractionState } from "../engine/interaction_state"
import { installStyles } from "./styles"
import { layoutNumbersEqual, layoutsEqual } from "../layout/layout_numbers"
import { ListenerBin } from "../helpers/listener_helper"
import { calculatePanelConstraints } from "../dom/measurements"
import { calculateSeparatorAriaValues } from "../layout/separator_aria_values"
import { mountGroup } from "../engine/mount_group"
import { renderPreview } from "./resize_preview"
import { sortByElementOffset } from "../dom/sort_by_offset"
import { uniqueId } from "../helpers/dom_helper"

const OVERLAY_SOURCE_SELECTOR = "resizable-separator-overlay[data-separator-overlay-source]"

const STORAGE_KEY_PREFIX = "resizable-panels-zero"
const DEFAULT_RESIZE_TARGET_MINIMUM_SIZE = { coarse: 20, fine: 10 }

function isOverlayNode(node) {
  return node.nodeType === Node.ELEMENT_NODE && (node.matches(OVERLAY_SOURCE_SELECTOR) || node.localName === "resizable-separator-overlay")
}

function isOverlayMutation(record) {
  const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement
  if (target?.closest("[data-resize-preview]")) return false
  if (target?.closest(OVERLAY_SOURCE_SELECTOR)) return true

  return [ ...record.addedNodes, ...record.removedNodes ].some(isOverlayNode)
}

// Panels and separators register themselves with the group they are a direct
// child of. Anything that changes the set of panels or their constraints tears
// the group down and mounts it again — the vanilla equivalent of the React
// Group re-running its layout effect — and the work is batched into a
// microtask, so building a group out of ten elements mounts it once.
export default class ResizableGroupElement extends HTMLElement {
  static observedAttributes = [
    "id", "orientation", "disabled", "disable-cursor", "resize-preview-mode",
    "default-layout", "autosave"
  ]

  #panels = new Set()
  #separators = new Set()
  #registered = null
  #unmount = null
  #subscriptions = new ListenerBin()
  #previews = new Map()
  #overlayObserver = null
  #mountScheduled = false
  #connected = false
  #storage = null
  #resizeTargetMinimumSize = DEFAULT_RESIZE_TARGET_MINIMUM_SIZE

  // Carried across remounts, as the React Group keeps them in a ref: the layout
  // last seen for each set of panel ids, so conditionally shown panels come
  // back where they were, and each collapsible panel's size before it
  // collapsed, so Enter can restore it.
  #layouts = {}
  #expandedPanelSizes = {}
  #lastLayouts = { change: {}, changed: {} }

  connectedCallback() {
    this.#connected = true

    installStyles(this.getAttribute("nonce"))

    if (!this.id) this.id = uniqueId("resizable-group")
    this.setAttribute("data-group", "")

    this.#scheduleMount()
  }

  disconnectedCallback() {
    this.#connected = false
    this.#teardown()
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.#connected || oldValue === newValue) return

    const registered = this.#registered

    switch (name) {
      case "disable-cursor":
        if (registered) registered.mutableState.disableCursor = this.disableCursor
        break
      case "default-layout":
      case "autosave":
        // Like the React prop, a new default only matters the next time the
        // group has to work out a layout from scratch.
        if (registered) registered.mutableState.defaultLayout = this.#readDefaultLayout(registered.panels)
        break
      default:
        this.#scheduleMount()
    }
  }

  get orientation() {
    return this.getAttribute("orientation") === "vertical" ? "vertical" : "horizontal"
  }

  set orientation(newValue) {
    this.setAttribute("orientation", newValue)
  }

  get disabled() {
    return this.hasAttribute("disabled")
  }

  set disabled(newValue) {
    this.toggleAttribute("disabled", Boolean(newValue))
  }

  get disableCursor() {
    return this.hasAttribute("disable-cursor")
  }

  set disableCursor(newValue) {
    this.toggleAttribute("disable-cursor", Boolean(newValue))
  }

  get resizePreviewMode() {
    return this.getAttribute("resize-preview-mode") === "separator" ? "separator" : "panel"
  }

  set resizePreviewMode(newValue) {
    this.setAttribute("resize-preview-mode", newValue)
  }

  get defaultLayout() {
    const attribute = this.getAttribute("default-layout")
    if (!attribute) return undefined

    try {
      return JSON.parse(attribute)
    } catch {
      console.warn(`resizable-panels-zero: default-layout is not valid JSON: ${attribute}`)
      return undefined
    }
  }

  set defaultLayout(newValue) {
    if (newValue == null) {
      this.removeAttribute("default-layout")
    } else {
      this.setAttribute("default-layout", JSON.stringify(newValue))
    }
  }

  get autosave() {
    return this.getAttribute("autosave")
  }

  set autosave(newValue) {
    if (newValue == null) {
      this.removeAttribute("autosave")
    } else {
      this.setAttribute("autosave", newValue)
    }
  }

  // Anything with `getItem` and `setItem` works: `sessionStorage`, or a small
  // object that writes a cookie so the server can render the saved layout.
  get storage() {
    if (this.#storage) return this.#storage

    try {
      return globalThis.localStorage
    } catch {
      // Reading `localStorage` throws in a sandboxed iframe.
      return undefined
    }
  }

  set storage(newValue) {
    this.#storage = newValue
  }

  get resizeTargetMinimumSize() {
    return this.#resizeTargetMinimumSize
  }

  set resizeTargetMinimumSize(newValue) {
    this.#resizeTargetMinimumSize = { ...DEFAULT_RESIZE_TARGET_MINIMUM_SIZE, ...newValue }
  }

  getLayout() {
    if (!this.#isMounted()) return {}
    return getImperativeGroupMethods({ groupId: this.#registered.id }).getLayout()
  }

  setLayout(layout) {
    if (!this.#isMounted()) return {}
    return getImperativeGroupMethods({ groupId: this.#registered.id }).setLayout(layout)
  }

  // Called by the panels and separators.

  registerPanel(element) {
    this.#panels.add(element)

    // Before the first mount a panel can already take its share from the
    // default layout, which avoids a visible jump once the group measures.
    const size = this.defaultLayout?.[element.id]
    if (size !== undefined && !this.#registered) element.paintSize(size)

    this.#scheduleMount()
  }

  unregisterPanel(element) {
    if (this.#panels.delete(element)) this.#scheduleMount()
  }

  registerSeparator(element) {
    this.#separators.add(element)
    element.paintOrientation(this.orientation)
    this.#scheduleMount()
  }

  unregisterSeparator(element) {
    if (this.#separators.delete(element)) this.#scheduleMount()
  }

  panelDidChange() {
    this.#scheduleMount()
  }

  // Disabling a panel does not change the layout, so the group is not rebuilt;
  // only the constraints are worked out again.
  panelDisabledDidChange(element) {
    const registered = this.#registered
    const panel = registered?.panels.find(current => current.element === element)
    if (!panel) return

    panel.panelConstraints.disabled = element.disabled

    const groupState = getMountedGroupState(registered.id)
    if (groupState) {
      updateMountedGroup(registered, { ...groupState, derivedPanelConstraints: calculatePanelConstraints(registered) })
    }
  }

  separatorDidChange(element) {
    const separator = this.#registered?.separators.find(current => current.element === element)
    if (!separator) return

    separator.disabled = element.disabled
    separator.disableDoubleClick = element.disableDoubleClick
  }

  separatorIdDidChange() {
    this.#scheduleMount()
  }

  #scheduleMount() {
    if (this.#mountScheduled) return
    this.#mountScheduled = true

    queueMicrotask(() => {
      this.#mountScheduled = false
      if (this.#connected) this.#mount()
    })
  }

  #isMounted() {
    return this.#registered !== null && getMountedGroupState(this.#registered.id) !== undefined
  }

  #mount() {
    this.#teardown()

    const orientation = this.orientation

    const panels = sortByElementOffset(orientation, this.#childEntries(this.#panels)).map(({ element }) => ({
      element,
      id: element.id,
      idIsStable: true,
      mutableValues: { expandToSize: undefined, prevSize: undefined },
      onResize: (size, id, prevSize) => {
        element.dispatchEvent(new CustomEvent("resizable-panel:resize", { detail: { size, prevSize }, bubbles: true }))
      },
      panelConstraints: element.panelConstraints
    }))

    const separators = sortByElementOffset(orientation, this.#childEntries(this.#separators)).map(({ element }) => ({
      disabled: element.disabled,
      disableDoubleClick: element.disableDoubleClick,
      element,
      id: element.id
    }))

    const element = this
    const group = {
      disabled: this.disabled,
      element,
      id: this.id,
      mutableState: {
        defaultLayout: this.#readDefaultLayout(panels),
        disableCursor: this.disableCursor,
        expandedPanelSizes: this.#expandedPanelSizes,
        layouts: this.#layouts
      },
      orientation,
      panels,
      resizePreviewMode: this.resizePreviewMode,
      get resizeTargetMinimumSize() {
        return element.resizeTargetMinimumSize
      },
      separators
    }

    separators.forEach(separator => separator.element.paintOrientation(orientation))

    this.#registered = group
    this.#unmount = mountGroup(group)

    this.#subscriptions.track(subscribeToMountedGroup(group.id, event => this.#groupDidChange(group, event)))
    this.#subscriptions.track(subscribeToInteractionState(({ next }) => this.#interactionDidChange(group, next)))

    const groupState = getMountedGroupState(group.id, true)
    this.#render(group, groupState)
    this.#interactionDidChange(group, getInteractionState())

    if (!groupState.defaultLayoutDeferred && groupState.derivedPanelConstraints.length > 0) {
      this.#layoutDidChange(groupState.layout)
      // Mounting is never the user's doing.
      this.#layoutDidCommit(groupState.layout, false)
    }
  }

  #teardown() {
    this.#subscriptions.dispose()
    this.#unmount?.()
    this.#unmount = null
    this.#registered = null
    this.#clearPreviews()
  }

  // Only direct children count; a panel of a nested group registers there.
  #childEntries(elements) {
    return Array.from(elements).filter(element => element.parentElement === this).map(element => ({ element }))
  }

  #groupDidChange(group, event) {
    const { defaultLayoutDeferred, derivedPanelConstraints, layout } = event.next

    this.#render(group, event.next)

    // The group has not finished mounting — it is probably in a hidden
    // subtree — so the layout has not been validated and is not reported.
    if (defaultLayoutDeferred || derivedPanelConstraints.length === 0) return

    group.mutableState.layouts[group.panels.map(({ id }) => id).join(",")] = layout

    // A collapsible panel that just collapsed remembers its previous size.
    const prevLayout = event.prev?.layout
    if (prevLayout) {
      derivedPanelConstraints.forEach(constraints => {
        if (!constraints.collapsible) return

        const isCollapsed = layoutNumbersEqual(constraints.collapsedSize, layout[constraints.panelId])
        const wasCollapsed = layoutNumbersEqual(constraints.collapsedSize, prevLayout[constraints.panelId])
        if (isCollapsed && !wasCollapsed) {
          group.mutableState.expandedPanelSizes[constraints.panelId] = prevLayout[constraints.panelId]
        }
      })
    }

    // During a drag the layout keeps changing; it has only changed once the
    // pointer lets go.
    const interactionState = getInteractionState()
    const isCompleted = interactionState.state !== "active" || !interactionState.hitRegions.some(region => region.group === group)

    this.#layoutDidChange(layout)
    if (isCompleted) this.#layoutDidCommit(layout, event.isUserInteraction)
  }

  #interactionDidChange(group, interaction) {
    group.separators.forEach(separator => {
      const isInvolved = interaction.state !== "inactive" && interaction.hitRegions.some(hitRegion => hitRegion.separator === separator)
      separator.element.paintInteraction(isInvolved ? interaction.state : "inactive")
    })

    this.#renderPreviews(group, interaction)
  }

  #render(group, { derivedPanelConstraints, layout, separatorToPanels }) {
    group.panels.forEach(panel => {
      panel.element.paintSize(layout[panel.id] ?? 1)
    })

    group.separators.forEach(separator => {
      const panels = separatorToPanels.get(separator)
      if (!panels) return

      // The index is into the whole group, not the pair around the separator,
      // because it is used as a pivot into the group's layout.
      const primaryPanel = panels[0]
      const panelIndex = derivedPanelConstraints.findIndex(constraints => constraints.panelId === primaryPanel.id)

      separator.element.paintAria(calculateSeparatorAriaValues({
        layout,
        panelConstraints: derivedPanelConstraints,
        panelId: primaryPanel.id,
        panelIndex
      }))
    })
  }

  #renderPreviews(group, interaction, rebuild = false) {
    const previews = group.resizePreviewMode === "separator" && interaction.state === "active"
      ? interaction.previews.filter(preview => preview.group === group && (preview.active || !layoutNumbersEqual(preview.offset, 0)))
      : []

    const keys = new Set(previews.map(preview => preview.key))
    this.#previews.forEach((element, key) => {
      if (keys.has(key)) return

      element.remove()
      this.#previews.delete(key)
    })

    previews.forEach(preview => {
      let element = this.#previews.get(preview.key)
      if (!element) {
        element = this.ownerDocument.createElement("div")
        this.#previews.set(preview.key, element)
        this.append(element)
      }

      renderPreview(element, preview, this.querySelector(":scope > resizable-separator-overlay"), rebuild)
    })

    this.#watchOverlays(group, previews.length > 0)
  }

  // An overlay edited or removed mid-drag shows up in the previews straight
  // away, as a changed `preview` prop does in the React library. Only changes
  // to the overlay templates count; the previews' own repaints are ignored.
  #watchOverlays(group, isWatching) {
    if (!isWatching) {
      this.#overlayObserver?.disconnect()
      this.#overlayObserver = null
      return
    }

    if (this.#overlayObserver) return

    this.#overlayObserver = new MutationObserver(records => {
      if (records.some(isOverlayMutation)) this.#renderPreviews(group, getInteractionState(), true)
    })
    this.#overlayObserver.observe(this, { attributes: true, characterData: true, childList: true, subtree: true })
  }

  #clearPreviews() {
    this.#overlayObserver?.disconnect()
    this.#overlayObserver = null

    this.#previews.forEach(element => element.remove())
    this.#previews.clear()
  }

  #layoutDidChange(layout) {
    if (layoutsEqual(this.#lastLayouts.change, layout)) return
    this.#lastLayouts.change = layout

    this.dispatchEvent(new CustomEvent("resizable-group:layout-change", { detail: { layout }, bubbles: true }))
  }

  #layoutDidCommit(layout, isUserInteraction) {
    if (layoutsEqual(this.#lastLayouts.changed, layout)) return
    this.#lastLayouts.changed = layout

    this.#saveLayout(layout, isUserInteraction)
    this.dispatchEvent(new CustomEvent("resizable-group:layout-changed", { detail: { layout, isUserInteraction }, bubbles: true }))
  }

  // The saved layout is keyed by the panel ids as well, so a group whose
  // panels come and go keeps one saved layout per combination.
  #storageKey(panelIds) {
    return [ STORAGE_KEY_PREFIX, this.autosave, ...panelIds ].join(":")
  }

  #saveLayout(layout, isUserInteraction) {
    if (!this.autosave) return
    if (this.hasAttribute("autosave-user-only") && !isUserInteraction) return

    try {
      this.storage?.setItem(this.#storageKey(Object.keys(layout)), JSON.stringify(layout))
    } catch (error) {
      console.error(error)
    }
  }

  #readSavedLayout(panelIds) {
    if (!this.autosave) return undefined

    try {
      const saved = this.storage?.getItem(this.#storageKey(panelIds))
      if (!saved) return undefined

      const parsed = JSON.parse(saved)
      if (Object.values(parsed).every(value => typeof value === "number")) return parsed
    } catch (error) {
      console.error(error)
    }

    return undefined
  }

  // A saved layout wins over the declared default. Either is re-keyed in panel
  // order, because the layout algorithms walk it in order and a default written
  // in another order would put sizes on the wrong panels.
  #readDefaultLayout(panels) {
    const panelIds = panels.map(({ id }) => id)
    const defaultLayout = this.#readSavedLayout(panelIds) ?? this.defaultLayout
    if (!defaultLayout || Object.keys(defaultLayout).length !== panels.length) return undefined

    const sorted = {}
    for (const panelId of panelIds) {
      if (defaultLayout[panelId] !== undefined) sorted[panelId] = defaultLayout[panelId]
    }

    return sorted
  }
}
