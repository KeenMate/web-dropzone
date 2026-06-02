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
 * Operating mode — the top-level switch that decides who renders the file
 * list and how customization is applied. Hard switch: setting `mode`
 * authoritatively gates which other config keys apply. See
 * ARCHITECTURE.md and the "three modes" project memory.
 *
 * - 'bulk'       — framework owns everything. Render callbacks
 *                  (`renderFileItemCallback`, `renderPromptCallback`,
 *                  `renderSummaryCallback`, `renderRolling*Callback`) are
 *                  IGNORED even if set. Consumers style via CSS variables.
 * - 'structural' — framework decides when/what to render; consumer
 *                  provides the HTML structure via render callbacks.
 * - 'headless'   — framework renders nothing; emits events + exposes
 *                  state. Consumer brings their own DOM (typically via
 *                  satellites or a reactive framework).
 *
 * When the attribute is absent, the mode is inferred:
 *   - any of `display-mode` / `selector-appearance` / `list-appearance`
 *     present → 'bulk'
 *   - none present → 'headless' (the satellite-store back-compat shortcut)
 *
 * The inferred mode never resolves to 'structural' — opting in to
 * callbacks always requires explicit `mode="structural"`.
 */
export type DropzoneMode = 'bulk' | 'structural' | 'headless';

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
 * - 'rolling'  — single-row "front file" view + queue button that opens the popover.
 *                The front file rolls out as it finishes and the next one rolls in.
 *                Designed for tight surfaces where the user wants a glance at what's
 *                currently in flight, with a click-through to the full queue.
 * - 'popover'  — list hidden in a popover anchored to the selector / summary
 * - 'none'     — list not rendered at all (caller handles via the .files getter)
 */
export type ListAppearance = 'list' | 'detailed' | 'grid' | 'badges' | 'rolling' | 'popover' | 'none';

/**
 * Rotation style for `listAppearance='rolling'`. Controls how the front
 * file transitions when a new one takes the slot.
 * - 'horizontal' — old slides out left, new slides in from right (conveyor)
 * - 'vertical'   — old slides out top, new slides in from bottom (stack)
 * - 'slide-in'   — old is removed instantly, new slides in from right
 *                  (no overlap; cheapest / default)
 */
export type RollingRotation = 'horizontal' | 'vertical' | 'slide-in';

/**
 * Card density (only meaningful when selectorAppearance='card').
 * - 'minimal' — single thin horizontal row
 * - 'compact' — moderate padding, default
 * - 'big'     — full vertical stack with large icon, padding, and hints
 */
export type CardSize = 'minimal' | 'compact' | 'big';

/**
 * File upload status.
 * - `pending`   — accepted but no upload attempt yet
 * - `uploading` — `uploadFileCallback` is currently running
 * - `complete`  — handler resolved successfully
 * - `error`     — handler rejected (after exhausting retries)
 * - `paused`    — handler aborted, will resume on `resumeFile` / `resumeAll`
 * - `cancelled` — handler aborted; will not auto-resume (manual retry needed)
 */
export type FileStatus = 'pending' | 'uploading' | 'complete' | 'error' | 'paused' | 'cancelled';

/**
 * Contract between the handler and the component about what
 * `onProgress(p)` means, and what the component does with it when the
 * upload attempt rejects. The handler always drives the bar — the mode
 * controls whether the bar can go BACKWARDS on failure.
 *
 * - `optimistic` (default) — the handler is free to call
 *   `onProgress(p)` BEFORE the bytes are confirmed (e.g. as soon as
 *   they're flushed to the socket, or per simulated tick). If the
 *   attempt ultimately rejects, the bar snaps back to the value it had
 *   at the start of the attempt — those unconfirmed bytes never landed
 *   on the server, and the next attempt resumes from the confirmed
 *   offset. Best for most HTTP uploads where progress comes from
 *   `XMLHttpRequest.upload.progress` and "sent" doesn't yet mean
 *   "acknowledged".
 *
 * - `pessimistic` — the handler must only call `onProgress(p)` AFTER a
 *   chunk has been confirmed by the server (or for whole-file uploads,
 *   it just doesn't tick during the attempt and the bar jumps from the
 *   baseline to 100% on resolve). The component won't snap back on
 *   failure — the bar moves forward only, or stops. Best when the
 *   handler can distinguish sent vs. acknowledged, so apparent
 *   progress is always real.
 */
