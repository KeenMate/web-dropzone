# @keenmate/web-dropzone

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/keenmate/web-dropzone/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@keenmate/web-dropzone.svg)](https://www.npmjs.com/package/@keenmate/web-dropzone)

A lightweight, accessible file-upload web component with drag-drop support, file previews, validation, upload-progress tracking, and multiple display modes. Form-associated. Theming via CSS custom properties.

```bash
npm install @keenmate/web-dropzone
```

```html
<web-dropzone
  accept="image/*,.pdf"
  multiple
  max-file-size="5242880"
  max-file-count="10"
  display-mode="detailed"
  name="files">
</web-dropzone>
```

```js
import '@keenmate/web-dropzone';
// or, if importing styles separately:
import '@keenmate/web-dropzone/style.css';
```

## What's in the box

- **`<web-dropzone>`** — the store + convenience-form picker + list.
- **`<web-dropzone-picker>`** — standalone picker satellite (card / button / minimal / native appearances).
- **`<web-dropzone-list>`** — standalone list satellite (list / detailed / grid / badges appearances).
- **`<web-dropzone-indicator>`** — floating status chip + slide-out drawer.
- **`<web-dropzone-progress>`** — standalone overall-progress strip.

All satellites bind to a store via `for="<store-id>"`. See [`ARCHITECTURE.md`](https://github.com/keenmate/web-dropzone/blob/main/ARCHITECTURE.md) for the topology.

## Headless / framework-only

Building a custom React / Vue / Lit / Svelte renderer? Install [`@keenmate/web-dropzone-core`](https://www.npmjs.com/package/@keenmate/web-dropzone-core) directly — no DOM, no CSS, no satellite elements.

## Theming

CSS lives entirely in the renderer. Override at either layer:

```css
/* Cross-component (shared with web-grid, web-multiselect, web-player, …) */
:root {
  --base-accent-color: #14b8a6;
  --base-main-bg: #ffffff;
}

/* Component-local */
web-dropzone {
  --dz-dropzone-border-radius: 1.2rem;
  --dz-dropzone-padding: 4rem;
}
```

The component reads the canonical `--base-*` taxonomy (`--base-main-bg`,
`--base-elevated-bg`, `--base-hover-bg`, `--base-accent-color`,
`--base-text-color-1/2/3`, `--base-text-color-on-accent`,
`--base-border-color`, `--base-danger-color`, plus the `--base-success-color`
and `--base-warning-color` local extensions). See
[`component-variables.manifest.json`](https://github.com/keenmate/web-dropzone/blob/main/packages/web-dropzone/component-variables.manifest.json)
for the full list of consumed and exposed variables.

### Dark mode

Four signals are recognized — declare *any* of them and the component flips:

```html
<!-- OS / page preference (declare color-scheme once, anywhere): -->
<html style="color-scheme: light dark">

<!-- Bootstrap 5.3+ -->
<body data-bs-theme="dark">

<!-- Tailwind / generic -->
<body class="dark">
<body data-theme="dark">

<!-- Per-instance override (highest precedence): -->
<web-dropzone data-theme="dark">
<web-dropzone data-theme="light">  <!-- forces light on a dark page -->
```

Per [color-scheme.md](https://github.com/keenmate/BlissFramework/blob/main/guidelines/web-components/color-scheme.md),
the component does **not** declare `color-scheme` on `:host` — that would
block the page's `color-scheme` from inheriting into the shadow root.

### Cascade layers

`main.css` declares `@layer variables, component, overrides;`. The override
contract is:

- Any **unlayered** consumer rule beats every rule in `@layer component`.
  No `!important` needed.
- A `:root { --base-X }` declaration trivially beats the `variables` layer.

**Footgun:** a global, unlayered universal reset (Bootstrap reboot, Tailwind
preflight, hand-rolled `* { margin: 0; padding: 0; box-sizing: border-box }`)
beats *every* rule in the component's `@layer component` per the cascade
spec. The component renders with broken spacing even though variables
resolved fine. Wrap the reset in a layer so the library's layered defaults
can win:

```css
@layer reset, page;
@layer reset {
  * { margin: 0; padding: 0; box-sizing: border-box; }
}
/* The rest of the consumer's overrides stay unlayered — they still win. */
```

### Known exception — transparent host surface

The host element is intentionally transparent (no `:host { background }`).
The visible surface (`.dz__dropzone--card`, `.dz__file-item`,
`.dz__indicator__chip`) paints itself. In `mode="headless"` and on the four
satellites the host is meant to sit inline in the consumer layout without
adding a background rectangle. Documented exception to the
[theme-container.md](https://github.com/keenmate/BlissFramework/blob/main/guidelines/web-components/theme-container.md)
"Default background" rule.

## Full documentation

- [README on GitHub](https://github.com/keenmate/web-dropzone#readme) — attributes, events, methods, styling, examples
- [ARCHITECTURE.md](https://github.com/keenmate/web-dropzone/blob/main/ARCHITECTURE.md) — package topology, store + satellites, multi-selector modes
- [CHANGELOG.md](https://github.com/keenmate/web-dropzone/blob/main/CHANGELOG.md) — release history

## License

MIT © [Keenmate](https://github.com/keenmate)
