# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A file upload web component with drag-drop support, file previews, validation, and multiple display modes. Published as `@keenmate/web-dropzone` on npm.

**Current Status**: Pre-1.x — actively being aligned with the KM web-component family house style (web-multiselect, web-daterangepicker). Breaking API changes are expected until 1.0.

## Architecture

### Source Files

**src/dropzone.ts**
- Core `WebDropzone` class (non-generic; the `<T>` parameter was removed during the SCSS-removal pass)
- Handles file validation (size, type, count), drag-drop, and file state management
- Multiple display modes: list, detailed, grid, compact
- Uses Floating UI (`@floating-ui/dom`) for compact mode popover positioning
- Helper functions: `formatFileSize`, `getFileTypeCategory`, `getFileIcon`, `isImageFile`, `createImagePreview`

**src/web-component.ts**
- `DropzoneElement` custom element wrapping the core class
- Form-associated (`static formAssociated = true`) via `ElementInternals`
- Shadow DOM encapsulation with style injection
- `ATTRIBUTE_TABLE` drives `observedAttributes`, initial parse, and `attributeChangedCallback`
- Live updates use `dropzone.updateConfig(partial)` returning `true` if applied in-place; only structural changes trigger a full reinit
- Event dispatching (file-added, file-removed, files-rejected, change)

**src/types.ts**
- TypeScript interfaces: `DropzoneConfig`, `FileState`, `ValidationResult`, `RejectedFile`
- Boolean config keys use the `is*` prefix internally (`isMultipleEnabled`, `isFilesInsideEnabled`) — external HTML attributes stay the standard form (`multiple`, `files-inside`)
- Event detail interfaces for all custom events
- `FILE_TYPE_ICONS` constant for file type icons

**src/index.ts**
- Public exports + global API (`window.components['web-dropzone']`)

**src/logger.ts**
- Debug logging utilities (initLogger, fileLogger, uiLogger, interactionLogger)
- Category-based logging with runtime control via the global API

### CSS Structure

**src/css/main.css** - Entry point importing all partials:
- `_variables.css` - CSS custom properties at `:host` level (for theming)
- `_base.css` - FOUC prevention + layout containers
- `_dropzone.css` - Drag-drop zone styling + files-inside mode
- `_file-list.css` - File list container
- `_file-item.css` - Individual file items (list, detailed, grid modes)
- `_progress.css` - Progress bars (for upload tracking)
- `_popover.css` - Compact mode summary + popover
- `_modifiers.css` - State modifiers (disabled, focus, file-status, drag overlay)
- `_rtl.css` - RTL language support

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

1. Add an entry to `ATTRIBUTE_TABLE` in `web-component.ts` (specifies attr name, config key, parser, and default)
2. If the change can be applied in-place, handle it in `WebDropzone.updateConfig`. Otherwise it falls through to a full reinit.
3. No need to touch `observedAttributes` or `attributeChangedCallback` — both are driven by the table.

### Adding New CSS Variables

1. Add CSS custom property in `_variables.css`
2. Use in component CSS without a fallback (the `:host` declaration is the canonical default)

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
make setup        # Install dependencies
make dev          # Start dev server (watches changes)
make build        # Build for production
make package      # Create npm package
make publish-dry  # Dry-run publish
make publish      # Publish to npm
make clean        # Clean all artifacts
make help         # Show all commands

# Using npm directly
npm install       # Install dependencies
npm run dev       # Start dev server
npm run build     # Build for production
```

### Output Files
Build creates `dist/` with:
- `dropzone.js` - ES module format
- `dropzone.umd.js` - UMD format for CDN/legacy
- `style.css` - Compiled styles

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
