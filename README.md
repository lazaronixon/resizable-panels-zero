<div align="center">

# resizable-panels-zero

**Resizable panel groups and layouts, in plain HTML.**

Split views, sidebars and IDE-style layouts that resize with a pointer or the
keyboard — no framework, no build step required.

</div>

<br />

A vanilla port of [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)
by Brian Vaughn: same engine, no React. Ships as custom elements and a
CSS-variable theme.

## Why

A resizable split view looks like a weekend's work: two panes, a bar between
them, a `pointermove` handler. Then come minimum sizes, collapsible sidebars,
nested splits you can drag at their crossing, a bar too thin to grab on a
phone, a drag that wanders over an iframe and never ends, keyboard support, and
a layout that should be where you left it after a reload.

`react-resizable-panels` solved all of it, but only for React.
`resizable-panels-zero` is the same layout engine, line for line, behind three
elements you can write straight into HTML.

- **Constraints in any unit** — minimum, maximum, default and collapsed sizes in `%`, `px`, `em`, `rem`, `vh` or `vw`
- **Collapsible panels** — with a configurable threshold, and Enter to toggle from the keyboard
- **Keyboard accessible** — a real `role="separator"` with the WAI-ARIA window-splitter keys and live `aria-valuenow`
- **Nested and crossing groups** — drag a horizontal and a vertical boundary at once where they meet
- **Forgiving hit targets** — thin separators are widened for the pointer, more so for a finger
- **Separators are optional** — the edge between two panels can be dragged on its own
- **Saved layouts** — `autosave` remembers the layout in `localStorage`, or any storage you hand it
- **Zero dependencies** — no framework, no runtime packages

## Add it to a page

Two tags. No build step, no bundler, nothing to install.

```html
<link rel="stylesheet" href="https://esm.sh/resizable-panels-zero/dist/resizable-panels-zero.css">
<script type="module" src="https://esm.sh/resizable-panels-zero"></script>
```

Pin a version for production — `https://esm.sh/resizable-panels-zero@0.0.1` — so
a release can't change under you.

The script defines the elements and injects the rules that make the panels
resize — that part is machinery, and it is never optional. The theme is the
stylesheet: it only decides what the separators look like. Link it, paste it
into a `<style>` tag, or fold it into your own.

The machinery's `<style>` tag goes first in `<head>`, so both the theme and your
own CSS come later in the cascade and win a specificity tie. The handful of
declarations the layout math depends on — no padding or border on a panel, no
growing separators — are `!important`.

## Usage

A group holds panels, with optional separators between them. The group fills
its container, so give the container a size.

```html
<div style="height: 400px">
  <resizable-group>
    <resizable-panel default-size="25" min-size="15"></resizable-panel>
    <resizable-separator></resizable-separator>
    <resizable-panel></resizable-panel>
  </resizable-group>
</div>
```

Panels and separators must be **direct children** of their group. A panel is
the flex item and the scroll container in one, so padding and borders go on the
content inside it.

### Sizes

A size written as an attribute is a string, and a bare number in a string is a
percentage of the group:

| | |
| --- | --- |
| `"30"`, `"30%"` | 30% of the group |
| `"200px"` | 200 pixels |
| `"12rem"`, `"2em"` | relative to the root or the panel's font size |
| `"50vh"`, `"20vw"` | relative to the viewport |

Assigning a number to the property means pixels, as it does for the React
props: `panel.minSize = 200` is the same as `min-size="200px"`.

### Vertical, nested and collapsible

```html
<resizable-group orientation="vertical">
  <resizable-panel>
    <resizable-group>
      <resizable-panel id="sidebar" collapsible collapsed-size="48px" min-size="180px" default-size="240px"></resizable-panel>
      <resizable-separator></resizable-separator>
      <resizable-panel id="editor"></resizable-panel>
    </resizable-group>
  </resizable-panel>
  <resizable-separator></resizable-separator>
  <resizable-panel id="terminal" default-size="30"></resizable-panel>
</resizable-group>
```

A collapsible panel dragged below its minimum snaps shut once it passes the
threshold — halfway between its collapsed and minimum sizes, unless
`collapsed-threshold` says otherwise — and has to be dragged out past the same
distance to open again.

### Reacting to changes

```js
const group = document.querySelector("resizable-group")

group.addEventListener("resizable-group:layout-changed", event => {
  const { layout, isUserInteraction } = event.detail
  console.log(layout) // { sidebar: 20, editor: 80 }
})
```

`layout-change` fires on every pointer move; `layout-changed` fires once the
change is complete — on release for a drag — and is the one to save from.
`isUserInteraction` is true only for pointer and keyboard changes.

### Saving the layout

