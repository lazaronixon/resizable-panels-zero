// A number is pixels; a string is read by its unit suffix, and a bare string
// such as "30" is a percentage. Attributes are always strings, so `min-size="30"`
// means 30% while `panel.minSize = 30` means 30px — the same rule the React
// library uses for its props.
export function parseSizeAndUnit(size) {
  if (typeof size === "number") return [ size, "px" ]

  const numeric = parseFloat(size)

  if (size.endsWith("%")) return [ numeric, "%" ]
  if (size.endsWith("px")) return [ numeric, "px" ]
  if (size.endsWith("rem")) return [ numeric, "rem" ]
  if (size.endsWith("em")) return [ numeric, "em" ]
  if (size.endsWith("vh")) return [ numeric, "vh" ]
  if (size.endsWith("vw")) return [ numeric, "vw" ]

  return [ numeric, "%" ]
}

export function sizeStyleToPixels({ groupSize, panelElement, styleProp }) {
  const [ size, unit ] = parseSizeAndUnit(styleProp)

  switch (unit) {
    case "%":
      return (size / 100) * groupSize
    case "px":
      return size
    case "rem":
      return size * parseFloat(getComputedStyle(panelElement.ownerDocument.documentElement).fontSize)
    case "em":
      return size * parseFloat(getComputedStyle(panelElement).fontSize)
    case "vh":
      return (size / 100) * window.innerHeight
    case "vw":
      return (size / 100) * window.innerWidth
  }
}

// Turns a size into something `flex-basis` accepts, for the moment before the
// group has measured itself and can hand out real percentages.
export function sizeToCss(size) {
  const [ numeric, unit ] = parseSizeAndUnit(size)
  return `${numeric}${unit}`
}
