# @keenmate/web-dropzone-core

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/keenmate/web-dropzone/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@keenmate/web-dropzone-core.svg)](https://www.npmjs.com/package/@keenmate/web-dropzone-core)

Headless store for the [`@keenmate/web-dropzone`](https://www.npmjs.com/package/@keenmate/web-dropzone) family — file state, validation, the upload pipeline, and the event substrate. **No DOM rendering. No CSS. No custom elements.**

This package is what you install when you want to build your own React / Vue / Lit / Svelte renderer on top of the same battle-tested file-handling primitives that back the official web components, without paying the cost of the renderer or Floating UI.

```bash
npm install @keenmate/web-dropzone-core
```

## When to use this package

| You want to… | Install |
|---|---|
| Drop `<web-dropzone>` (or its satellites) into a page | `@keenmate/web-dropzone` |
| Build a custom renderer in your framework of choice | `@keenmate/web-dropzone-core` |

The renderer package already depends on this one — installing both is unnecessary unless you're explicitly composing your own renderer.

## What's exported

- **`DropzoneCore`** — the store class. Holds `FileState[]`, runs validation, drives the upload worker pool, fires events.
- **`DropzoneStoreAPI`** — TypeScript interface describing the store's public read/mutate surface. Satellites and BYO renderers should depend on this, not the concrete class.
- **Domain types** — `DropzoneConfig`, `FileState`, `FileStatus`, `FileUploadHandler`, `FileUploadContext`, `FileUploadResult`, `OverallProgress`, `ValidationResult`, `RejectedFile`, plus event detail types (`FileAddedEventDetail`, `FileProgressEventDetail`, `FileUpdatedEventDetail`, …).
- **Pure helpers** — `formatFileSize`, `getFileTypeCategory`, `getFileIcon`, `isImageFile`, `createImagePreview`, `validateFile`, `dedupeKeyFor`, `createFileState`.
- **Status-surface contract** — `StatusSurfaceArgs`, `StatusSurfaceCallback`, `StatusAggregate` for indicator-style UIs.
- **Icons** — `STATUS_ICONS`, `ACTION_ICONS`, `createDropzoneSpinner()`, `actionForStatus()`.

## Event contract

`DropzoneCore` dispatches `CustomEvent`s with `bubbles: true, composed: true` so they cross shadow boundaries. The events form the substrate that the renderer package (and any BYO renderer) hooks into:

- `file-added` `{ file }`
- `file-removed` `{ file }`
- `files-rejected` `{ rejectedFiles }`
- `file-progress` `{ id, progress, status, file }`
- `file-status-changed` `{ id, prevStatus, nextStatus, file }`
- `file-updated` `{ id, file, patch }` — fires when an upload handler returns `{ previewUrl, metadata, downloadUrl, name }` (or `setMetadata()` is called)
- `file-retry`, `file-uploaded`, `file-deleted`, `change`, `files-changed`, `overlay-enter`, `overlay-leave`

See [`ARCHITECTURE.md`](https://github.com/keenmate/web-dropzone/blob/main/ARCHITECTURE.md) for the full event contract and the topology this package fits into.

## Versioning

Pre-1.x in spirit — the package is published at `1.0.0` to mark the core/renderer split as a milestone, but breaking changes are still expected until the wider API stabilises. Pin to a major.

## License

MIT © [Keenmate](https://github.com/keenmate)