```html
<resizable-group autosave="editor-layout">
  <resizable-panel id="files"></resizable-panel>
  <resizable-separator></resizable-separator>
  <resizable-panel id="code"></resizable-panel>
</resizable-group>
```

The layout is saved to `localStorage` under the `autosave` name and the panel
ids, and restored on the next load. Give the panels ids of your own when you
save layouts — generated ids depend on the order the page builds itself in.

Any object with `getItem` and `setItem` can stand in for `localStorage` — a
cookie-backed one lets the server render the saved sizes straight away:

```js
group.storage = sessionStorage
```

Add `autosave-user-only` to save only layouts the user made, not ones caused by
the window resizing or a script calling `setLayout()`.

### Driving it from script

```js
const sidebar = document.getElementById("sidebar")

sidebar.collapse()
sidebar.expand()
sidebar.resize("30%")
sidebar.isCollapsed() // false
sidebar.getSize()     // { asPercentage: 30, inPixels: 384 }

group.getLayout()                             // { sidebar: 30, editor: 70 }
group.setLayout({ sidebar: 50, editor: 50 })  // returns the layout it applied
```

### Separator preview mode

With `resize-preview-mode="separator"` the panels stay put while the pointer
moves and only a copy of the separator slides; the layout is applied on release.
It helps when the panels hold something expensive to re-render.

Style the sliding copy with a `<resizable-separator-overlay>` — in the group for
every separator, or inside one separator for that one. It is never shown where
it is written; each preview gets a copy marked
`data-separator-overlay="active"` or `"inactive"`.

```html
<resizable-group resize-preview-mode="separator">
  <resizable-separator-overlay class="my-overlay"></resizable-separator-overlay>
  <resizable-panel></resizable-panel>
  <resizable-separator></resizable-separator>
  <resizable-panel></resizable-panel>
</resizable-group>
```

Without an overlay, the preview is a faded copy of the separator itself.

## Theming

The theme only styles the separators and the previews. Every value is a custom
property; set them anywhere — on `:root`, on a container, or on a single group:

```css
:root {
  --resizable-separator-size: 4px;
  --resizable-separator-color-active: #635bff;
}
```

| Property | Default |
| --- | --- |
| `--resizable-separator-size` | `1px` |
| `--resizable-separator-color` | `#e4e4e7` |
| `--resizable-separator-color-hover` | `#a1a1aa` |
| `--resizable-separator-color-active` | `#18181b` |
| `--resizable-separator-color-disabled` | `#f4f4f5` |
| `--resizable-focus-ring-width` | `2px` |
| `--resizable-focus-ring-color` | `rgb(24 24 27 / 0.75)` |
| `--resizable-overlay-size` | `2px` |
| `--resizable-overlay-color` | `rgb(24 24 27 / 0.35)` |
| `--resizable-overlay-color-active` | `#18181b` |
| `--resizable-transition-duration` | `150ms` |
| `--resizable-transition-easing` | `ease-out` |

The theme ships one set of colours and does not react to `prefers-color-scheme`.
Redefine the properties yourself for a dark palette.

For your own styles, `data-separator` is the attribute to match:
`resizable-separator[data-separator="active"]` while dragged.

## What it handles for you

| | |
| --- | --- |
| A 1px separator is impossible to grab | Every hit region is widened to 10px for a mouse and 20px for a finger, or whatever `resizeTargetMinimumSize` says |
| Nested groups fight over one pointer | Pointer events are handled on the document and matched against every group, so crossing boundaries drag together |
| A drag ends over a cross-origin iframe | The next move with no button down finishes the drag, and pointer capture keeps the rest of the drag coming |
| A menu or modal sits over a separator | Stacking order and `:modal` are checked, so a click on the overlay never starts a drag underneath |
| The cursor flickers while dragging | One adopted stylesheet forces the resize cursor everywhere, and turns it into a one-way arrow at a limit |
| Safari draws the directional cursors badly | Safari gets `col-resize`, `row-resize` and `grab` instead |
| Pixel constraints drift as the window resizes | Constraints are converted to percentages again whenever the group changes size; `group-resize-behavior="preserve-pixel-size"` keeps a panel's pixels |
| A group mounts inside a hidden tab | The layout is deferred until the group has a size, instead of being computed from zeros |
| A hidden panel comes back somewhere else | The layout is remembered per set of panel ids, so a panel that is removed and re-added returns its neighbours to where they were |
| A clicked separator stays focused after a drag | Focus is kept for clicks and released after drags |

## API

### Elements

| | |
| --- | --- |
| `<resizable-group>` | lays out its panels in a row or a column |
| `<resizable-panel>` | one resizable region; must be a direct child of a group |
| `<resizable-separator>` | the draggable, focusable boundary between two panels; optional |
| `<resizable-separator-overlay>` | a template for the drag previews in separator preview mode |

### Group

