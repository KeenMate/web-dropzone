# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A file upload web component with drag-drop support, file previews, validation, and multiple display modes. Published as **two** npm packages from a workspaces monorepo:

- `@keenmate/web-dropzone-core` — headless store, file pipeline, upload loop, events. No DOM rendering, no CSS. ~53KB minified / ~16KB gzipped. One runtime dep: `@keenmate/web-components-core` (for the shared categorized `/logging` — see `logger.ts`).
- `@keenmate/web-dropzone` — the `<web-dropzone>` custom element + four satellites + CSS. Bundles core for self-contained installs; declares `@keenmate/web-dropzone-core: ^1.0.0` as a hard dep for type re-exports.

**Current Status**: At 1.0.0 (the core/renderer split was the marker). Still pre-stable in spirit — breaking API changes remain possible. The component family follows the KM house style (web-multiselect, web-daterangepicker).

> **Where we're heading**: see [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the store + satellite-renderers topology, the package boundary, multi-selector modes (A vs B), and the staged implementation plan.

## Repository layout

```
/
├── packages/
│   ├── web-dropzone-core/     → @keenmate/web-dropzone-core
│   │   └── src/               (core sources — see below)
│   └── web-dropzone/          → @keenmate/web-dropzone
│       └── src/               (renderer sources + css/ — see below)
├── examples-*.html            (single-file demos, run via the root Vite dev server)
├── package.json               (workspaces root; scripts fan out via `-ws`)
├── tsconfig.json / tsconfig.base.json
├── vite.config.ts             (dev server only — each package has its own build vite.config.ts)
├── ARCHITECTURE.md  CHANGELOG.md  README.md  CLAUDE.md  Makefile
```

## Architecture

### Core package — `packages/web-dropzone-core/src/`

**dropzone-core.ts**
- `DropzoneCore` class — the headless store. Owns `FileState[]`, validation, upload worker pool, events.
- Implements `DropzoneStoreAPI` (the public contract surface).
- No DOM rendering — emits CustomEvents on the host element and lets renderers react.

**store-api.ts**
- `DropzoneStoreAPI` — TypeScript interface every renderer (built-in or BYO) depends on instead of the concrete class.
- `StatusSurfaceCallback` + `StatusSurfaceArgs` — universal three-callback contract shared by `<web-dropzone-indicator>` and the rolling-list appearance.

**types.ts**
- All domain types: `DropzoneConfig`, `FileState`, `ValidationResult`, `RejectedFile`, `FileUploadHandler`, `FileUploadContext`, `FileUploadResult`, `OverallProgress`, `AddFilesOptions`, plus the event-detail types (`FileAddedEventDetail`, `FileProgressEventDetail`, `FileUpdatedEventDetail`, `FilesChangedEventDetail`, …).
- Boolean config keys use the `is*` prefix internally (`isMultipleEnabled`, `isFilesInsideEnabled`) — external HTML attributes stay bare (`multiple`, `files-inside`).
- `FILE_TYPE_ICONS` constant for file-type icons.

**file-pipeline.ts**
- Stateless validation helpers: `validateFile`, `isFileTypeAccepted`, `dedupeKeyFor`, `createFileState`.

**dropzone-shared.ts**
- `DEFAULT_CONFIG` + pure helpers: `formatFileSize`, `getFileTypeCategory`, `getFileIcon`, `isImageFile`, `createImagePreview`, `generateFileId`, `FILE_ICONS`.

**icons.ts**
- Shared Lucide SVG family: `STATUS_ICONS`, `STATUS_LABELS`, `ACTION_ICONS`, `ACTION_LABELS`, `actionForStatus()`, `createDropzoneSpinner()`.

**dom-utils.ts**
- Two tiny zero-dep DOM primitives: `dispatchComposedEvent`, `escapeHtml`. The only DOM-touching code in the core package — kept here so renderers can rely on them without a renderer → core cycle.

**logger.ts**
- Debug logging utilities (`initLogger`, `fileLogger`, `uiLogger`, `interactionLogger`).
- Runtime-controllable via the global API on the renderer side.

**index.ts**
- Barrel export — the public surface of `@keenmate/web-dropzone-core`.

### Renderer package — `packages/web-dropzone/src/`

**dropzone.ts**
- `WebDropzone extends DropzoneCore` — adds the convenience-form rendering (drag-drop zone, inline file list, popover). Inheritance is convenience, not architectural; the back-compat `<web-dropzone>` form is the sole reason for it.
- Uses Floating UI (`@floating-ui/dom`) for compact-mode popover positioning.

**web-component.ts**
- `DropzoneElement` custom element wrapping `WebDropzone`.
- Form-associated (`static formAssociated = true`) via `ElementInternals`.
- Shadow DOM with style injection.
- `ATTRIBUTE_TABLE` drives `observedAttributes`, initial parse, and `attributeChangedCallback`.
- Live updates call `dropzone.updateConfig(partial)`; returns `true` if applied in-place, `false` triggers a full reinit.