export type ProgressMode = 'optimistic' | 'pessimistic';

/**
 * Per-file upload handler. Called once per file by the component's worker
 * pool when `uploadFileCallback` is set. Returns a Promise that resolves on
 * success or rejects on failure. The component drives `file.progress` and
 * `file.status` from the lifecycle of this Promise — the handler should only
 * report progress via `onProgress(percent)` and respect `signal.aborted`.
 *
 * Mirrors svelte-fluentui's `FileUploadHandler`. The signal fires when the
 * file is paused / cancelled / removed; handlers should bail out via AbortError.
 */
/**
 * Per-call context handed to the upload handler. Carries resume state so the
 * handler can pick up where a previous attempt left off — without it, the
 * handler can't know whether this is a fresh upload, a resume after pause,
 * or a fresh retry.
 *
 * Resume flow:
 * 1. First call — `startBytes=0`, `startPercent=0`, `metadata=undefined`.
 * 2. Handler does its thing (e.g. POST initiates a tus.io session, returns
 *    the Location header). Calls `setMetadata({ uploadUrl })` to stash it
 *    so the next attempt can find it. Calls `onProgress(percent)` as bytes
 *    land.
 * 3. User pauses → AbortSignal fires → handler rejects with AbortError.
 *    Component preserves `file.progress` and `file.metadata`.
 * 4. User resumes → handler is called again. `startBytes` reflects the last
 *    reported progress; `metadata.uploadUrl` is still there. Handler does a
 *    `HEAD uploadUrl` to confirm server-side offset, then resumes from
 *    `startBytes` (HTTP Content-Range / tus.io PATCH / S3 multipart / etc).
 */
export interface FileUploadContext {
    /**
     * Byte offset to resume from. 0 for a fresh upload, > 0 when resuming
     * after a pause. Computed from `file.progress` × `file.size` so the
     * accuracy depends on what the handler reported via `onProgress` before
     * the pause.
     */
    startBytes: number;
    /** Same as startBytes expressed as a 0..100 percent. Convenience for
     *  handlers that work in percent (e.g. progress simulators). */
    startPercent: number;
    /**
     * Current value of `FileState.metadata` — merged from any prior
     * `FileUploadResult.metadata` AND any prior `context.setMetadata` calls.
     * Use this to recover e.g. a tus.io session URL or S3 upload-id stashed
     * during a previous attempt.
     */
    metadata: Readonly<Record<string, unknown>> | undefined;
    /**
     * Stash partial server state mid-stream. The patch is shallow-merged
     * into `FileState.metadata` immediately, so the next runUpload call
     * (after pause / retry) sees it in `context.metadata`. Useful for
     * session URLs (tus.io Location header) or upload-ids (S3 multipart)
     * learned from the first request and reused on resume.
     */
    setMetadata(patch: Record<string, unknown>): void;
    /**
     * Per-file metadata stamped at add-time by the contributing picker
     * (Mode B — see ARCHITECTURE.md). Distinct from `metadata`, which the
     * handler populates on success. Use this to carry bucket names,
     * tenant ids, or any other "where does this file go" hint that the
     * picker decided when the user dropped the file.
     */
    uploadMetadata: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Options accepted by `WebDropzone.addFiles(files, opts)`. Pickers use this
 * to stamp Mode B routing info onto each new FileState — the same handler /
 * metadata then survive through pause / resume / retry. Omitting opts (or
 * passing `{}`) is Mode A: files inherit the store's `uploadFileCallback`.
 */
export interface AddFilesOptions {
    /** Per-file upload handler override. Stamped onto every accepted file
     *  in this batch as `FileState.uploadCallback`. */
    uploadCallback?: FileUploadHandler;
    /** Per-file metadata stamped onto every accepted file in this batch
     *  as `FileState.uploadMetadata`. */
    uploadMetadata?: Record<string, unknown>;
}

export type FileUploadHandler = (
    file: File,
    onProgress: (percent: number) => void,
    signal: AbortSignal,
    context: FileUploadContext
) => Promise<void | FileUploadResult>;

/**
 * Retry policy applied when `uploadFileCallback` rejects. Each retry waits
 * `delayMs * (backoff ** attempt)` before the next attempt — defaults give an
 * exponential 1s / 2s / 4s ramp.
 */
export interface RetryPolicy {
    /** Total attempts including the first try (default: 1 — no retries). */
    attempts?: number;
    /** Base delay in ms (default: 1000). */
    delayMs?: number;
    /** Exponential backoff multiplier (default: 2). */
    backoff?: number;
}

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
    /**
     * Server-provided URL for the uploaded file (download link). Populated
     * from `FileUploadResult.downloadUrl` when the handler returns one.
     */
    downloadUrl?: string;
    /**
     * Arbitrary server-side payload merged from `FileUploadResult.metadata`
     * on successful upload. Survives in the item for the entire lifetime of
     * the selection so apps can fire a DELETE against the server using e.g.
     * `metadata.serverGuid` when the user removes a completed file from the
     * list. Mirrors svelte-fluentui's `InputFileItem.metadata`.
     */
    metadata?: Record<string, unknown>;
    /**
     * Per-file upload handler override (Mode B — see ARCHITECTURE.md).
     * Stamped at add-time by the contributing picker so a shared store can
     * route different files to different endpoints. The upload loop calls
     * `file.uploadCallback ?? store.config.uploadFileCallback`, so Mode A
     * (single shared handler) is unchanged when this is undefined.
     */
    uploadCallback?: FileUploadHandler;
    /**
     * Per-file metadata stamped at add-time (Mode B). Distinct from
     * `metadata`, which the upload handler populates after upload — this
     * field carries inputs handed to the handler (e.g. bucket name,
     * tenant id) and is exposed via `FileUploadContext.uploadMetadata`.
     */
    uploadMetadata?: Record<string, unknown>;
}