| Attribute | |
| --- | --- |
| `orientation` | `horizontal` (default) or `vertical` |
| `default-layout` | JSON map of panel id to percentage, used when nothing is saved |
| `autosave` | save and restore the layout under this name |
| `autosave-user-only` | only save layouts caused by pointer or keyboard input |
| `disabled` | no resizing at all |
| `disable-cursor` | leave the cursor alone |
| `resize-preview-mode` | `panel` (default) resizes live; `separator` slides a preview and resizes on release |
| `nonce` | applied to the injected `<style>` tag, for CSP `style-src` |

| Property | |
| --- | --- |
| `orientation`, `defaultLayout`, `autosave`, `disabled`, `disableCursor`, `resizePreviewMode` | mirror the attributes |
| `storage` | where `autosave` reads and writes; default `localStorage` |
| `resizeTargetMinimumSize` | `{ coarse, fine }` in pixels; default `{ coarse: 20, fine: 10 }` |

| Method | |
| --- | --- |
| `getLayout()` | the current layout, panel id to percentage |
| `setLayout(layout)` | validates and applies a layout, and returns what was applied |

| Event | |
| --- | --- |
| `resizable-group:layout-change` | `detail: { layout }` — bubbles, on every change, including each pointer move |
| `resizable-group:layout-changed` | `detail: { layout, isUserInteraction }` — bubbles, once a change is complete |

### Panel

| Attribute | |
| --- | --- |
| `id` | keys the panel in the layout; generated when missing |
| `default-size` | initial size; the rest share what is left |
| `min-size` | default `0%` |
| `max-size` | default `100%` |
| `collapsible` | the panel may collapse below its minimum |
| `collapsed-size` | default `0%` |
| `collapsed-threshold` | how far past the minimum it must go to collapse, and past the collapsed size to expand |
| `group-resize-behavior` | `preserve-relative-size` (default) or `preserve-pixel-size` when the group resizes |
| `disabled` | the panel cannot be resized, directly or indirectly |

| Property | |
| --- | --- |
| `defaultSize`, `minSize`, `maxSize`, `collapsedSize`, `collapsedThreshold` | mirror the attributes; a number means pixels |
| `collapsible`, `disabled`, `groupResizeBehavior` | mirror the attributes |

| Method | |
| --- | --- |
| `collapse()` | collapse to `collapsed-size`, if collapsible |
| `expand()` | restore the size it had before collapsing |
| `resize(size)` | any size the attributes accept |
| `getSize()` | `{ asPercentage, inPixels }` |
| `isCollapsed()` | whether it is collapsed |

| Event | |
| --- | --- |
| `resizable-panel:resize` | `detail: { size, prevSize }` — bubbles, whenever the panel's size changes |

### Separator

| Attribute | |
| --- | --- |
| `disabled` | cannot be dragged; its panels may still move when others do |
| `disable-double-click` | double-clicking does not reset the neighbouring panel to its `default-size` |

| Key | |
| --- | --- |
| `ArrowLeft` / `ArrowRight`, `ArrowUp` / `ArrowDown` | move by 5% along the group's axis |
| `Home` / `End` | shrink or grow the panel before the separator as far as it goes |
| `Enter` | collapse the panel before the separator, or restore it |
| `F6` / `Shift+F6` | move focus to the next or previous separator in the group |

### State attributes

Written by the script, never by you.

On a group: `data-group`. On a panel: `data-panel`, `data-disabled`. On a
separator: `data-separator` (`inactive`, `hover`, `active`, `focus`,
`disabled`), `role`, `tabindex`, `aria-orientation`, `aria-controls`,
`aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-disabled`. On a drag
preview: `data-resize-preview`, and `data-separator-overlay` on its content.

## Development

```bash
npm install
npm run build            # dist/ — esm, minified, gzip and brotli, plus the CSS
npm run lint             # eslint, JS and CSS
npm test                 # vitest, jsdom
npm run test:browser     # playwright, chromium + firefox + webkit + chromium-popup
npm run playground       # the fixture pages, as a live playground
```

Tests come in two layers. **Vitest** (`test/unit/`) covers the layout engine and
the elements' contract in jsdom, with element geometry mocked; a stray
`console.warn` or `console.error` fails the test. **Playwright**
(`test/browser/`) drives real browsers for everything that only a browser can
tell you: dragging, keyboard, cursors, stacking order and real layout. The
`chromium-popup` project runs every spec again with the groups in a popup window
while the library runs in the page that opened it, which catches code that
reaches for the global `document` or `window` instead of the element's own.

## Credits

A port of [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)
by Brian Vaughn — every edge case here was found and solved there first. The
stacking-order check is forked from
[stacking-order](https://github.com/Rich-Harris/stacking-order) by Rich Harris.

## License

MIT