**web-component-picker.ts** — `<web-dropzone-picker for="…">` satellite. Card / button / minimal / native selector appearances.
**web-component-list.ts** — `<web-dropzone-list for="…">` satellite. list / detailed / grid / badges appearances.
**web-component-indicator.ts** — `<web-dropzone-indicator for="…">` floating chip + slide-out drawer.
**web-component-progress.ts** — `<web-dropzone-progress for="…">` standalone overall-progress strip.

**satellite-base.ts**
- Shared satellite plumbing: `resolveStoreElement(forId)`, `whenStoreReady(el)`, `subscribeStoreEvents(...)`. Centralises the `store-ready` race handling so every satellite uses one resolution path.

**status-surface.ts**
- Renderer-side implementation of the `StatusSurfaceCallback` contract from core (`buildStatusSurfaceArgs`, `applyStatusSurfaceResult`, `computeStatusAggregate`, `pickCurrentFile`). Indicator + rolling-list both go through this.

**row-templates.ts / row-patching.ts**
- Per-row template strings and in-place patchers for list / detailed / grid / badges / popover modes. The hot path under upload progress ticks.

**index.ts**
- Public exports — re-exports core types/helpers so consumers can `import { DropzoneStoreAPI, FileState, createDropzoneSpinner } from '@keenmate/web-dropzone'` without depending on `-core` directly.
- Wires the `window.components['web-dropzone']` global API.

### CSS — `packages/web-dropzone/src/css/`

Lives only in the renderer package. The core has no CSS.

**main.css** — entry point importing all partials.
- `_variables.css` — CSS custom properties at `:host` level (for theming).
- `_base.css` — FOUC prevention + layout containers.
- `_dropzone.css` — Drag-drop zone styling + files-inside mode.
- `_file-list.css` — File list container.
- `_file-item.css` — Individual file items (list, detailed, grid modes).
- `_progress.css` — Progress bars (for upload tracking).
- `_popover.css` — Compact mode summary + popover.
- `_indicator.css` — `<web-dropzone-indicator>` chip + drawer.
- `_modifiers.css` — State modifiers (disabled, focus, file-status, drag overlay).
- `_input-dropdown.css` — Selector / dropdown shared styles.
- `_debug.css` — Debug overlays (off by default).
- `_rtl.css` — RTL language support.

### Naming Conventions

- **CSS Classes**: `.dz__*` prefix (BEM-like with `__` for elements, `--` for modifiers — e.g., `.dz__dropzone`, `.dz__file-item--detailed`)
- **CSS Variables**: `--dz-*` prefix (e.g., `--dz-accent-color`, `--dz-dropzone-border-radius`)
- **Internal config keys**: Boolean options use `is*` / `should*` prefix (`isMultipleEnabled`, `isFilesInsideEnabled`). HTML attributes stay bare (`multiple`, `files-inside`).

## Key Features

### File Handling
- Drag and drop with visual feedback
- Click to browse fallback
- Multi-file support (`multiple` attribute)
- File type filtering (`accept` attribute)

### Validation
- Max file size (`max-file-size` attribute, in bytes)
- Allowed types (`accept` attribute, MIME types/extensions)
- Max file count (`max-file-count` attribute)
- Custom validation callback

### Display Modes (`display-mode` attribute)
- `list` - Simple file list with remove buttons
- `detailed` - File list with icon, name, size, type
- `grid` - Image preview grid with thumbnails
- `compact` - Minimal inline display with popover modal

### Image Previews
- Automatic thumbnail generation via FileReader → data URL (stored on `FileState.previewUrl`)
- Aspect-ratio preserved display
- Hover overlay with filename

### Events
```typescript
'file-added'      // detail: { file, files }
'file-removed'    // detail: { file, files }
'files-rejected'  // detail: { rejectedFiles }
'change'          // detail: { files }
```

### Attributes
```html
<web-dropzone
  accept="image/*,.pdf"
  multiple
  max-file-size="5242880"
  max-file-count="10"
  display-mode="detailed"
  name="files"
></web-dropzone>
```

## Development Guidelines

### Adding New Attributes

