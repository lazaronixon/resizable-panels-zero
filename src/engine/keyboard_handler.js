import { getMountedGroupState, getMountedGroups, updateMountedGroup } from "./groups_state"
import { adjustLayoutByDelta } from "../layout/adjust_layout_by_delta"
import { assert } from "../helpers/assert"
import { getImperativeGroupMethods } from "./imperative_methods"
import { layoutsEqual } from "../layout/layout_numbers"
import { validateGroupLayout } from "../layout/validate_group_layout"

const KEYBOARD_STEP = 5

export function findSeparatorGroup(separatorElement) {
  for (const [ group ] of getMountedGroups()) {
    if (group.separators.some(separator => separator.element === separatorElement)) return group
  }

  throw Error("Could not find parent Group for separator element")
}

export function adjustLayoutForSeparator(separatorElement, delta) {
  const group = findSeparatorGroup(separatorElement)
  const groupState = getMountedGroupState(group.id, true)

  const separator = group.separators.find(current => current.element === separatorElement)
  assert(separator, "Matching separator not found")

  const panels = groupState.separatorToPanels.get(separator)
  assert(panels, "Matching panels not found")

  const pivotIndices = panels.map(panel => group.panels.indexOf(panel))

  const prevLayout = getImperativeGroupMethods({ groupId: group.id }).getLayout()

  const unsafeLayout = adjustLayoutByDelta({
    delta,
    initialLayout: prevLayout,
    panelConstraints: groupState.derivedPanelConstraints,
    pivotIndices,
    prevLayout,
    trigger: "keyboard"
  })
  const nextLayout = validateGroupLayout({ layout: unsafeLayout, panelConstraints: groupState.derivedPanelConstraints })

  if (!layoutsEqual(prevLayout, nextLayout)) {
    // A key press on the separator is as much the user's doing as a drag.
    updateMountedGroup(group, { ...groupState, layout: nextLayout }, { isUserInteraction: true })
  }
}

// The keys follow the WAI-ARIA window splitter pattern:
// https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
export function onSeparatorKeyDown(keyboardEvent) {
  if (keyboardEvent.defaultPrevented) return

  const separatorElement = keyboardEvent.currentTarget

  const group = findSeparatorGroup(separatorElement)
  if (group.disabled) return

  const separator = group.separators.find(current => current.element === separatorElement)
  if (separator?.disabled) return

  switch (keyboardEvent.key) {
    case "ArrowDown": {
      keyboardEvent.preventDefault()
      if (group.orientation === "vertical") adjustLayoutForSeparator(separatorElement, KEYBOARD_STEP)
      break
    }
    case "ArrowLeft": {
      keyboardEvent.preventDefault()
      if (group.orientation === "horizontal") adjustLayoutForSeparator(separatorElement, -KEYBOARD_STEP)
      break
    }
    case "ArrowRight": {
      keyboardEvent.preventDefault()
      if (group.orientation === "horizontal") adjustLayoutForSeparator(separatorElement, KEYBOARD_STEP)
      break
    }
    case "ArrowUp": {
      keyboardEvent.preventDefault()
      if (group.orientation === "vertical") adjustLayoutForSeparator(separatorElement, -KEYBOARD_STEP)
      break
    }
    case "End": {
      // Gives the panel before the separator the largest size it may have,
      // which can collapse the one after it.
      keyboardEvent.preventDefault()
      adjustLayoutForSeparator(separatorElement, 100)
      break
    }
    case "Home": {
      // Gives the panel before the separator the smallest size it may have,
      // which can collapse it.
      keyboardEvent.preventDefault()
      adjustLayoutForSeparator(separatorElement, -100)
      break
    }
    case "Enter": {
      // Collapses the panel before the separator, or restores it to the size it
      // had before it was collapsed.
      keyboardEvent.preventDefault()

      const { derivedPanelConstraints, layout, separatorToPanels } = getMountedGroupState(group.id, true)

      const panels = separatorToPanels.get(separator)
      assert(panels, "Matching panels not found")

      const primaryPanel = panels[0]
      const constraints = derivedPanelConstraints.find(current => current.panelId === primaryPanel.id)
      assert(constraints, "Panel metadata not found")

      if (constraints.collapsible) {
        const prevSize = layout[primaryPanel.id]
        const nextSize = constraints.collapsedSize === prevSize
          ? (group.mutableState.expandedPanelSizes[primaryPanel.id] ?? constraints.minSize)
          : constraints.collapsedSize

        adjustLayoutForSeparator(separatorElement, nextSize - prevSize)
      }
      break
    }
    case "F6": {
      // Cycles focus through the group's separators.
      keyboardEvent.preventDefault()

      const separatorElements = group.separators.map(current => current.element)
      const index = separatorElements.indexOf(separatorElement)

      const nextIndex = keyboardEvent.shiftKey
        ? (index > 0 ? index - 1 : separatorElements.length - 1)
        : (index + 1 < separatorElements.length ? index + 1 : 0)

      separatorElements[nextIndex].focus({ preventScroll: true })
      break
    }
  }
}
