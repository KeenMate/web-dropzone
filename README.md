# Web Dropzone Component

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@keenmate/web-dropzone.svg)](https://www.npmjs.com/package/@keenmate/web-dropzone)

A lightweight, accessible file upload web component with drag-drop support, file previews, validation, and multiple display modes.

## What's New in v1.0.0-rc02

- **Theming — `--dz-*` custom properties now cascade into the internal renderers** — In the default (bulk) render mode, `<web-dropzone>` mounts its list/picker/progress as satellite custom elements, each with its own shadow root that re-injects `variables.css`. That stylesheet declared every token in a `:host` block, and a `:host` declaration outranks a value inherited from an outer ancestor — so a `--dz-preview-grid-gap` (or any token) set on `<web-dropzone>` silently never reached the grid inside the satellite. The `:host` block is now split: host-layout properties stay unconditional, but the token defaults move to `:host(:not([managed]))`, and the auto-mounted satellites are tagged `managed` so they inherit straight from the store host. Standalone satellites keep self-theming. Net effect: setting `--dz-*` on `<web-dropzone>` works for grid, badges, and detailed as the docs always implied.
- **Grid — natural (justified) gallery layout** — A new `grid-layout` attribute on `list-appearance="grid"`. `uniform` (default) is the responsive equal-size tile grid; `natural` renders a justified gallery where every row shares one height (`--dz-preview-row-height`) and each tile keeps its own image's aspect ratio, so mixed portrait/landscape photos sit together with nothing cropped or stretched. It switches the container from CSS grid to flex-wrap and derives each tile's width from the image; the companion `--dz-preview-item-object-fit` token lets the uniform layout choose crop (`cover`) vs fit (`contain`).
- **Grid — big status overlay on finished tiles** — The tiny corner check/error glyph is easy to miss on a thumbnail. New `grid-status="overlay"` washes a completed tile with a light veil (`--dz-preview-status-overlay-bg`) and floats a big centred glyph (`--dz-preview-status-overlay-icon-size`) — green check on success, red on error — like a photo-upload confirmation. Only terminal states trigger it; uploading keeps its corner spinner, and the veil is click-through so hover controls still work.
- **Composition — Plyr-style `controls` / `item-controls` allowlists** — Two comma-separated attributes that pick which surfaces and row parts render. `controls` chooses top-level surfaces (picker, list, overall-progress); `item-controls` chooses per-row parts (icon, name, size, type, progress, status, action, remove). Absent means render everything. This replaces a set of narrower single-purpose flags with a composable primitive — count- or state-based progress rules become external recipes over these tokens plus the `change` event, rather than dedicated attributes.
- **Badges & detailed — image thumbnails via `show-thumbnails`** — `show-thumbnails` now works for the badges and detailed list appearances, not just grid: the icon slot shows the real image preview instead of a file-type glyph. The preview URL arrives asynchronously (FileReader → data URL), so the row repaints on a `file-updated` store event once the thumbnail is ready.
- **Internals — vendored logger, no more `loglevel`** — `@keenmate/web-components-core` bumped to `^1.0.0-rc04`, which vendors its logging engine. This drops the transitive `loglevel` dependency and the CJS/ESM interop crash it caused under Node's native ESM loader, which had been breaking the unit-test run.

## What's New in v1.0.0-rc01

First public release candidate. `<web-dropzone>` ships as **two packages** from a workspaces monorepo — `@keenmate/web-dropzone` (the element + four satellite renderers + CSS) and `@keenmate/web-dropzone-core` (the headless store: file pipeline, validation, upload worker pool, events).

- **Built on [`@keenmate/web-components-core`](https://www.npmjs.com/package/@keenmate/web-components-core) (`BlissElement`).** Shared, tested custom-element plumbing — attribute parsing, reactivity, reflection, form association (`el.form`), floating-panel positioning, and categorized logging — so `<web-dropzone>` behaves consistently with `web-multiselect` / `web-daterangepicker`.
- **Display modes + orthogonal appearance axes** — list / detailed / grid (image previews) / compact popover, with independent `selector-appearance` and `list-appearance`, a rolling list, and a full-viewport drag overlay.
- **Upload pipeline** — set `uploadFileCallback` and files run through a concurrency-capped worker pool with progress, pause / resume / cancel / retry, and optimistic or pessimistic progress reporting.
- **Validation** — per-file and aggregate size caps, file-count bounds, type filtering, dedupe modes, and a custom `validateCallback`.
- **Form-associated** — participates in `<form>` (submits real `FormData` file blobs), exposes `el.form` / `event.target.form`, and reflects `min-file-count` into native form validity.
- **Themeable** — `--dz-*` variables, dark mode, `--base-*` Theme Designer integration, RTL, and a `customStylesCallback`.
- **Satellite renderers** — `<web-dropzone-picker>` / `<web-dropzone-list>` / `<web-dropzone-indicator>` / `<web-dropzone-progress>` bind to a store via `for="<id>"` for decoupled layouts.

See [CHANGELOG.md](CHANGELOG.md) for the full list.

## Features

- **Drag & Drop** - Visual feedback on drag over with click-to-browse fallback
- **File Validation** - Max size, allowed types, max file count
- **Multiple Display Modes** - List, detailed, grid (with image previews), and compact
- **Image Previews** - Automatic thumbnail generation for image files
- **RTL Support** - Full right-to-left language support
- **Accessible** - Keyboard navigation and ARIA support
- **Form Integration** - Works with standard HTML forms
- **Modern** - Web Component with Shadow DOM, TypeScript, bundled with Vite
- **Framework Agnostic** - Works with any framework or vanilla JS

## Installation

```bash
npm install @keenmate/web-dropzone
```

## Usage

### Basic Usage

```html
<!-- Simple dropzone -->
<web-dropzone></web-dropzone>

<!-- With options -->
<web-dropzone
  accept="image/*,.pdf"
  multiple
  max-file-size="5242880"
  max-file-count="10"
  display-mode="detailed">
</web-dropzone>
```

### With JavaScript

```typescript
// Import the component (includes styles)
import '@keenmate/web-dropzone';

// Or import styles separately if needed
import '@keenmate/web-dropzone/style.css';

const dropzone = document.querySelector('web-dropzone');

// Listen for events
dropzone.addEventListener('file-added', (e) => {
  console.log('File added:', e.detail.file);
  console.log('All files:', e.detail.files);
});

dropzone.addEventListener('files-rejected', (e) => {
  console.log('Rejected files:', e.detail.files);
  console.log('Errors:', e.detail.errors);
});

dropzone.addEventListener('change', (e) => {
  console.log('Files changed:', e.detail.files);
});

// Get current files
const files = dropzone.files;

// Clear all files
dropzone.clear();
```

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `accept` | `string` | - | Allowed file types (e.g., `image/*,.pdf`) |
| `multiple` | `boolean` | `true` | Allow multiple file selection |
| `max-file-size` | `number` | - | Maximum file size in bytes |
| `max-file-count` | `number` | - | Maximum number of files |
| `display-mode` | `'list' \| 'detailed' \| 'grid' \| 'compact'` | `'list'` | How to display selected files |
| `files-inside` | `boolean` | `false` | Show files inside dropzone area |
| `disabled` | `boolean` | `false` | Disable the dropzone |
| `name` | `string` | - | Form field name for form integration |
| `value-format` | `'json' \| 'csv' \| 'array'` | `'json'` | Format for form value serialization |
| `drop-text` | `string` | `'Drop files here'` | Text shown in drop zone |
| `drop-hint` | `string` | `'or click to browse'` | Hint text below drop text |
| `overlay-target` | `string` | - | Element ID for drag overlay (ultra-compact mode) |
| `overlay-text` | `string` | `'Drop files here'` | Text shown in drag overlay |
| `overlay-icon` | `string` (raw HTML) | Lucide `upload` | Icon shown in drag overlay. Accepts any HTML (SVG / `<img>` / emoji) — see the [XSS notice](#html-injection-xss-notice) |

## Display Modes

### List Mode (Default)

Simple list of file names with remove buttons.

```html
<web-dropzone display-mode="list"></web-dropzone>
```

### Detailed Mode

Shows file icon, name, size, and type for each file.

```html
<web-dropzone display-mode="detailed"></web-dropzone>
```

### Grid Mode

Image preview grid with thumbnails. Perfect for image uploads.

```html
<web-dropzone display-mode="grid" accept="image/*"></web-dropzone>
```

### Compact Mode

Minimal inline display showing file count and total size. Click to open a popover with the full file list.

```html
<web-dropzone display-mode="compact"></web-dropzone>
```

### Ultra-Compact Mode (Drag Overlay)

For minimal form integration, use compact mode with `overlay-target` to enable a drag overlay. When users drag files anywhere over the target element, a full overlay appears for dropping files.

```html
<form id="my-form">
  <input type="text" name="title" placeholder="Title">

  <web-dropzone
    display-mode="compact"
    overlay-target="my-form"
    overlay-text="Drop files here"
    overlay-icon="📎">
  </web-dropzone>

  <button type="submit">Submit</button>
</form>
```

### Files-Inside Mode

Display selected files inside the dropzone area instead of a separate list below:

```html
<web-dropzone files-inside display-mode="list"></web-dropzone>
<web-dropzone files-inside display-mode="grid" accept="image/*"></web-dropzone>
```

## Events

| Event | Detail | Description |
|-------|--------|-------------|
| `file-added` | `{ file, files }` | Fired when a file is added |
| `file-removed` | `{ file, files }` | Fired when a file is removed |
| `files-rejected` | `{ files, errors }` | Fired when files fail validation |
| `change` | `{ files }` | Fired when the file list changes |

### Event Examples

```javascript
const dropzone = document.querySelector('web-dropzone');

// Single file added
dropzone.addEventListener('file-added', (e) => {
  const { file, files } = e.detail;
  console.log(`Added: ${file.name}`);
  console.log(`Total files: ${files.length}`);
});

// Files rejected (validation failed)
dropzone.addEventListener('files-rejected', (e) => {
  const { files, errors } = e.detail;
  files.forEach((file, index) => {
    console.log(`${file.name}: ${errors[index]}`);
  });
});

// Any change to file list
dropzone.addEventListener('change', (e) => {
  const { files } = e.detail;
  updateUI(files);
});
```

## Properties

```typescript
// Get all files
const files: FileState[] = dropzone.files;

// Get/set accept types
dropzone.accept = 'image/*,.pdf';

// Get/set max size
dropzone.maxFileSize = 5242880; // 5MB

// Get/set max files
dropzone.maxFileCount = 10;

// Get/set display mode
dropzone.displayMode = 'grid';

// Check if multiple files allowed
const isMultiple = dropzone.multiple;

// Check if disabled
const isDisabled = dropzone.disabled;
```

## File-type icons

Each file row shows an icon resolved from the file's **category** (`image`, `video`, `audio`, `pdf`, `doc`, `spreadsheet`, `archive`, `code`, `text`, `default`) — Lucide glyphs out of the box. Override them per **extension** or per **category** with the `fileIcons` map, or take full control with the `fileIconCallback`. Both are JS-only properties (no HTML attribute).

```javascript
const dropzone = document.querySelector('web-dropzone');

// Map keyed by EXTENSION (leading dot optional, case-insensitive) or CATEGORY.
// Extension keys win over category keys, which win over the built-in icon.
dropzone.fileIcons = {
  psd: '<svg viewBox="0 0 24 24">…</svg>',   // by extension
  fig: '<img src="/icons/figma.svg" alt="">',
  archive: '📦',                             // override a whole category
};

// Full-control resolver — consulted BEFORE the map. Return HTML to use it,
// or null/undefined to fall through to fileIcons → category → default.
dropzone.fileIconCallback = (file) =>
  file.name.endsWith('.sketch') ? '<svg>…</svg>' : null;
```

**Resolution order** (first hit wins): `fileIconCallback` → `fileIcons[extension]` → `fileIcons[category]` → built-in category icon.

> ⚠️ Icon values are **raw HTML** inserted via `innerHTML` and are **NOT sanitized**. Only pass markup you control — never untrusted / user-supplied strings. See the [HTML injection (XSS) notice](#html-injection-xss-notice).

## HTML injection (XSS) notice

The following properties / callbacks accept **raw HTML** and are intentionally **NOT XSS-safe** — this gives you full control over rendering but means you must sanitize any untrusted data before passing it in:

| Property / callback | Output used in | Risk |
|---------------------|----------------|------|
| `fileIcons` (map values) | File-row icon slot (innerHTML) | HTML injection |
| `fileIconCallback` | File-row icon slot (innerHTML) | HTML injection |
| `icon` attr / property | Drop-zone + minimal prompt (innerHTML) | HTML injection |
| `overlay-icon` attr / property | Drag overlay (innerHTML) | HTML injection |
| `renderFileItemCallback` | File rows (innerHTML) | HTML injection |
| `renderListWrapperCallback` | List wrapper (innerHTML) | HTML injection |
| `renderPromptCallback` | Drop-area prompt (innerHTML) | HTML injection |
| `renderSummaryCallback` | Compact-mode summary (innerHTML) | HTML injection |
| `customStylesCallback` | Injected `<style>` (textContent) | CSS injection |

**If any of these can contain user-generated content, sanitize it first** (e.g. DOMPurify). Built-in defaults and static markup you author are safe; the risk is only in interpolating untrusted strings.

## Methods

| Method | Description |
|--------|-------------|
| `clear()` | Remove all files |
| `addFiles(files: FileList \| File[])` | Add files programmatically |
| `removeFile(id: string)` | Remove a specific file by ID |
| `getFile(id: string)` | Get a file by ID |
| `updateFileProgress(id: string, progress: number)` | Update upload progress (0-100) |
| `setFileStatus(id: string, status, error?)` | Set file status (pending/uploading/complete/error) |

### Upload Progress Tracking

Use `updateFileProgress` and `setFileStatus` to track upload progress:

```javascript
const dropzone = document.querySelector('web-dropzone');

// Simulate upload for each file
dropzone.files.forEach(file => {
  let progress = 0;

  const interval = setInterval(() => {
    progress += 10;
    dropzone.updateFileProgress(file.id, progress);

    if (progress >= 100) {
      clearInterval(interval);
      dropzone.setFileStatus(file.id, 'complete');
    }
  }, 200);
});

// Handle upload error
dropzone.setFileStatus(file.id, 'error', 'Upload failed');
```

## File State

Each file in the `files` array has the following structure:

```typescript
interface FileState {
  id: string;           // Unique identifier
  file: File;           // Original File object
  name: string;         // File name
  size: number;         // File size in bytes
  type: string;         // MIME type
  status: 'pending' | 'uploading' | 'complete' | 'error';
  progress: number;     // Upload progress (0-100)
  error?: string;       // Error message if status is 'error'
  preview?: string;     // Data URL for image preview
}
```

## Form Integration

The component works with standard HTML forms:

```html
<form id="upload-form">
  <web-dropzone name="files" value-format="json"></web-dropzone>
  <button type="submit">Upload</button>
</form>

<script>
  document.getElementById('upload-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    // Get file references as JSON
    const filesJson = formData.get('files');
    console.log('Files:', JSON.parse(filesJson));

    // Or access files directly
    const dropzone = document.querySelector('web-dropzone');
    const files = dropzone.files.map(f => f.file);

    // Upload files
    const uploadData = new FormData();
    files.forEach(file => uploadData.append('files[]', file));
    fetch('/upload', { method: 'POST', body: uploadData });
  });
</script>
```

### Value Formats

- `json` - JSON array of file names (default)
- `csv` - Comma-separated file names
- `array` - Multiple hidden inputs with `name[]`

## Styling

The component uses Shadow DOM with CSS custom properties for theming.

### Sizing

Use `--dz-rem` for global scaling:

```html
<!-- Compact (80%) -->
<web-dropzone style="--dz-rem: 8px;"></web-dropzone>

<!-- Default (100%) -->
<web-dropzone></web-dropzone>

<!-- Large (120%) -->
<web-dropzone style="--dz-rem: 12px;"></web-dropzone>
```

### CSS Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `--dz-accent-color` | `#3b82f6` | Primary accent color |
| `--dz-text-color-1` | `#111827` | Primary text color |
| `--dz-text-color-2` | `#6b7280` | Secondary text color |
| `--dz-border-color` | `#e5e7eb` | Border color |
| `--dz-dropzone-bg` | `#ffffff` | Dropzone background |
| `--dz-dropzone-bg-active` | `#eff6ff` | Background when dragging over |
| `--dz-dropzone-border` | `2px dashed #e5e7eb` | Border style |
| `--dz-dropzone-border-active` | `2px dashed #3b82f6` | Border when dragging over |
| `--dz-dropzone-border-radius` | `0.8rem` | Border radius |
| `--dz-success-color` | `#10b981` | Success state color |
| `--dz-error-color` | `#ef4444` | Error state color |

For the complete list of CSS variables, see [_variables.css](./src/css/_variables.css).

### Theme Designer Integration

The component integrates with KeenMate's theme designer `--base-*` variables:

```css
web-dropzone {
  --dz-accent-color: var(--base-accent-color);
  --dz-text-color-1: var(--base-text-color-1);
  --dz-border-color: var(--base-border-color);
}
```

## RTL Support

Full support for right-to-left languages:

```html
<web-dropzone dir="rtl"></web-dropzone>

<!-- Or inherited from parent -->
<div dir="rtl">
  <web-dropzone></web-dropzone>
</div>
```

## Browser Support

- Chrome/Edge 67+
- Firefox 63+
- Safari 10.1+

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## License

Copyright (c) 2025 Keenmate

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits

Created by [Keenmate](https://github.com/keenmate) as part of the Pure Admin design system.
