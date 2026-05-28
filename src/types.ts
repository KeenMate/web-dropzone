/**
 * Type definitions for the WebDropzone component
 */

import type { Placement } from '@floating-ui/dom';

/**
 * Display mode — single-axis legacy shorthand for the orthogonal
 * `selectorAppearance` × `listAppearance` × `cardSize` axes. Each value
 * expands to a preset combination; explicit orthogonal attributes override
 * what the shorthand sets.
 *
 * - 'list'     → selectorAppearance=card, listAppearance=list,     cardSize=compact
 * - 'detailed' → selectorAppearance=card, listAppearance=detailed, cardSize=compact
 * - 'grid'     → selectorAppearance=card, listAppearance=grid,     cardSize=compact
 * - 'compact'  → selectorAppearance=card, listAppearance=popover,  cardSize=compact
 */
export type DisplayMode = 'list' | 'detailed' | 'grid' | 'compact';

/**
 * Selector appearance — what the user clicks/drops onto.
 * - 'card'    — bordered drop-zone card with icon, prompt, browse button (default)
 * - 'button'  — single accent-styled "Select files" button (no drag-drop)
 * - 'minimal' — compact icon-only button with optional file-count badge
 */
export type SelectorAppearance = 'card' | 'button' | 'minimal';

/**
 * List appearance — how picked files are presented.
 * - 'list'     — simple vertical rows (default)
 * - 'detailed' — vertical rows with icon, name, size, type
 * - 'grid'     — image preview thumbnails in a CSS grid
 * - 'badges'   — inline composite badge pills (matches web-multiselect's badge surface)
 * - 'popover'  — list hidden in a popover anchored to the selector / summary
 * - 'none'     — list not rendered at all (caller handles via the .files getter)
 */
export type ListAppearance = 'list' | 'detailed' | 'grid' | 'badges' | 'popover' | 'none';

/**
 * Card density (only meaningful when selectorAppearance='card').
 * - 'minimal' — single thin horizontal row
 * - 'compact' — moderate padding, default
 * - 'big'     — full vertical stack with large icon, padding, and hints
 */
export type CardSize = 'minimal' | 'compact' | 'big';

/**
 * File upload status
 */
export type FileStatus = 'pending' | 'uploading' | 'complete' | 'error';

/**
 * Value format for form serialization
 */
export type ValueFormat = 'json' | 'csv' | 'array';

/**
 * State of a file in the dropzone
 */
export interface FileState {
    /** Unique identifier for this file */
    id: string;
    /** The native File object */
    file: File;
    /** File name */
    name: string;
    /** File size in bytes */
    size: number;
    /** MIME type */
    type: string;
    /** Current status */
    status: FileStatus;
    /** Upload progress (0-100) */
    progress: number;
    /** Error message if status is 'error' */
    error?: string;
    /** Data URL for image preview (generated on demand) */
    previewUrl?: string;
}

/**
 * Validation result for a file
 */
export interface ValidationResult {
    /** Whether the file passed validation */
    valid: boolean;
    /** Error message if validation failed */
    error?: string;
    /** Error code for programmatic handling */
    code?: 'size' | 'type' | 'count' | 'duplicate' | 'custom';
}

/**
 * Dedupe policy for files added across multiple selections / drops.
 * - 'name'      — reject if filename matches an existing file (default)
 * - 'name-size' — reject if filename AND size both match (safer when two
 *                 distinct files share a name)
 * - 'none'      — never dedupe (native <input type="file"> behavior)
 */
export type DedupeMode = 'name' | 'name-size' | 'none';

/**
 * Rejected file with validation error
 */
export interface RejectedFile {
    /** The rejected file */
    file: File;
    /** Validation result with error details */
    validation: ValidationResult;
}

/**
 * Context provided to renderFileItemCallback
 */
export interface FileItemRenderContext {
    /** Index of the file in the list */
    index: number;
    /** Current display mode */
    displayMode: DisplayMode;
    /** Whether this item is in the compact popover */
    isInPopover: boolean;
}

/**
 * Configuration options for the WebDropzone component
 */