1. Add an entry to `ATTRIBUTE_TABLE` in `packages/web-dropzone/src/web-component.ts` (specifies attr name, config key, parser, and default).
2. If the corresponding config key needs to flow into `DropzoneConfig` for the core to consume, add it to `packages/web-dropzone-core/src/types.ts`.
3. If the change can be applied in-place, handle it in `WebDropzone.updateConfig` (or `DropzoneCore.updateConfig` if it's a core-level concern). Otherwise it falls through to a full reinit.
4. No need to touch `observedAttributes` or `attributeChangedCallback` — both are driven by the table.

### Adding New CSS Variables

1. Add CSS custom property in `packages/web-dropzone/src/css/_variables.css`.
2. Use in component CSS without a fallback (the `:host` declaration is the canonical default).
3. Core has no CSS — all theming lives in the renderer package.

### Sizing System

The component uses `--dz-rem` for global scaling. Default is `10px` (so `1.4 * --dz-rem = 14px`).

**Global Scaling:**
```html
<!-- Compact (80%) -->
<web-dropzone style="--dz-rem: 8px;"></web-dropzone>

<!-- Default (100%) -->
<web-dropzone></web-dropzone>

<!-- Large (120%) -->
<web-dropzone style="--dz-rem: 12px;"></web-dropzone>
```

### Typography Integration

Font sizes use unitless multipliers that get multiplied by `--dz-rem`:
```css
--dz-font-size-sm: calc(var(--base-font-size-sm, 1.4) * var(--dz-rem));
```

This enables integration with theme-designer's `--base-*` variables:
- `--base-font-family` - Font family
- `--base-font-size-xs`, `--base-font-size-sm`, etc. - Unitless multipliers
- `--base-accent-color`, `--base-border-color`, etc. - Color variables

### Consistency with web-multiselect / web-daterangepicker

These components share patterns:
- `--*-rem` scaling unit (`--dz-rem`, `--ms-rem`, `--dp-rem`)
- `--base-*` variable integration for theme-designer
- BEM-like class naming (`.dz__*`, `.ms__*`)
- `ATTRIBUTE_TABLE` single-source-of-truth for HTML attribute → config option mapping
- `is*` / `should*` prefix on internal boolean config keys
- Form-association via `ElementInternals` (`static formAssociated = true`)

## Build System

### Build Tools
- **Vite** - Fast build tool and dev server with HMR
- **TypeScript** - Type-safe development
- **Makefile** / **make.bat** - Build automation

### Available Commands

```bash
# Using Makefile (Unix/Mac/WSL/Git Bash)
make setup            # Install dependencies (root + workspaces)
make dev              # Start dev server (root Vite, serves examples-*.html)
make build            # Build both packages (workspaces -ws)
make build-core       # Build only @keenmate/web-dropzone-core
make build-renderer   # Build only @keenmate/web-dropzone
make package          # Pack both packages — outputs two .tgz files
make publish-dry      # Dry-run publish for both packages
make publish          # Publish both packages to npm (prompts for confirmation)
make clean            # Clean all artifacts
make help             # Show all commands

# Using npm directly
npm install                                       # Install dependencies (workspaces aware)
npm run dev                                       # Start dev server (root vite)
npm run build                                     # Build both packages via `npm run build -ws`
npm run build:core                                # Build only the core package
npm run build:renderer                            # Build only the renderer package
npm pack -w @keenmate/web-dropzone-core           # Pack core
npm pack -w @keenmate/web-dropzone                # Pack renderer
npm publish -w @keenmate/web-dropzone-core        # Publish core (in dep order — core first)
npm publish -w @keenmate/web-dropzone             # Publish renderer
```

### Output Files

Each package builds into its own `dist/`:

**`packages/web-dropzone-core/dist/`**
- `core.js` — ES module
- `core.umd.js` — UMD for CDN / legacy
- `*.d.ts` — type declarations (per-source-file plus the `index.d.ts` barrel)

**`packages/web-dropzone/dist/`**
- `dropzone.js` — ES module (bundles core in)
- `dropzone.umd.js` — UMD (bundles core + Floating UI in)
- `style.css` — compiled styles
- `*.d.ts` — type declarations (re-exports core types via `from '@keenmate/web-dropzone-core'`)

## State Management

Key state in `WebDropzone`:
- `files: FileState[]` - All added files with status
- `dragActive: boolean` - Whether drag is over dropzone
- `isPopoverOpen: boolean` - Compact mode popover visibility

(Image preview data URLs are stored inline on each `FileState.previewUrl` — there is no separate cache map.)

File state structure:
```typescript
interface FileState {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  progress: number;
  error?: string;
  previewUrl?: string;
}
```

## Known Dependencies

- `@floating-ui/dom` - Required for compact mode popover positioning (bundled)
- No external CSS frameworks required

## Event System

Custom events dispatched on the web component:
- `file-added` - File added (detail: `{ file, files }`)
- `file-removed` - File removed (detail: `{ file, files }`)
- `files-rejected` - Validation failures (detail: `{ rejectedFiles }`)
- `change` - Files changed (detail: `{ files }`)

## Form Integration

- `name` attribute for form field name
- `value-format` attribute: `'json' | 'csv' | 'array'` (controls fallback hidden-input serialization)
- Form-associated via `ElementInternals.setFormValue()` — the element submits a real `FormData` containing each `File` blob under the configured `name`, so server-side it behaves like a standard `<input type="file">`
- `formResetCallback()` clears the selection when the surrounding form resets