/**
 * Restricted partial that the upload handler can return on success. The
 * component merges this into the FileState atomically with the
 * `status: 'complete'` flip. Restricted on purpose — handlers can populate
 * server-side identifiers (`metadata`), download links, alternate
 * thumbnails, or a final filename, but cannot overwrite internal lifecycle
 * fields like `id`, `status`, `progress`, `file`, or `error`.
 */
export interface FileUploadResult {
    metadata?: Record<string, unknown>;
    downloadUrl?: string;
    previewUrl?: string;
    name?: string;
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
/**
 * Persisted UI state — everything the user can change via direct
 * interaction that should survive a page reload. Currently only popover
 * dimensions; extensible so new toggles can join without breaking the
 * storage shape (loaders should treat unknown keys as default).
 */
export interface DropzoneState {
    /** Width in CSS pixels set by the user's last popover resize. */
    popoverWidth?: number;
    /** Height in CSS pixels set by the user's last popover resize. */
    popoverHeight?: number;
}

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
    /**
     * Operating mode — bulk / structural / headless. Hard switch: gates
     * which other config keys apply. See `DropzoneMode` for semantics.
     * Defaults to 'bulk' when any renderer-trigger attribute is set,
     * 'headless' otherwise. The implicit default never resolves to
     * 'structural' — that requires an explicit `mode="structural"`.
     */
    mode?: DropzoneMode;
    /**
     * Derived from `mode === 'headless'`. Kept as a separate flag because
     * lots of internal code paths short-circuit on it; treat it as
     * read-after-resolve, not as a knob you set directly. Set `mode`
     * instead.
     */
    isHeadless?: boolean;
    /**
     * Per-file throttle window for `updateFileProgress` (milliseconds).
     * Coalesces the `file-progress` event, the `file-row-update` event,
     * and the in-place row patching so a 20-file upload tick at 50ms
     * intervals isn't doing 400 DOM patches/sec.
     *
     * Default 0 (no throttle). Leading edge fires immediately; subsequent
     * progress within the window is held until the trailing edge. The
     * final value (100% / status flip to 'complete') is guaranteed to
     * arrive — held values aren't dropped.
     *
     * Recommended values: 80–200 ms for tables / framework-bound
     * renderers; leave at 0 for the default UI (its in-place patcher is
     * already cheap).
     */
    progressThrottle?: number;

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
    /**
     * Rotation style for `listAppearance='rolling'` (HTML attr: `rolling-rotation`).
     * Default: `'slide-in'`.
     */
    rollingRotation?: RollingRotation;
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
    /** Callback when an upload retry is requested (via the "Retry all" button
     *  in the overall progress strip, or `retryFile(id)` / `retryAll()`). The
     *  app's existing upload logic should re-run for the supplied file — the
     *  component has already reset its status to 'pending' and progress to 0. */
    retryCallback?: ((file: FileState) => void) | null;
    /**
     * Per-file upload handler. When set, the component takes ownership of the
     * upload lifecycle: a worker pool runs queued files at the configured
     * `concurrency`, awaits each handler, drives `file.status` from the Promise
     * outcome, and exposes Pause / Resume / Cancel via the public API.
     *
     * When unset, the component stays in the "app drives uploads" mode —
     * files are merely added and emit `file-added`; the app is expected to
     * call `updateFileProgress` / `setFileStatus` manually.
     */
    uploadFileCallback?: FileUploadHandler | null;
    /** Optional callback fired after a file uploads successfully (mirrors
     *  the `file-uploaded` event). Only relevant when `uploadFileCallback`
     *  is set. */
    uploadedCallback?: ((file: FileState) => void) | null;
    /**
     * Max number of concurrent uploads when the component drives the queue.
     * Default 1 — uploads run sequentially. Has no effect when
     * `uploadFileCallback` is unset.
     */
    concurrency?: number;
    /**
     * When `true` (default), accepted files are immediately queued for upload
     * via the worker pool. When `false`, files stay in `pending` until the app
     * calls `uploadAll()` — useful for "stage everything, submit on form
     * submit" patterns. Only relevant when `uploadFileCallback` is set.
     */
    isAutoUploadEnabled?: boolean;
    /**
     * Controls whether the progress bar reflects the handler's optimistic
     * `onProgress` ticks (bytes sent) or only confirmed server-acknowledged
     * progress. See {@link ProgressMode}. Defaults to `'optimistic'`.
     */
    progressMode?: ProgressMode;
    /**
     * Retry policy applied when `uploadFileCallback` rejects. Defaults to a
     * single attempt (no retries). See {@link RetryPolicy}.
     */
    retryPolicy?: RetryPolicy;
    /**
     * Whether the user can remove files that have already finished uploading
     * (`status === 'complete'`). When `false`, the remove button is hidden
     * on completed rows but its layout space is reserved — so adjacent
     * elements don't shift as files transition. Default `true`.
     *
     * Calling `removeFile(id)` programmatically still works regardless of
     * this flag — it only affects the rendered button visibility.
     */
    isUploadedFileDeletable?: boolean;
    /**
     * Re-order the rendered file list so completed (`status === 'complete'`)
     * files slide to the bottom and unresolved files (pending / uploading /
     * paused / error / cancelled) stay at the top. The underlying
     * `this.files` array order is NOT mutated — the visual reordering is
     * pure CSS (`order: 1` on completed rows) for the inline list
     * appearances and a stable sort in the render path for the popover
     * table. So `file-added` / `file-removed` event order and form
     * submission order remain deterministic. Default `false`.
     *
     * Useful when uploads finish out of order and the user needs to see
     * what still needs attention (errors at the top, not buried beneath
     * a long tail of green checkmarks).
     */
    isReorderCompletedEnabled?: boolean;
    /**
     * Delay in milliseconds between a file transitioning to `complete`
     * and its row sliding to the completed bucket (when reorder is on).
     * The row stays in place showing 100% / the success state for this
     * long before moving — gives the user a beat to register WHICH file
     * just finished, so subsequent files sliding up into the vacated
     * slot aren't mistaken for the original one regressing.
     *
     * Per-file timer: each completing file counts down independently;
     * the timer is cancelled if the file un-completes (e.g. retry) or
     * is removed before it fires. Default: 1500ms when reorder is on,
     * effectively 0 when it's off (the attribute has no effect).
     */
    reorderCompletedDelay?: number;
    /**
     * Callback fired when a file that had finished uploading
     * (`status === 'complete'`) is removed from the selection. Mirrors the
     * `file-deleted` event. The app should issue a DELETE against its
     * server using `file.metadata` (or whatever identifier the upload
     * handler stashed there). The plain `file-removed` event also fires.
     */
    deleteCallback?: ((file: FileState) => void) | null;

