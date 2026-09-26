import { formatLayoutNumber } from "./layout_numbers"

// Panels with a default size get it; the rest split what is left evenly.
export function calculateDefaultLayout(derivedPanelConstraints) {
  let explicitCount = 0
  let total = 0

  const layout = {}

  for (const current of derivedPanelConstraints) {
    if (current.defaultSize !== undefined) {
      explicitCount++

      const size = formatLayoutNumber(current.defaultSize)
      total += size
      layout[current.panelId] = size
    } else {
      // The key goes in now so the layout keeps panel order; it is filled below.
      layout[current.panelId] = undefined
    }
  }

  const remainingPanelCount = derivedPanelConstraints.length - explicitCount
  if (remainingPanelCount !== 0) {
    const size = formatLayoutNumber((100 - total) / remainingPanelCount)

    for (const current of derivedPanelConstraints) {
      if (current.defaultSize === undefined) layout[current.panelId] = size
    }
  }

  return layout
}

export function validateLayoutKeys(panels, layout) {
  const panelIds = panels.map(panel => panel.id)
  const layoutKeys = Object.keys(layout)

  if (panelIds.length !== layoutKeys.length) return false

  return panelIds.every(panelId => layoutKeys.includes(panelId))
}

// The layout remembered for this exact set of panels wins, so a panel that is
// hidden and shown again brings its neighbours back where they were. Next comes
// the group's default layout — unless the panels it names are not the panels
// that are there — and last the layout the panels' own default sizes describe.
export function getDefaultLayout({ group, panelConstraints }) {
  const panelIdsKey = group.panels.map(({ id }) => id).join(",")
  const defaultLayout = group.mutableState.defaultLayout

  return (
    group.mutableState.layouts[panelIdsKey] ??
    (defaultLayout && validateLayoutKeys(group.panels, defaultLayout)
      ? defaultLayout
      : calculateDefaultLayout(panelConstraints))
  )
}
