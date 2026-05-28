# Web Dropzone Component

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@keenmate/web-dropzone.svg)](https://www.npmjs.com/package/@keenmate/web-dropzone)

A lightweight, accessible file upload web component with drag-drop support, file previews, validation, and multiple display modes.

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
| `overlay-icon` | `string` | `'📎'` | Icon shown in drag overlay |

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