    // ========================================================================
    // CUSTOM RENDERING
    // ========================================================================

    // ========================================================================
    // PERSISTENCE — user-driven UI state survives page reloads
    // ========================================================================

    /**
     * Opaque identifier used to scope persisted UI state. When set, user
     * actions like resizing the popover are saved (to localStorage by
     * default, or via {@link persistStateCallback} when provided) and
     * restored on next mount. Two dropzones on the same page need
     * distinct keys; the empty string / `undefined` disables persistence
     * entirely.
     */
    storageKey?: string;
    /**
     * Custom persistence sink. Called whenever a piece of state changes
     * (currently: popover dimensions after the user finishes a resize).
     * The full state object is passed every time so the implementation
     * can choose to merge / overwrite as it sees fit. Return a promise
     * if the write is async — failures are swallowed; the component
     * keeps working with in-memory state. Falls back to `localStorage`
     * with key `dz-state:${storageKey}` when not set.
     */
    persistStateCallback?: ((key: string, state: DropzoneState) => void | Promise<void>) | null;
    /**
     * Custom persistence source. Called once when the popover is about
     * to open, to restore the user's last-known dimensions. Return
     * `null` or `undefined` when no state exists for the key. Falls
     * back to `localStorage` lookup at `dz-state:${storageKey}` when
     * not set.
     */
    loadStateCallback?: ((key: string) => DropzoneState | null | Promise<DropzoneState | null>) | null;

