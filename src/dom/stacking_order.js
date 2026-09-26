// Forked from stacking-order@2.0.0 (MIT, Rich Harris) by way of
// react-resizable-panels, which fixed two upstream bugs:
// - github.com/Rich-Harris/stacking-order/issues/3
// - github.com/Rich-Harris/stacking-order/issues/6

import { assert } from "../helpers/assert"
import { isShadowRoot } from "../helpers/dom_helper"

const PROPS = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/

// Returns 1 when `a` is painted in front of `b`, and -1 otherwise.
export function compare(a, b) {
  if (a === b) throw new Error("Cannot compare node with itself")

  const ancestors = {
    a: getAncestors(a),
    b: getAncestors(b)
  }

  let commonAncestor

  while (ancestors.a.at(-1) === ancestors.b.at(-1)) {
    commonAncestor = ancestors.a.pop()
    ancestors.b.pop()
  }

  assert(commonAncestor, "Stacking order can only be calculated for elements with a common ancestor")

  const zIndexes = {
    a: getZIndex(findStackingContext(ancestors.a)),
    b: getZIndex(findStackingContext(ancestors.b))
  }

  if (zIndexes.a === zIndexes.b) {
    const children = commonAncestor.childNodes

    const furthestAncestors = {
      a: ancestors.a.at(-1),
      b: ancestors.b.at(-1)
    }

    let index = children.length
    while (index--) {
      const child = children[index]
      if (child === furthestAncestors.a) return 1
      if (child === furthestAncestors.b) return -1
    }
  }

  return Math.sign(zIndexes.a - zIndexes.b)
}

function isFlexItem(node) {
  const display = getComputedStyle(getParent(node) ?? node).display
  return display === "flex" || display === "inline-flex"
}

// https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Positioning/Understanding_z_index/The_stacking_context
function createsStackingContext(node) {
  const style = getComputedStyle(node)

  if (style.position === "fixed") return true
  // The fork's fix for stacking-order#3: a z-index only counts on a flex item
  // or a positioned element, not on every flex item.
  if (style.zIndex !== "auto" && (style.position !== "static" || isFlexItem(node))) return true
  if (+style.opacity < 1) return true
  if ("transform" in style && style.transform !== "none") return true
  if ("webkitTransform" in style && style.webkitTransform !== "none") return true
  if ("mixBlendMode" in style && style.mixBlendMode !== "normal") return true
  if ("filter" in style && style.filter !== "none") return true
  if ("webkitFilter" in style && style.webkitFilter !== "none") return true
  if ("isolation" in style && style.isolation === "isolate") return true
  if (PROPS.test(style.willChange)) return true
  if (style.webkitOverflowScrolling === "touch") return true

  return false
}

function findStackingContext(nodes) {
  let index = nodes.length

  while (index--) {
    const node = nodes[index]
    assert(node, "Missing node")
    if (createsStackingContext(node)) return node
  }

  return null
}

function getZIndex(node) {
  return (node && Number(getComputedStyle(node).zIndex)) || 0
}

// [ node, ... <body>, <html>, document ]
function getAncestors(node) {
  const ancestors = []

  while (node) {
    ancestors.push(node)
    node = getParent(node)
  }

  return ancestors
}

function getParent(node) {
  const { parentNode } = node
  if (isShadowRoot(parentNode)) return parentNode.host
  return parentNode
}
