import { calculateAvailableGroupSize, calculatePanelConstraints } from "../dom/measurements"
import { deleteMutableGroup, getMountedGroupState, updateMountedGroup } from "./groups_state"
import { formatLayoutNumber, layoutsEqual, panelConstraintsEqual } from "../layout/layout_numbers"
import {
  onDocumentContextMenu,
  onDocumentDoubleClick,
  onDocumentPointerDown,
  onDocumentPointerLeave,
  onDocumentPointerMove,
  onDocumentPointerOut,
  onDocumentPointerUp
} from "./pointer_handlers"
import { assert } from "../helpers/assert"
import { calculateHitRegions } from "../dom/hit_regions"
import { getDefaultLayout } from "../layout/default_layout"
import { onSeparatorKeyDown } from "./keyboard_handler"
import { preserveFixedPanelSizes } from "../layout/preserve_fixed_panel_sizes"
import { removeGroupFromInteraction } from "./interaction_state"
import { updateCursorStyle } from "../cursor/cursor_style"
import { validateGroupLayout } from "../layout/validate_group_layout"

// The document listeners are shared by every group in a document and counted,
// so the last group to go takes them with it. Counting per document is what
// lets groups live in iframes and popups too.
const ownerDocumentReferenceCounts = new Map()

// Registers a group — its element, panels and separators — with the global
// state, works out its first layout and starts watching its size. Returns the
// function that undoes all of it.
export function mountGroup(group) {
  let isMounted = true

  assert(group.element.ownerDocument.defaultView, "Cannot register an unmounted Group")

  const ResizeObserver = group.element.ownerDocument.defaultView.ResizeObserver

  // Both checks run before anything is registered, so a duplicate id throws
  // without leaving a half-mounted group behind.
  const panelIds = new Set()
  group.panels.forEach(panel => {
    assert(!panelIds.has(panel.id), `Panel ids must be unique; id "${panel.id}" was used more than once`)
    panelIds.add(panel.id)
  })

  const separatorIds = new Set()
  group.separators.forEach(separator => {
    assert(!separatorIds.has(separator.id), `Separator ids must be unique; id "${separator.id}" was used more than once`)
    separatorIds.add(separator.id)
  })

  // Watching the group keeps pixel and viewport-based constraints true as it
  // resizes; watching the panels reports their size to listeners.
  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const { borderBoxSize, target } = entry

      if (target !== group.element) {
        notifyPanelOnResize(group, target, borderBoxSize)
        continue
      }

      if (!isMounted) continue

      const groupSize = calculateAvailableGroupSize({ group })
      // Zero usually means a hidden subtree; there is nothing to measure yet.
      if (groupSize === 0) return

      const groupState = getMountedGroupState(group.id)
      if (!groupState) return

      const nextDerivedPanelConstraints = calculatePanelConstraints(group)

      const prevLayout = groupState.defaultLayoutDeferred
        ? getDefaultLayout({ group, panelConstraints: nextDerivedPanelConstraints })
        : groupState.layout
      const unsafeLayout = preserveFixedPanelSizes({
        group,
        nextGroupSize: groupSize,
        prevGroupSize: groupState.groupSize,
        prevLayout
      })
      const nextLayout = validateGroupLayout({ layout: unsafeLayout, panelConstraints: nextDerivedPanelConstraints })

      if (
        !groupState.defaultLayoutDeferred &&
        layoutsEqual(groupState.layout, nextLayout) &&
        panelConstraintsEqual(groupState.derivedPanelConstraints, nextDerivedPanelConstraints) &&
        groupState.groupSize === groupSize
      ) {
        continue
      }

      updateMountedGroup(group, {
        defaultLayoutDeferred: false,
        derivedPanelConstraints: nextDerivedPanelConstraints,
        groupSize,
        layout: nextLayout,
        separatorToPanels: groupState.separatorToPanels
      })
    }
  })

  resizeObserver.observe(group.element)

  group.panels.forEach(panel => {
    if (panel.onResize) resizeObserver.observe(panel.element)
  })

  const groupSize = calculateAvailableGroupSize({ group })

  const derivedPanelConstraints = calculatePanelConstraints(group)
  const defaultLayoutUnsafe = getDefaultLayout({ group, panelConstraints: derivedPanelConstraints })
  const defaultLayoutSafe = validateGroupLayout({ layout: defaultLayoutUnsafe, panelConstraints: derivedPanelConstraints })

  const ownerDocument = group.element.ownerDocument

  ownerDocumentReferenceCounts.set(ownerDocument, (ownerDocumentReferenceCounts.get(ownerDocument) ?? 0) + 1)

  // Disabled separators are mapped too: enabling one later does not rebuild
  // this map, and the keyboard handler checks the disabled state itself.
  const separatorToPanels = new Map()
  calculateHitRegions({ group, includeDisabled: true }).forEach(hitRegion => {
    if (hitRegion.separator) separatorToPanels.set(hitRegion.separator, hitRegion.panels)
  })

  updateMountedGroup(group, {
    defaultLayoutDeferred: groupSize === 0,
    derivedPanelConstraints,
    groupSize,
    layout: defaultLayoutSafe,
    separatorToPanels
  })

  group.separators.forEach(separator => {
    separator.element.addEventListener("keydown", onSeparatorKeyDown)
  })

  if (ownerDocumentReferenceCounts.get(ownerDocument) === 1) {
    ownerDocument.addEventListener("contextmenu", onDocumentContextMenu, true)
    ownerDocument.addEventListener("dblclick", onDocumentDoubleClick, true)
    ownerDocument.addEventListener("pointerdown", onDocumentPointerDown, true)
    ownerDocument.addEventListener("pointerleave", onDocumentPointerLeave)
    ownerDocument.addEventListener("pointermove", onDocumentPointerMove)
    ownerDocument.addEventListener("pointerout", onDocumentPointerOut)
    ownerDocument.addEventListener("pointerup", onDocumentPointerUp, true)
  }

  return function unmountGroup() {
    isMounted = false

    ownerDocumentReferenceCounts.set(ownerDocument, Math.max(0, (ownerDocumentReferenceCounts.get(ownerDocument) ?? 0) - 1))

    deleteMutableGroup(group)
    if (removeGroupFromInteraction(group)) updateCursorStyle(ownerDocument)

    group.separators.forEach(separator => {
      separator.element.removeEventListener("keydown", onSeparatorKeyDown)
    })

    if (!ownerDocumentReferenceCounts.get(ownerDocument)) {
      ownerDocument.removeEventListener("contextmenu", onDocumentContextMenu, true)
      ownerDocument.removeEventListener("dblclick", onDocumentDoubleClick, true)
      ownerDocument.removeEventListener("pointerdown", onDocumentPointerDown, true)
      ownerDocument.removeEventListener("pointerleave", onDocumentPointerLeave)
      ownerDocument.removeEventListener("pointermove", onDocumentPointerMove)
      ownerDocument.removeEventListener("pointerout", onDocumentPointerOut)
      ownerDocument.removeEventListener("pointerup", onDocumentPointerUp, true)
    }

    resizeObserver.disconnect()
  }
}

function notifyPanelOnResize(group, element, borderBoxSize) {
  if (!borderBoxSize?.[0]) return

  const panel = group.panels.find(current => current.element === element)
  if (!panel || !panel.onResize) return

  const groupSize = calculateAvailableGroupSize({ group })
  const panelSize = group.orientation === "horizontal" ? panel.element.offsetWidth : panel.element.offsetHeight

  const prevSize = panel.mutableValues.prevSize
  const nextSize = {
    asPercentage: formatLayoutNumber((panelSize / groupSize) * 100),
    inPixels: panelSize
  }

  // The layout is applied inside the group's own observer callback, so a panel
  // can already be at its final size when its first entry arrives; the entry
  // that follows for that same size is not a resize.
  if (prevSize && prevSize.inPixels === nextSize.inPixels && prevSize.asPercentage === nextSize.asPercentage) return

  panel.mutableValues.prevSize = nextSize

  panel.onResize(nextSize, panel.id, prevSize)
}