    /**
     * Custom renderer for a single file row.
     *
     * Return type drives the framework's update strategy:
     *  - **string** — framework swaps `outerHTML` on every state change.
     *    Simple, but listeners attached via `innerHTML += "<button …>"`
     *    style are lost on every tick.
     *  - **HTMLElement** — framework preserves the element across state
     *    changes and instead dispatches `file-row-update` events on it
     *    (detail: `{ file }`). Listeners attached during the initial
     *    render survive; the consumer mutates the existing DOM inside
     *    the event handler.
     *
     * Only honored when `mode === 'structural'`. See `DropzoneMode`.
     */
    renderFileItemCallback?: ((file: FileState, context: FileItemRenderContext) => string | HTMLElement) | null;
    /**
     * Custom renderer for the list wrapper. Receives the rows as an
     * HTML string and the files array; returns the wrapper HTML/element
     * that will contain them. Useful for table-style layouts:
     *
     *   renderListWrapperCallback = (rowsHtml) => `
     *       <table>
     *         <thead><tr><th>Name</th><th>Size</th></tr></thead>
     *         <tbody>${rowsHtml}</tbody>
     *       </table>`;
     *
     * Only honored when `mode === 'structural'`. Note: combining this
     * with an HTMLElement-returning `renderFileItemCallback` falls back
     * to the string path — element identity is not preserved when the
     * wrapper callback is set.
     */
    renderListWrapperCallback?: ((rowsHtml: string, files: FileState[]) => string | HTMLElement) | null;
    /** Custom renderer for dropzone prompt content */
    renderPromptCallback?: (() => string | HTMLElement) | null;
    /** Custom renderer for compact summary content */
    renderSummaryCallback?: ((files: FileState[]) => string | HTMLElement) | null;
    /**
     * Custom rendering for the rolling list appearance. Three structural
     * callbacks share the same `StatusSurfaceCallback` contract as the
     * `<web-dropzone-indicator>` element — see `./status-surface.ts`.
     * Each part is replaceable piecemeal; `null` returns yield to the
     * library's polished default. `false` from body hides the rolling
     * block (useful while idle). Memoization rules: string equality
     * skips DOM writes, element identity preserves WAAPI animations.
     */
    renderRollingBodyCallback?: import('./status-surface').StatusSurfaceCallback | null;
    /** File-info slot inside the rolling current row — name, icon, status. */
    renderRollingFileInfoCallback?: import('./status-surface').StatusSurfaceCallback | null;
    /** Progress slot inside the rolling current row — bar + percent. */
    renderRollingProgressCallback?: import('./status-surface').StatusSurfaceCallback | null;
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
 * Event detail structure for file-retry event — dispatched when the user
 * triggers a retry (per-file via API, or "Retry all" in the overall progress
 * strip). The component has already reset `file.status` to 'pending' and
 * `file.progress` to 0 before this event fires; the app's existing upload
 * logic should re-run for `file`.
 */
export interface FileRetryEventDetail {
    /** The file being retried */
    file: FileState;
    /** All current files */
    files: FileState[];
}

/**
 * Event detail for file-uploaded — fires when the component-driven worker
 * pool completes a file successfully. Only dispatched when
 * `uploadFileCallback` is set.
 */
export interface FileUploadedEventDetail {
    /** The file that finished uploading */
    file: FileState;
    /** All current files */
    files: FileState[];
}

/**
 * Event detail for file-deleted — dispatched in addition to file-removed
 * whenever the removed file had `status === 'complete'`. Lets apps wire
 * a server-side DELETE separate from the cosmetic "user dropped a pending
 * file before it uploaded" case. The metadata is whatever the upload
 * handler returned via `FileUploadResult.metadata`.
 */
export interface FileDeletedEventDetail {
    /** The completed file being removed (includes metadata, downloadUrl) */
    file: FileState;
    /** All remaining files after removal */
    files: FileState[];
}

/**
 * Event detail for file-progress — dispatched whenever a file's progress
 * value changes. Substrate for satellite renderers (`<web-dropzone-list>`,
 * `<web-dropzone-indicator>`, …) so they can subscribe to per-file ticks
 * across shadow boundaries without polling. See ARCHITECTURE.md.
 */
export interface FileProgressEventDetail {
    /** The id of the file whose progress changed */
    id: string;
    /** Current progress (0–100, clamped) */
    progress: number;
    /** Current status — included so progress-only subscribers don't also
     *  need to listen to file-status-changed for the common case. */
    status: FileState['status'];
    /** Live reference to the full file state, post-mutation */
    file: FileState;
}

/**
 * Event detail for file-status-changed — dispatched whenever a file's
 * status transitions (pending → uploading, uploading → complete, etc.).
 * `prevStatus` and `nextStatus` are always different; no-op mutations
 * are suppressed at the source. Substrate for satellite renderers.
 */
export interface FileStatusChangedEventDetail {
    /** The id of the file whose status changed */
    id: string;
    /** Status before the transition */
    prevStatus: FileState['status'];
    /** Status after the transition */
    nextStatus: FileState['status'];
    /** Live reference to the full file state, post-transition */
    file: FileState;
}

/**
 * Event detail for `file-row-update` — dispatched on element-returning
 * `renderFileItemCallback` outputs when a file's state changes (instead
 * of re-rendering the row). The consumer listens on the element they
 * returned and mutates its DOM in place. Bubbles + composed so listeners
 * on the store or further up also receive it.
 */
export interface FileRowUpdateEventDetail {
    /** Live reference to the full file state, post-mutation */
    file: FileState;
}

/**
 * Event detail for `files-changed` — a coalesced "queue updated" tick
 * dispatched once per animation frame. Aggregates all granular events
 * (`file-added` / `file-removed` / `file-progress` /
 * `file-status-changed`) that happened within the window. Mode-3 /
 * reactive consumers subscribe to this in place of the four granular
 * events to get one diff per frame.
 */
export interface FilesChangedEventDetail {
    /** Set of file ids that triggered the tick (alive or removed). */
    changedIds: string[];
    /** Current snapshot of the full files list. */
    files: FileState[];
}

/**
 * Helper type for all dropzone event details
 */
export type DropzoneEventDetail =
    | FileAddedEventDetail
    | FileRemovedEventDetail
    | FilesRejectedEventDetail
    | ChangeEventDetail
    | FileRetryEventDetail
    | FileUploadedEventDetail
    | FileDeletedEventDetail
    | FileProgressEventDetail
    | FileStatusChangedEventDetail;

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