export interface DropzoneConfig {
    // ========================================================================
    // CORE OPTIONS
    // ========================================================================

    /** Allow multiple file selection (HTML attr: `multiple`, default: true) */
    isMultipleEnabled?: boolean;
    /** Accepted file types (MIME types or extensions, e.g., 'image/*,.pdf') */
    accept?: string;
    /** Maximum size per file in bytes. 0 = no cap. */
    maxFileSize?: number;
    /** Minimum size per file in bytes. 0 = no cap. Useful for rejecting empty
     *  uploads / corrupt zero-byte files. */
    minFileSize?: number;
    /** Aggregate size cap across the entire selection in bytes. The running
     *  total is recomputed on each add, so removing files frees room. 0 = no
     *  cap. Mirrors svelte-fluentui's `InputFile.totalMaxSize`. */
    maxTotalSize?: number;
    /** Maximum number of files (when isMultipleEnabled is true). 0 = no cap.
     *  When an incoming batch would exceed this, the first N files that still
     *  fit are accepted and the rest are rejected with `code: 'count'`. */
    maxFileCount?: number;
    /** Minimum number of files required for the surrounding form to be valid.
     *  Does NOT reject files on add — instead, when `files.length < N`, the
     *  custom element calls `ElementInternals.setValidity({ valueMissing })`
     *  so the form's native submit refuses until the user meets the floor.
     *  Mirrors svelte-fluentui's `InputFile.minFiles`. 0 = no minimum. */
    minFileCount?: number;
    /**
     * Visible-row cap. When set and the selection has more files than this,
     * the list renders only the first `maxVisibleFiles` items with a
     * "Show N more" toggle at the end. Default 7. Set to 0 to disable the
     * cap and render every file. Mirrors svelte-fluentui's
     * `InputFile.maxVisible`.
     */
    maxVisibleFiles?: number;
    /**
     * Dedupe policy when adding files to an existing selection.
     * Default: `'name'` — repeated drops / "Add more" picks of the same
     * filename are rejected (with `code: 'duplicate'`). Set to `'none'` to
     * match the native `<input type="file">` behavior of always appending.
     */
    dedupeMode?: DedupeMode;
    /** Whether the dropzone is disabled (HTML attr: `disabled`) */
    isDisabled?: boolean;

    // ========================================================================
    // DISPLAY OPTIONS
    // ========================================================================

    /**
     * Single-axis shorthand. Expands to a preset combination of the orthogonal
     * `selectorAppearance` / `listAppearance` / `cardSize` axes. Explicit
     * orthogonal attributes always win over the shorthand.
     */
    displayMode?: DisplayMode;
    /** Selector appearance — card (drop zone) | button | minimal (icon) */
    selectorAppearance?: SelectorAppearance;
    /** List appearance — list | detailed | grid | badges | popover | none */
    listAppearance?: ListAppearance;
    /** Card density when selectorAppearance='card' — minimal | compact | big */
    cardSize?: CardSize;
    /**
     * Show image thumbnails in the file-list placeholder slot.
     * - `undefined` (default) → "auto": on for `listAppearance='grid'`, off elsewhere
     * - `true`  → always render `<img>` for images, fall back to icon for non-images
     * - `false` → always render the file-type icon, never a thumbnail
     *
     * To hide the placeholder slot entirely (no icon AND no thumbnail), set the
     * relevant CSS variable to 0 — e.g. `web-dropzone { --dz-badge-icon-size: 0; }`.
     */
    isShowThumbnailsEnabled?: boolean;
    /** Show files inside the dropzone area instead of a separate list below (HTML attr: `files-inside`) */
    isFilesInsideEnabled?: boolean;
    /** Icon or emoji for the dropzone prompt */
    icon?: string;
    /** Main text for the dropzone prompt */
    promptText?: string;
    /** Label text for the button selector (selectorAppearance='button') */
    selectFilesText?: string;
    /** Hint text shown below the prompt (e.g., 'PNG, JPG up to 5MB') */
    hintText?: string;
    /** Text shown when dragging over the dropzone */
    dragActiveText?: string;
    /** Message shown when no files are selected (in file list) */
    emptyMessage?: string;

