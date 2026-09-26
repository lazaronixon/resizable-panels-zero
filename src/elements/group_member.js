const GROUP_TAG = "resizable-group"

// Panels and separators belong to the group they are a direct child of. The
// group may not be upgraded yet — its definition can come later, or the
// markup can be adopted from another document — in which case the member
// waits for the definition and tries again.
export function attachToGroup(member, register) {
  const parent = member.parentElement

  if (parent?.localName !== GROUP_TAG) {
    console.warn(`resizable-panels-zero: <${member.localName}> must be a direct child of <${GROUP_TAG}>.`)
    return
  }

  if (typeof parent.registerPanel === "function") {
    register(parent)
    return
  }

  // A group in a document without a browsing context never upgrades, even
  // once the name is defined, so the check is repeated.
  customElements.whenDefined(GROUP_TAG).then(() => {
    if (member.isConnected && member.parentElement === parent && typeof parent.registerPanel === "function") register(parent)
  })
}

// Size attributes are strings, so "30" is 30% and "200px" is 200 pixels. A
// number assigned to the property is pixels, as it is for the React props, and
// is stored as such.
export function sizeAttributeValue(newValue) {
  if (newValue == null) return null
  return typeof newValue === "number" ? `${newValue}px` : String(newValue)
}

export function setOrRemoveAttribute(element, name, value) {
  if (value == null) {
    element.removeAttribute(name)
  } else {
    element.setAttribute(name, value)
  }
}
