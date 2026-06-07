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

## Full documentation

- [README on GitHub](https://github.com/keenmate/web-dropzone#readme) — attributes, events, methods, styling, examples
- [ARCHITECTURE.md](https://github.com/keenmate/web-dropzone/blob/main/ARCHITECTURE.md) — package topology, store + satellites, multi-selector modes
- [CHANGELOG.md](https://github.com/keenmate/web-dropzone/blob/main/CHANGELOG.md) — release history

## License

MIT © [Keenmate](https://github.com/keenmate)