    // ========================================================================
    // COMPACT MODE OPTIONS
    // ========================================================================

    /** Text template for compact summary (use {count} and {size} placeholders) */
    summaryTemplate?: string;
    /** Popover placement relative to summary */
    popoverPlacement?: Placement;

    // ========================================================================
    // DRAG OVERLAY OPTIONS
    // ========================================================================

    /** Element or element ID that triggers a drag overlay (ultra-compact form integration) */
    overlayTarget?: HTMLElement | string | null;
    /** Text shown in the drag overlay */
    overlayText?: string;
    /** Icon for the drag overlay */
    overlayIcon?: string;

    // ========================================================================
    // FORM INTEGRATION
    // ========================================================================

    /** HTML form field name for hidden inputs */
    name?: string;
    /** Format for value serialization */
    valueFormat?: ValueFormat;

    // ========================================================================
    // CALLBACKS
    // ========================================================================

    /** Custom validation callback - return ValidationResult */
    validateCallback?: ((file: File, existingFiles: FileState[]) => ValidationResult) | null;
    /** Callback when files are added */
    addCallback?: ((files: FileState[]) => void) | null;
    /** Callback when a file is removed */
    removeCallback?: ((file: FileState) => void) | null;
    /** Callback when files change (add or remove) */
    changeCallback?: ((files: FileState[]) => void) | null;
    /** Callback when files are rejected due to validation */
    rejectCallback?: ((rejectedFiles: RejectedFile[]) => void) | null;

    // ========================================================================
    // CUSTOM RENDERING
    // ========================================================================

    /** Custom renderer for file item content */
    renderFileItemCallback?: ((file: FileState, context: FileItemRenderContext) => string | HTMLElement) | null;
    /** Custom renderer for dropzone prompt content */
    renderPromptCallback?: (() => string | HTMLElement) | null;
    /** Custom renderer for compact summary content */
    renderSummaryCallback?: ((files: FileState[]) => string | HTMLElement) | null;
    /** Callback to inject custom CSS into Shadow DOM */
    customStylesCallback?: (() => string) | null;

    // ========================================================================
    // OTHER OPTIONS
    // ========================================================================

    /** Container element for popover (for Shadow DOM support) */
    container?: HTMLElement | null;
    /** Host element for appending hidden inputs (for form integration with shadow DOM) */
    hostElement?: HTMLElement;
}

/**
 * Event detail structure for file-added event
 */
export interface FileAddedEventDetail {
    /** The file that was added */
    file: FileState;
    /** All current files */
    files: FileState[];
}

/**
 * Event detail structure for file-removed event
 */
export interface FileRemovedEventDetail {
    /** The file that was removed */
    file: FileState;
    /** All remaining files */
    files: FileState[];
}

/**
 * Event detail structure for files-rejected event
 */
export interface FilesRejectedEventDetail {
    /** Files that were rejected */
    rejectedFiles: RejectedFile[];
}

/**
 * Event detail structure for change event
 */
export interface ChangeEventDetail {
    /** All current files */
    files: FileState[];
}

/**
 * Helper type for all dropzone event details
 */
export type DropzoneEventDetail =
    | FileAddedEventDetail
    | FileRemovedEventDetail
    | FilesRejectedEventDetail
    | ChangeEventDetail;

/**
 * File type categories for icon mapping
 */
export type FileTypeCategory =
    | 'image'
    | 'video'
    | 'audio'
    | 'pdf'
    | 'doc'
    | 'spreadsheet'
    | 'archive'
    | 'code'
    | 'text'
    | 'default';

/**
 * File type icon mapping
 */
export const FILE_TYPE_ICONS: Record<FileTypeCategory, string> = {
    image: '🖼️',
    video: '🎬',
    audio: '🎵',
    pdf: '📄',
    doc: '📝',
    spreadsheet: '📊',
    archive: '📦',
    code: '💻',
    text: '📃',
    default: '📁'
};
