/**
 * WebDropzone - Core file dropzone component
 *
 * A feature-rich file dropzone with drag-drop, previews, validation,
 * and multiple display modes.
 */

import { computePosition, flip, shift, offset, size, autoUpdate } from '@floating-ui/dom';
import type { Placement } from '@floating-ui/dom';
import { initLogger, fileLogger, uiLogger, interactionLogger } from './logger';
import type {
    DropzoneConfig,
    DedupeMode,
    FileState,
    FileUploadContext,
    ValidationResult,
    RejectedFile,
    DisplayMode,
    SelectorAppearance,
    ListAppearance,
    RollingRotation,
    CardSize,
    FileTypeCategory,
    FileStatus,
    FILE_TYPE_ICONS,
    FileItemRenderContext,
    AddFilesOptions
} from './types';

// Re-export FILE_TYPE_ICONS for use in this file
const FILE_ICONS: Record<FileTypeCategory, string> = {
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

// Status / action icons live in `./icons` so the satellite renderers and any
// user-provided callbacks can share the same Lucide SVG family.
import {
    STATUS_ICONS,
    STATUS_LABELS,
    ACTION_ICONS,
    ACTION_LABELS,
    actionForStatus
} from './icons';
// Row templates (list / detailed / grid / badges) are shared with the
// `<web-dropzone-list>` satellite via `./row-templates` — single source of
// truth so the polished styling in `_file-item.css` applies identically
// regardless of which renderer emits the row.
import * as RowTemplate from './row-templates';
import type { RowTemplateOptions } from './row-templates';
// Shared status-surface contract — the rolling list uses the same three
// callbacks (body / fileInfo / progress) as the indicator satellite, so
// templates port across surfaces unchanged. See ./status-surface.ts.
import {
    buildStatusSurfaceArgs,
    StatusSurface
} from './status-surface';
import type {
    StatusSurfaceArgs,
    StatusSurfaceResult
} from './status-surface';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<Omit<DropzoneConfig, 'validateCallback' | 'addCallback' | 'removeCallback' | 'changeCallback' | 'rejectCallback' | 'retryCallback' | 'uploadFileCallback' | 'uploadedCallback' | 'deleteCallback' | 'renderFileItemCallback' | 'renderListWrapperCallback' | 'renderPromptCallback' | 'renderSummaryCallback' | 'customStylesCallback' | 'persistStateCallback' | 'loadStateCallback' | 'storageKey' | 'container' | 'hostElement' | 'overlayTarget' | 'selectorAppearance' | 'listAppearance' | 'cardSize' | 'isShowThumbnailsEnabled' | 'retryPolicy' | 'rollingRotation' | 'isHeadless' | 'renderRollingBodyCallback' | 'renderRollingFileInfoCallback' | 'renderRollingProgressCallback'>> = {
    isMultipleEnabled: true,
    accept: '',
    maxFileSize: 0,
    minFileSize: 0,
    maxTotalSize: 0,
    maxFileCount: 0,
    minFileCount: 0,
    maxVisibleFiles: 7,
    dedupeMode: 'name',
    isDisabled: false,
    // Default for programmatic (non-web-component) usage. The web-component
    // wrapper always resolves an explicit mode in `buildConfig` before
    // construction reaches here.
    mode: 'bulk',
    progressThrottle: 0,
    displayMode: 'list',
    isFilesInsideEnabled: false,
    icon: '📤',
    promptText: 'Drop files here or click to browse',
    selectFilesText: 'Select files',
    hintText: '',
    dragActiveText: 'Drop files here',
    emptyMessage: 'No files selected',
    summaryTemplate: '{count} file(s), {size}',
    popoverPlacement: 'bottom-start',
    overlayText: 'Drop files here',
    overlayIcon: '📎',
    name: '',
    valueFormat: 'json',
    concurrency: 1,
    isAutoUploadEnabled: true,
    isUploadedFileDeletable: true,
    isReorderCompletedEnabled: false,
    reorderCompletedDelay: 1500,
    progressMode: 'optimistic'
};

/**
 * Expand `displayMode` shorthand into the three orthogonal axes. Explicit
 * values on `config` always win — the shorthand only supplies defaults for
 * axes the caller didn't set themselves.
 *
 * Mapping:
 *   list     → selector=card, list=list,     cardSize=compact
 *   detailed → selector=card, list=detailed, cardSize=compact
 *   grid     → selector=card, list=grid,     cardSize=compact
 *   compact  → selector=card, list=popover,  cardSize=compact
 */
function resolveDisplayConfig(config: DropzoneConfig): {
    selectorAppearance: SelectorAppearance;
    listAppearance: ListAppearance;
    cardSize: CardSize;
} {
    const shorthand = config.displayMode ?? 'list';
    let selector: SelectorAppearance = 'card';
    let list: ListAppearance = 'list';
    let cardSize: CardSize = 'compact';

    switch (shorthand) {
        case 'detailed': list = 'detailed'; break;
        case 'grid':     list = 'grid';     break;
        case 'compact':  list = 'popover';  break;
        case 'list':
        default:         list = 'list';     break;
    }

    return {
        selectorAppearance: config.selectorAppearance ?? selector,
        listAppearance:     config.listAppearance     ?? list,
        cardSize:           config.cardSize           ?? cardSize
    };
}

/**
 * Generate a unique ID for a file
 */
function generateFileId(): string {
    return `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = bytes / Math.pow(k, i);
    return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Get file type category from MIME type or extension
 */
export function getFileTypeCategory(file: File): FileTypeCategory {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();

    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    if (type.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) return 'doc';
    if (type.includes('spreadsheet') || type.includes('excel') || name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv')) return 'spreadsheet';
    if (type.includes('zip') || type.includes('rar') || type.includes('tar') || type.includes('7z') || name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.tar') || name.endsWith('.gz')) return 'archive';
    if (type.includes('javascript') || type.includes('typescript') || type.includes('json') || type.includes('html') || type.includes('css') || name.match(/\.(js|ts|jsx|tsx|json|html|css|scss|py|java|cpp|c|h|rb|go|rs|php)$/)) return 'code';
    if (type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) return 'text';

    return 'default';
}

/**
 * Get file icon for a file
 */
export function getFileIcon(file: File): string {
    const category = getFileTypeCategory(file);
    return FILE_ICONS[category];
}

/**
 * Check if file is an image
 */
export function isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
}

/**
 * Create image preview URL using FileReader
 */
export function createImagePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!isImageFile(file)) {
            reject(new Error('Not an image file'));
            return;
        }

        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * WebDropzone class - Core component logic
 */
export class WebDropzone {
    private element: HTMLElement;
    private config: DropzoneConfig;
    private files: FileState[] = [];
    private dragActive = false;
    private popover: HTMLElement | null = null;
    private isPopoverOpen = false;
    /** Cleanup function returned by Floating UI's autoUpdate. Called from
     *  closePopover() to detach the scroll / resize observers it installs.
     *  null when the popover isn't open. */
    private popoverPositionCleanup: (() => void) | null = null;
    /** ResizeObserver watching the popover for user-driven resize. Saves
     *  the resulting dimensions to persisted state. Disconnected in
     *  closePopover so it doesn't leak past popover lifetime. */
    private popoverResizeObserver: ResizeObserver | null = null;
    /** Debounce handle for the resize → save flow. ResizeObserver fires on
     *  every drag tick; we only want to persist the final dimension. */
    private popoverSaveTimer: number | null = null;
    /** When true, the maxVisibleFiles cap is ignored and all files are
     *  rendered. Toggled by the "Show N more" / "Show less" button at the
     *  end of the list (or the "+N" badge in badges mode). Reset on clear(). */
    private showAllList = false;

    // ========================================================================
    // UPLOAD PIPELINE STATE — only relevant when `uploadFileCallback` is set.
    // ========================================================================
    /** AbortController per in-flight upload, used by pause/cancel/remove. */
    private controllers = new Map<string, AbortController>();
    /** File IDs the user paused. A paused file aborts its handler and stays
     *  out of the worker pool's pending pickup. resumeFile() removes the
     *  entry and re-queues. */
    private pausedIds = new Set<string>();
    /** Set of file IDs currently claimed by a worker. Prevents two workers
     *  from racing onto the same file when the queue is mid-drain. */
    private activeIds = new Set<string>();
    /** Re-entrancy guard so simultaneous uploadAll() calls collapse into one. */
    private isDrainingQueue = false;
    /** Pending reorder timers per file id, used to delay the visual move of
     *  a row from the "unresolved" bucket to the "complete" bucket (see
     *  `reorderCompletedDelay`). A file with a pending timer is NOT yet
     *  reorder-eligible — the timer firing IS the eligibility signal.
     *  Cancelled if the file un-completes (retry) or is removed before
     *  the timer fires. */
    private reorderTimers = new Map<string, number>();

    // DOM elements
    private dropzoneEl: HTMLElement | null = null;
    private inputEl: HTMLInputElement | null = null;
    private fileListEl: HTMLElement | null = null;
    private filesInsideEl: HTMLElement | null = null;
    private summaryEl: HTMLElement | null = null;
    private overallProgressEl: HTMLElement | null = null;
    /**
     * The `<web-dropzone-list>` satellite mounted by `mountSatellites()`.
     * Used as a popover anchor in the satellite-rolling path (the actual
     * `.dz__file-list--rolling` element lives in the satellite's shadow
     * root and isn't reachable from `getPopoverAnchor`). Null when the
     * in-class renderer is in use.
     */
    private satelliteListEl: HTMLElement | null = null;
    /**
     * Cache of element-returning `renderFileItemCallback` outputs, keyed by
     * file id. When present for a file, `patchFileRow` skips the re-render
     * path and dispatches a `file-row-update` event on the cached element
     * instead — preserving listeners and DOM identity across state ticks.
     * Pruned in `renderFileList` (files no longer visible) and in
     * `removeFile`.
     */
    private fileRowElements: Map<string, HTMLElement> = new Map();
    /**
     * Per-file progress throttling. `lastFireAt` holds the last
     * `performance.now()` we ran the tick for each file. When a new
     * progress call lands within the throttle window, the latest value
     * is stashed in `pendingProgress` and a trailing-edge timer
     * (`pendingTimer`) fires it after the window elapses. The final
     * value (e.g. 100%) is never dropped — held values flush as a
     * single trailing tick. See `progressThrottle` config.
     */
    private throttleLastFireAt: Map<string, number> = new Map();
    private throttlePendingTimer: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private throttlePendingProgress: Map<string, number> = new Map();
    /**
     * Coalesced `files-changed` event state. Any granular emit
     * (`file-added` / `file-removed` / `file-progress` /
     * `file-status-changed`) marks the file id dirty and schedules an
     * rAF; the rAF dispatches a single `files-changed` with the current
     * snapshot. Mode-3 / reactive consumers subscribe to this one event
     * instead of the four granular ones to get one diff per frame.
     */
    private dirtyFileIds: Set<string> = new Set();
    private filesChangedRafHandle: number | null = null;

    // Rolling list status-surface memoization. Encapsulates the three
    // `*Prev` snapshots (body / fileInfo / progress) so identical results
    // on subsequent ticks skip the DOM write — see `StatusSurface` in
    // ./status-surface.ts.
    private rollingSurface = new StatusSurface();

    // Drag overlay elements
    private overlayTarget: HTMLElement | null = null;
    private dragOverlay: HTMLElement | null = null;

    // Event handler references for cleanup
    private boundHandleDragOver: (e: DragEvent) => void;
    private boundHandleDragLeave: (e: DragEvent) => void;
    private boundHandleDrop: (e: DragEvent) => void;
    private boundHandleClick: (e: MouseEvent) => void;
    private boundHandleInputChange: (e: Event) => void;
    private boundHandleDocumentClick: (e: MouseEvent) => void;
    private boundHandleKeyDown: (e: KeyboardEvent) => void;
    private boundHandleOverlayDragEnter: (e: DragEvent) => void;
    private boundHandleWindowBlur: () => void;

    constructor(element: HTMLElement, config: DropzoneConfig = {}) {
        this.element = element;
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Bind event handlers
        this.boundHandleDragOver = this.handleDragOver.bind(this);
        this.boundHandleDragLeave = this.handleDragLeave.bind(this);
        this.boundHandleDrop = this.handleDrop.bind(this);
        this.boundHandleClick = this.handleClick.bind(this);
        this.boundHandleInputChange = this.handleInputChange.bind(this);
        this.boundHandleDocumentClick = this.handleDocumentClick.bind(this);
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        this.boundHandleOverlayDragEnter = this.handleOverlayDragEnter.bind(this);
        this.boundHandleWindowBlur = this.removeOverlay.bind(this);

        initLogger.debug('WebDropzone initialized', { config: this.config });

        this.render();
        this.attachEventListeners();
        this.setupOverlayTarget();
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Get all current files
     */
    getFiles(): FileState[] {
        return [...this.files];
    }

    /**
     * Read-only view of the merged config. Useful for callers (e.g. the
     * web-component shell) that need to query a config value after
     * resolution against defaults.
     */
    getConfig(): Readonly<DropzoneConfig> {
        return this.config;
    }

    /**
     * Add files programmatically. The optional `opts` (Mode B — see
     * ARCHITECTURE.md) carries per-file routing the contributing picker
     * wants stamped onto each new FileState: `uploadCallback` overrides
     * the store-level handler for these specific files, `uploadMetadata`
     * is handed to the handler via `FileUploadContext.uploadMetadata`.
     * Omit `opts` for Mode A — files inherit the store's handler.
     */
    addFiles(fileList: FileList | File[], opts?: AddFilesOptions): void {
        const files = Array.from(fileList);
        this.processFiles(files, opts);
    }

    /**
     * Remove a file by ID
     */
    removeFile(id: string): void {
        const index = this.files.findIndex(f => f.id === id);
        if (index === -1) return;

        // Abort any in-flight upload for this file before dropping it from
        // state. Clearing pausedIds first prevents runUpload's catch branch
        // from flipping the (already-removed) file to 'paused'.
        this.pausedIds.delete(id);
        this.controllers.get(id)?.abort();
        // Cancel any pending reorder timer — the row is going away, no
        // point firing the deferred move after the row is gone.
        const pendingReorder = this.reorderTimers.get(id);
        if (pendingReorder !== undefined) {
            clearTimeout(pendingReorder);
            this.reorderTimers.delete(id);
        }

        const file = this.files[index];
        const hasServerState = this.hasServerSideState(file);
        this.files.splice(index, 1);
        this.fileRowElements.delete(id);
        this.throttleLastFireAt.delete(id);
        this.clearThrottlePending(id);

        fileLogger.debug('File removed', { id, name: file.name, hasServerState });

        // Emit events. file-deleted fires on top of file-removed whenever
        // the file has server-side state worth cleaning up — completed
        // files (server has the full blob) OR any file whose handler
        // stashed metadata via setMetadata (e.g. tus.io session URL from a
        // partial upload that the user paused-then-removed).
        this.emitRemoveEvent(file);
        if (hasServerState) this.emitDeleteEvent(file);
        this.emitChangeEvent();

        // Re-render
        this.renderFileList();
        this.updateSummary();
    }

    /**
     * Decide whether this file has server-side state that the app should
     * clean up on removal. Either:
     *   - the upload finished (server holds the full blob), OR
     *   - the handler stashed metadata via context.setMetadata — implying it
     *     learned a session URL / upload-id during a partial attempt, even
     *     if the upload itself never completed (pause-then-remove flow).
     */
    private hasServerSideState(file: FileState): boolean {
        if (file.status === 'complete') return true;
        return !!file.metadata && Object.keys(file.metadata).length > 0;
    }

    /**
     * Clear all files
     */
    clear(): void {
        // Abort every in-flight upload before the FileState array is wiped —
        // the run paths key off `this.files.find(...)` so an empty array would
        // already be enough, but explicitly aborting also frees XHRs etc.
        for (const ctrl of this.controllers.values()) ctrl.abort();
        this.controllers.clear();
        this.pausedIds.clear();
        this.activeIds.clear();

        const removedFiles = [...this.files];
        this.files = [];
        this.showAllList = false;
        this.clearAllReorderTimers();

        fileLogger.debug('All files cleared', { count: removedFiles.length });

        // Emit events for each removed file — also fire file-deleted for
        // any file that had server-side state stashed (completed OR paused
        // with metadata, etc.) so server cleanup hooks fire on Clear all.
        removedFiles.forEach(file => {
            this.emitRemoveEvent(file);
            if (this.hasServerSideState(file)) this.emitDeleteEvent(file);
        });
        this.emitChangeEvent();

        // Re-render
        this.renderFileList();
        this.updateSummary();
    }

    /**
     * Update configuration in place. Re-renders the component, re-binds event
     * listeners, and re-applies file list / summary / hidden inputs against
     * the new config. Returns `true` so callers can use the same surface as
     * other KM web-components (where `false` signals a structural change that
     * needs a full reinit; this component can apply every config change
     * in-place, so the return value is informational).
     */
    updateConfig(config: Partial<DropzoneConfig>): boolean {
        const prevOverlayTarget = this.config.overlayTarget;
        this.config = { ...this.config, ...config };
        initLogger.debug('Config updated', { config: this.config });

        // Tear down and rebuild the in-element DOM. The dropzone's DOM is
        // small and rebuilding is cheaper than diffing — but we keep state
        // (this.files, this.dragActive, this.isPopoverOpen) intact so the
        // user-visible selection survives.
        this.detachEventListeners();
        this.render();
        this.attachEventListeners();
        this.renderFileList();
        this.updateSummary();

        // Overlay target replumb only if the target actually changed —
        // listeners on document are cheap but the cleanup is observable
        // (other dropzones on the page could be relying on document-level
        // dragenter, so we don't want to thrash this unnecessarily).
        if ('overlayTarget' in config && config.overlayTarget !== prevOverlayTarget) {
            this.cleanupOverlay();
            this.setupOverlayTarget();
        }

        return true;
    }

    /**
     * Destroy the component
     */
    destroy(): void {
        // Abort any in-flight uploads — handlers should bail out via AbortError
        // so the calling app's underlying XHR / fetch is also cancelled.
        for (const ctrl of this.controllers.values()) ctrl.abort();
        this.controllers.clear();
        this.pausedIds.clear();
        this.activeIds.clear();

        // Cancel coalesced rAF; clear all per-file throttle timers.
        if (this.filesChangedRafHandle !== null) {
            cancelAnimationFrame(this.filesChangedRafHandle);
            this.filesChangedRafHandle = null;
        }
        for (const handle of this.throttlePendingTimer.values()) clearTimeout(handle);
        this.throttlePendingTimer.clear();

        this.detachEventListeners();
        this.closePopover();
        this.cleanupOverlay();
        this.element.innerHTML = '';
        initLogger.debug('WebDropzone destroyed');
    }

    /**
     * Update file progress (for upload tracking). Patches the affected row in
     * place rather than rebuilding the entire file list — important for upload
     * pipelines that emit progress events at 50ms intervals across many files.
     */
    updateFileProgress(id: string, progress: number): void {
        const throttleMs = this.config.progressThrottle ?? 0;
        if (throttleMs <= 0) {
            this.flushProgressTick(id, progress);
            return;
        }

        const now = performance.now();
        const lastFire = this.throttleLastFireAt.get(id) ?? 0;
        const elapsed = now - lastFire;

        if (elapsed >= throttleMs) {
            // Cooldown elapsed — fire immediately, mark timestamp.
            this.flushProgressTick(id, progress);
            this.throttleLastFireAt.set(id, performance.now());
            this.clearThrottlePending(id);
            return;
        }

        // Within cooldown — overwrite pending value; schedule a
        // trailing-edge fire if one isn't already queued.
        this.throttlePendingProgress.set(id, progress);
        if (!this.throttlePendingTimer.has(id)) {
            const wait = throttleMs - elapsed;
            const handle = setTimeout(() => {
                this.throttlePendingTimer.delete(id);
                const pending = this.throttlePendingProgress.get(id);
                this.throttlePendingProgress.delete(id);
                if (pending !== undefined) {
                    this.flushProgressTick(id, pending);
                    this.throttleLastFireAt.set(id, performance.now());
                }
            }, wait);
            this.throttlePendingTimer.set(id, handle);
        }
    }

    /**
     * Apply a single progress tick — clamp value, auto-flip status, run
     * the centralized mutator so events fire atomically, then patch the
     * row. Hot-path helper for `updateFileProgress`; also used by the
     * throttle's trailing-edge timer with the latest stashed progress
     * value.
     */
    private flushProgressTick(id: string, progress: number): void {
        const file = this.files.find(f => f.id === id);
        if (!file) return;
        const clamped = Math.max(0, Math.min(100, progress));
        let nextStatus = file.status;
        if (clamped > 0 && clamped < 100 && file.status === 'pending') {
            nextStatus = 'uploading';
        } else if (clamped === 100 && file.status === 'uploading') {
            nextStatus = 'complete';
        }
        this.mutateFileState(file, { progress: clamped, status: nextStatus });
        fileLogger.debug('File progress updated', { id, progress: file.progress, status: file.status });
        this.patchFileRow(file);
    }

    private clearThrottlePending(id: string): void {
        const handle = this.throttlePendingTimer.get(id);
        if (handle !== undefined) clearTimeout(handle);
        this.throttlePendingTimer.delete(id);
        this.throttlePendingProgress.delete(id);
    }

    /**
     * Set file status (pending, uploading, complete, error). Patches the
     * affected row in place — see updateFileProgress.
     */
    setFileStatus(id: string, status: FileState['status'], error?: string): void {
        const file = this.files.find(f => f.id === id);
        if (!file) return;

        if (error) file.error = error;
        // 'complete' implies progress=100 — bundle into one mutator call so
        // the status-changed and progress events fire atomically.
        this.mutateFileState(
            file,
            status === 'complete' ? { status, progress: 100 } : { status }
        );

        fileLogger.debug('File status updated', { id, status, error });

        this.patchFileRow(file);
    }

    /**
     * Get a file by ID
     */
    getFile(id: string): FileState | undefined {
        return this.files.find(f => f.id === id);
    }

    /**
     * Re-queue a single file's upload after a failure (error / cancelled) and
     * fire `file-retry` so apps with their own handler can re-run it. Symmetric
     * with the pause/resume design: the COMPONENT preserves `file.progress`
     * and the HANDLER decides whether to continue from the partial offset
     * (resume-aware, e.g. tus.io HEAD then PATCH from the server's offset) or
     * reset and start fresh (single-shot endpoints). Handlers that always
     * start from 0 can simply call `onProgress(0)` on their first tick — the
     * bar snaps back from the old failure point as expected. Clears `error`
     * and flips status to `pending`; `file.progress` is unchanged so
     * `context.startBytes` reflects the last known offset.
     */
    retryFile(id: string): void {
        const file = this.files.find(f => f.id === id);
        if (!file) return;
        this.pausedIds.delete(id);
        // Cancel any pending reorder + release the "complete" bucket
        // immediately. Belt-and-braces: patchFileRow's boundary check
        // also covers this when the row is in the rendered DOM, but
        // calling scheduleReorder(id, false) directly handles the case
        // where the row is hidden behind a Show-more cap (querySelector
        // returns null and the inline branch skips).
        if (this.config.isReorderCompletedEnabled) {
            this.scheduleReorder(id, false);
        }
        file.error = undefined;
        this.mutateFileState(file, { status: 'pending' });
        fileLogger.debug('File retry requested', { id, name: file.name, startPercent: file.progress });
        this.patchFileRow(file);
        this.emitRetryEvent(file);
        // Component-driven mode: re-queue via the worker pool. The pool's
        // re-entrancy guard collapses simultaneous calls — retryAll calling
        // retryFile in a loop still triggers one drain pass. Mode B: a
        // per-file handler also qualifies; uploadAll's per-worker filter
        // skips files with neither.
        if (file.uploadCallback || this.config.uploadFileCallback) {
            void this.uploadAll();
        }
    }

    /**
     * Retry every file currently in the 'error' or 'cancelled' state. Each
     * retry fires its own `file-retry` event so apps with a single
     * upload-handler wired to `file-added` can wire the same handler to
     * `file-retry` and have bulk retry "just work". When the component-driven
     * pipeline (`uploadFileCallback`) is active, retryFile() also re-queues
     * the file — the queue drains via uploadAll() called at the end.
     */
    retryAll(): void {
        // Snapshot the ids first — retryFile mutates each file's status, so
        // iterating over a live filter would skip every other entry.
        const failedIds = this.files
            .filter(f => f.status === 'error' || f.status === 'cancelled')
            .map(f => f.id);
        for (const id of failedIds) {
            this.retryFile(id);
        }
    }

    // ========================================================================
    // UPLOAD PIPELINE — component-driven uploads when uploadFileCallback is set
    // ========================================================================

    /**
     * Drain the queue of pending files through a worker pool of size
     * `config.concurrency`. Re-entrant calls collapse into the in-flight run —
     * the worker pool naturally picks up any files added mid-drain because
     * each worker re-queries `this.files` on every iteration.
     */
    async uploadAll(): Promise<void> {
        if (this.isDrainingQueue) return;

        this.isDrainingQueue = true;
        const concurrency = Math.max(1, this.config.concurrency ?? 1);

        // Mode B: skip files that have neither a per-file handler nor a
        // store-level handler. Otherwise the worker spins picking up files
        // that runUpload would immediately drop, never marking activeIds.
        const hasHandler = (f: FileState) =>
            !!(f.uploadCallback || this.config.uploadFileCallback);

        const worker = async (): Promise<void> => {
            while (true) {
                const next = this.files.find(f =>
                    f.status === 'pending' &&
                    !this.pausedIds.has(f.id) &&
                    !this.activeIds.has(f.id) &&
                    hasHandler(f)
                );
                if (!next) return;
                this.activeIds.add(next.id);
                try {
                    await this.runUpload(next.id);
                } finally {
                    this.activeIds.delete(next.id);
                }
            }
        };

        try {
            await Promise.all(Array.from({ length: concurrency }, () => worker()));
        } finally {
            this.isDrainingQueue = false;
        }
    }

    /**
     * Upload a single file by ID immediately, bypassing the queue. Useful for
     * "upload-on-demand" UIs (e.g. each row has its own upload button).
     */
    async uploadFile(id: string): Promise<void> {
        // Mode B: a per-file handler is enough — the file might have come
        // in via a picker that owns its own handler, even if the store
        // itself has none.
        const file = this.files.find(f => f.id === id);
        if (!file) return;
        if (!file.uploadCallback && !this.config.uploadFileCallback) return;
        if (this.activeIds.has(id)) return;
        this.activeIds.add(id);
        try {
            await this.runUpload(id);
        } finally {
            this.activeIds.delete(id);
        }
    }

    /** Pause an in-flight upload. The handler's AbortSignal fires; the file
     *  status flips to 'paused' once the handler bails. resumeFile() restarts
     *  from progress=0 (handlers don't resume mid-stream by default). */
    pauseFile(id: string): void {
        this.pausedIds.add(id);
        const ctrl = this.controllers.get(id);
        if (ctrl) {
            ctrl.abort();
        }
        // Always flip status to 'paused' synchronously when applicable.
        // Two cases this covers:
        //   1) Not in flight (no ctrl, status pending/uploading) — same as
        //      the original `else` branch.
        //   2) In flight under auto-retry, but paused during the retry
        //      delay (between attempts) — the previous attempt's ctrl is
        //      still in the controllers map (finally hasn't fired yet)
        //      because the outer runUpload is awaiting setTimeout. We hit
        //      the `if (ctrl)` branch above and abort, but the catch path
        //      that would normally flip status to 'paused' is already
        //      done — its delay-wakeup will see `pausedIds.has(id)` and
        //      bail out early without touching status. So the file would
        //      be left visibly "uploading" forever. Flipping here
        //      synchronously is idempotent with the catch-path flip when
        //      a handler IS in flight (status will already be 'paused' by
        //      the time the catch runs; the catch's re-flip is a no-op).
        const file = this.files.find(f => f.id === id);
        if (file && (file.status === 'pending' || file.status === 'uploading')) {
            this.mutateFileState(file, { status: 'paused' });
            this.patchFileRow(file);
        }
        this.updateOverallProgress();
    }

    /**
     * Un-pause a file and re-queue it. The worker pool picks it up on its
     * next iteration (or immediately if no workers are running). Progress is
     * preserved across pause → resume so the handler can resume mid-stream
     * if its server supports it (HTTP Content-Range, tus.io, etc); the
     * handler receives the preserved offset via `context.startBytes`.
     *
     * Cancelled files are treated as fresh starts since "cancel" is
     * user-initiated abort — server-side state should be assumed gone.
     */
    async resumeFile(id: string): Promise<void> {
        this.pausedIds.delete(id);
        const file = this.files.find(f => f.id === id);
        if (!file) return;
        if (file.status === 'paused') {
            // Preserve progress — handler resumes from context.startBytes.
            file.error = undefined;
            this.mutateFileState(file, { status: 'pending' });
            this.patchFileRow(file);
        } else if (file.status === 'cancelled') {
            // Cancelled → user-initiated abort, server state is assumed lost.
            file.error = undefined;
            this.mutateFileState(file, { status: 'pending', progress: 0 });
            this.patchFileRow(file);
        }
        await this.uploadAll();
    }

    /** Cancel an in-flight upload. Unlike pauseFile(), the file ends in the
     *  'cancelled' status and won't auto-resume — the user has to retry. */
    cancelFile(id: string): void {
        // Distinguish cancel from pause in the run path by clearing pausedIds.
        this.pausedIds.delete(id);
        const ctrl = this.controllers.get(id);
        if (ctrl) {
            ctrl.abort();
        } else {
            const file = this.files.find(f => f.id === id);
            if (file && (file.status === 'pending' || file.status === 'uploading')) {
                this.mutateFileState(file, { status: 'cancelled' });
                this.patchFileRow(file);
            }
        }
        this.updateOverallProgress();
    }

    /** Pause every uploading / pending file. */
    pauseAll(): void {
        for (const f of this.files) {
            if (f.status === 'uploading' || f.status === 'pending') {
                this.pauseFile(f.id);
            }
        }
    }

    /** Resume every paused file. Progress is preserved so handlers see a
     *  non-zero `context.startBytes` and can resume mid-stream. */
    async resumeAll(): Promise<void> {
        for (const f of this.files) {
            if (f.status === 'paused') {
                this.pausedIds.delete(f.id);
                // Progress preserved — handler sees startBytes > 0.
                f.error = undefined;
                this.mutateFileState(f, { status: 'pending' });
                this.patchFileRow(f);
            }
        }
        await this.uploadAll();
    }

    /**
     * Internal: run the upload handler for a single file, drive the status
     * machine, and apply the retry policy on failure. The worker pool calls
     * this — direct callers should use uploadFile() so the activeIds bookkeeping
     * stays consistent.
     */
    private async runUpload(id: string, attempt = 0): Promise<void> {
        const file = this.files.find(f => f.id === id);
        if (!file) return;
        if (this.pausedIds.has(id)) return;
        // Mode B precedence: a file-stamped handler (set by the contributing
        // picker at add-time, see ARCHITECTURE.md) wins over the store-level
        // handler. Mode A files just inherit `config.uploadFileCallback`.
        const handler = file.uploadCallback ?? this.config.uploadFileCallback;
        if (!handler) return;

        const ctrl = new AbortController();
        this.controllers.set(id, ctrl);

        // Flip to uploading. Progress is NOT reset here — the caller
        // (resumeFile / retryFile / processFiles) controls that. Both
        // pause/resume AND retry-after-failure preserve `file.progress`,
        // so a resume-aware handler always sees a non-zero `startBytes`
        // for any re-entry and can decide whether to continue or restart.
        // Cancel-then-resume (via resumeFile after a cancel) resets to 0,
        // matching the explicit-restart intent of cancellation.
        file.error = undefined;
        this.mutateFileState(file, { status: 'uploading' });
        // Snapshot the pre-attempt progress as the "last known-good"
        // baseline. The handler ticks onProgress optimistically (bytes
        // SENT, not bytes ACKNOWLEDGED) as data flies up the wire — if
        // the request ultimately rejects, those bytes never landed on
        // the server, so the bar has to snap back to this baseline
        // before the retry / error path takes over. Pause / cancel keep
        // the optimistic value (user intent, not failure) — only the
        // failure branch in the catch below uses this.
        const baselineProgress = file.progress;
        this.patchFileRow(file);

        // Build the per-call context — startBytes/startPercent reflect the
        // file's preserved progress, metadata carries any state previously
        // stashed by the handler via setMetadata, and setMetadata mutates
        // file.metadata in place so subsequent attempts (after pause /
        // retry) can recover it via context.metadata.
        const context: FileUploadContext = {
            startBytes: Math.floor(file.size * (file.progress / 100)),
            startPercent: file.progress,
            metadata: file.metadata,
            setMetadata: (patch) => {
                file.metadata = { ...(file.metadata ?? {}), ...patch };
            },
            uploadMetadata: file.uploadMetadata
        };

        try {
            const result = await handler(
                file.file,
                (p) => {
                    // Guard against late progress callbacks after abort —
                    // updateFileProgress would auto-flip status to 'uploading'
                    // and overwrite the abort outcome.
                    if (ctrl.signal.aborted) return;
                    this.updateFileProgress(id, p);
                },
                ctrl.signal,
                context
            );
            // Success — patch + emit. Merge any FileUploadResult fields the
            // handler returned (metadata, downloadUrl, etc.) into the file
            // state atomically with the complete flip. Restricted shape (only
            // the four whitelisted fields) so handlers can't accidentally
            // overwrite id / file / status / progress / error.
            if (result) {
                if (result.metadata !== undefined) file.metadata = result.metadata;
                if (result.downloadUrl !== undefined) file.downloadUrl = result.downloadUrl;
                if (result.previewUrl !== undefined) file.previewUrl = result.previewUrl;
                if (result.name !== undefined) file.name = result.name;
            }
            this.mutateFileState(file, { status: 'complete', progress: 100 });
            this.patchFileRow(file);
            this.emitUploadedEvent(file);
        } catch (err) {
            if (ctrl.signal.aborted) {
                // The signal fires for pause AND cancel — distinguish by which
                // set holds the id. pause keeps it for resume; cancel doesn't.
                this.mutateFileState(file, {
                    status: this.pausedIds.has(id) ? 'paused' : 'cancelled'
                });
                this.patchFileRow(file);
                return;
            }
            const msg = err instanceof Error ? err.message : 'Upload failed';
            const policy = this.config.retryPolicy ?? {};
            const maxAttempts = Math.max(1, policy.attempts ?? 1);
            // eslint-disable-next-line no-console
            console.log(
                `[dz auto-retry] handler rejected for "${file.name}" (id=${id}) ` +
                `at progress=${file.progress.toFixed(1)}% on attempt ${attempt + 1}/${maxAttempts}: ${msg}`
            );
            // Snap-back behaviour is the contract of `progressMode`:
            //   - optimistic: the handler may report onProgress before the
            //     bytes are acknowledged; on failure those bytes never
            //     landed, so we drop back to the pre-attempt baseline.
            //   - pessimistic: the handler is contracted to only report
            //     acknowledged bytes; the bar already reflects committed
            //     state and must not go backwards (forward-only or stop).
            const isOptimistic = (this.config.progressMode ?? 'optimistic') === 'optimistic';
            if (isOptimistic && file.progress !== baselineProgress) {
                // eslint-disable-next-line no-console
                console.log(
                    `[dz auto-retry] snapping "${file.name}" back from ${file.progress.toFixed(1)}% ` +
                    `to baseline ${baselineProgress.toFixed(1)}% (optimistic mode — unacknowledged bytes)`
                );
                this.mutateFileState(file, { progress: baselineProgress });
            }
            if (attempt + 1 < maxAttempts) {
                const delay = (policy.delayMs ?? 1000) * Math.pow(policy.backoff ?? 2, attempt);
                // eslint-disable-next-line no-console
                console.log(
                    `[dz auto-retry] scheduling next attempt for "${file.name}" in ${delay}ms ` +
                    `(progress=${file.progress.toFixed(1)}% preserved → handler will see startBytes=` +
                    `${Math.floor(file.size * (file.progress / 100))})`
                );
                await new Promise(r => setTimeout(r, delay));
                // Bail out cleanly if the file was paused / removed during the
                // backoff window.
                if (this.pausedIds.has(id) || !this.files.find(f => f.id === id)) {
                    // eslint-disable-next-line no-console
                    console.log(
                        `[dz auto-retry] aborting retry for "${file.name}" — ` +
                        `${this.pausedIds.has(id) ? 'paused' : 'removed'} during delay`
                    );
                    return;
                }
                // Auto-retry preserves `file.progress` to match the manual
                // `retryFile` path — the COMPONENT keeps the partial offset
                // and the HANDLER decides whether to continue (resume-aware,
                // e.g. tus.io HEAD then PATCH from the server's offset) or
                // reset and start fresh by calling `onProgress(0)` on its
                // first tick. This makes the auto-retry path honor the same
                // resume contract as Pause → Resume and per-row Retry, so a
                // resume-aware handler gets consistent behaviour across all
                // three recovery flows.
                // eslint-disable-next-line no-console
                console.log(
                    `[dz auto-retry] starting attempt ${attempt + 2}/${maxAttempts} for "${file.name}" ` +
                    `with progress=${file.progress.toFixed(1)}%`
                );
                this.patchFileRow(file);
                return this.runUpload(id, attempt + 1);
            }
            // eslint-disable-next-line no-console
            console.log(
                `[dz auto-retry] giving up on "${file.name}" — exhausted ${maxAttempts} attempts ` +
                `at progress=${file.progress.toFixed(1)}%`
            );
            file.error = msg;
            this.mutateFileState(file, { status: 'error' });
            this.patchFileRow(file);
        } finally {
            this.controllers.delete(id);
        }
    }

    // ========================================================================
    // FILE PROCESSING
    // ========================================================================

    private processFiles(files: File[], opts?: AddFilesOptions): void {
        const acceptedFiles: FileState[] = [];
        const rejectedFiles: RejectedFile[] = [];

        // Seed the dedupe set with the existing selection so a subsequent
        // "Add more" (or repeat drop) skips files already on the list. The
        // set also catches duplicates *within the same incoming batch*
        // (e.g. user picks the same file twice in a single dialog).
        const mode = this.config.dedupeMode ?? DEFAULT_CONFIG.dedupeMode;
        const seenKeys = new Set<string>(
            mode === 'none' ? [] : this.files.map(f => this.dedupeKeyFor(f.file, mode))
        );

        // Stateful caps. The running total seeds from the bytes already in
        // the selection; each accepted file is added to it so two files that
        // would each fit on their own can't both squeak in past the cap.
        // FluentUI uses the same running-total pattern.
        const maxCount = this.config.maxFileCount ?? 0;
        const maxTotal = this.config.maxTotalSize ?? 0;
        let runningCount = this.files.length;
        let runningTotal = maxTotal > 0 ? this.files.reduce((sum, f) => sum + f.size, 0) : 0;

        for (const file of files) {
            // Count cap — done first so an over-cap drop accepts what fits
            // and rejects only the overflow (vs. rejecting the whole batch).
            if (maxCount > 0 && runningCount >= maxCount) {
                rejectedFiles.push({
                    file,
                    validation: {
                        valid: false,
                        error: `Maximum ${maxCount} file${maxCount === 1 ? '' : 's'} allowed`,
                        code: 'count'
                    }
                });
                continue;
            }

            const validation = this.validateFile(file);
            if (!validation.valid) {
                rejectedFiles.push({ file, validation });
                continue;
            }

            if (mode !== 'none') {
                const key = this.dedupeKeyFor(file, mode);
                if (seenKeys.has(key)) {
                    rejectedFiles.push({
                        file,
                        validation: {
                            valid: false,
                            error: `Duplicate file: ${file.name}`,
                            code: 'duplicate'
                        }
                    });
                    continue;
                }
                seenKeys.add(key);
            }

            // Total-size cap — last gate before accept so the running total
            // only advances for files that passed every other check.
            if (maxTotal > 0 && runningTotal + file.size > maxTotal) {
                rejectedFiles.push({
                    file,
                    validation: {
                        valid: false,
                        error: `Total size would exceed ${formatFileSize(maxTotal)}`,
                        code: 'size'
                    }
                });
                continue;
            }

            runningCount++;
            runningTotal += file.size;
            acceptedFiles.push(this.createFileState(file, opts));
        }

        // Add accepted files
        if (acceptedFiles.length > 0) {
            // In single mode, replace existing files
            if (!this.config.isMultipleEnabled) {
                this.files = [acceptedFiles[0]];
            } else {
                this.files.push(...acceptedFiles);
            }

            fileLogger.debug('Files added', { count: acceptedFiles.length });

            // Generate previews for images
            acceptedFiles.forEach(fileState => {
                if (isImageFile(fileState.file)) {
                    this.generatePreview(fileState);
                }
            });

            // Emit events
            acceptedFiles.forEach(file => this.emitAddEvent(file));
            this.emitChangeEvent();
        }

        // Handle rejected files
        if (rejectedFiles.length > 0) {
            fileLogger.warn('Files rejected', { count: rejectedFiles.length, rejectedFiles });
            this.emitRejectEvent(rejectedFiles);
        }

        // Re-render
        this.renderFileList();
        this.updateSummary();

        // If the popover is open (e.g. user clicked "Add more"), reflect the
        // new files immediately — otherwise it stays stuck on the snapshot
        // taken when the popover opened.
        if (this.isPopoverOpen && acceptedFiles.length > 0) {
            this.updatePopoverContent();
        }

        // Auto-upload kicks in once the new files are committed to state, the
        // UI has reflected the additions, and the file-added event has fired.
        // The worker pool's re-entrancy guard collapses overlapping calls.
        // Mode B: a per-file handler stamped via opts.uploadCallback also
        // qualifies — uploadAll's filter picks the right handler per file.
        const hasAnyHandler =
            !!this.config.uploadFileCallback ||
            acceptedFiles.some(f => !!f.uploadCallback);
        if (
            acceptedFiles.length > 0 &&
            hasAnyHandler &&
            this.config.isAutoUploadEnabled !== false
        ) {
            void this.uploadAll();
        }
    }

    private createFileState(file: File, opts?: AddFilesOptions): FileState {
        const state: FileState = {
            id: generateFileId(),
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'pending',
            progress: 0
        };
        // Mode B routing (see ARCHITECTURE.md). Stamped at add-time and
        // preserved through pause / resume / retry — runUpload reads them
        // on every attempt, so a Mode B file uses the same handler/metadata
        // it was contributed with even after a re-queue.
        if (opts?.uploadCallback) state.uploadCallback = opts.uploadCallback;
        if (opts?.uploadMetadata) state.uploadMetadata = opts.uploadMetadata;
        return state;
    }

    private async generatePreview(fileState: FileState): Promise<void> {
        try {
            const previewUrl = await createImagePreview(fileState.file);
            fileState.previewUrl = previewUrl;
            fileLogger.debug('Preview generated', { id: fileState.id, name: fileState.name });

            // Patch the row in place. Works for any listAppearance — grid mode
            // swaps the placeholder for the data URL, other modes are no-op
            // visually but still keep the DOM in sync with FileState.
            this.patchFileRow(fileState);
        } catch (error) {
            fileLogger.warn('Failed to generate preview', { id: fileState.id, error });
        }
    }

    // ========================================================================
    // VALIDATION
    // ========================================================================

    /**
     * Build the dedupe key for a file under the active mode. Called once per
     * existing file (to seed the set) and once per incoming file in
     * processFiles. Mode 'none' is short-circuited at the call site.
     */
    private dedupeKeyFor(file: File, mode: DedupeMode): string {
        if (mode === 'name-size') return `${file.name}|${file.size}`;
        return file.name;
    }

    /**
     * Per-file validation. Stateless checks only — count and total-size limits
     * are stateful and live in processFiles() where the running totals are
     * maintained against the existing selection + the current incoming batch.
     */
    private validateFile(file: File): ValidationResult {
        // Per-file maximum
        if (this.config.maxFileSize && this.config.maxFileSize > 0) {
            if (file.size > this.config.maxFileSize) {
                return {
                    valid: false,
                    error: `File is too large. Maximum size is ${formatFileSize(this.config.maxFileSize)}`,
                    code: 'size'
                };
            }
        }

        // Per-file minimum (reject empty / corrupt zero-byte uploads)
        if (this.config.minFileSize && this.config.minFileSize > 0) {
            if (file.size < this.config.minFileSize) {
                return {
                    valid: false,
                    error: `File is too small. Minimum size is ${formatFileSize(this.config.minFileSize)}`,
                    code: 'size'
                };
            }
        }

        // Check file type
        if (this.config.accept) {
            if (!this.isFileTypeAccepted(file)) {
                return {
                    valid: false,
                    error: `File type not accepted`,
                    code: 'type'
                };
            }
        }

        // Custom validation
        if (this.config.validateCallback) {
            const customResult = this.config.validateCallback(file, this.files);
            if (!customResult.valid) {
                return { ...customResult, code: customResult.code || 'custom' };
            }
        }

        return { valid: true };
    }

    private isFileTypeAccepted(file: File): boolean {
        const acceptTypes = this.config.accept!.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        if (acceptTypes.length === 0) return true;

        const fileType = file.type.toLowerCase();
        const fileName = file.name.toLowerCase();

        return acceptTypes.some(accept => {
            // Universal wildcard — accept anything. Without this branch, '*/*'
            // would fall into the '/*' MIME-wildcard rule below and compare
            // against the bogus prefix '*/', rejecting every real file.
            if (accept === '*' || accept === '*/*') return true;

            // Extension match (e.g., .pdf)
            if (accept.startsWith('.')) {
                return fileName.endsWith(accept);
            }

            // MIME type wildcard (e.g., image/*)
            if (accept.endsWith('/*')) {
                const category = accept.replace('/*', '/');
                return fileType.startsWith(category);
            }

            // Exact MIME type match
            return fileType === accept;
        });
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    private render(): void {
        // Headless store (see ARCHITECTURE.md): no rendering, no listener
        // wiring, no input element. Satellite renderers do all the UI;
        // this instance exists purely as a data + upload-loop source.
        if (this.config.isHeadless) {
            this.element.innerHTML = '';
            uiLogger.debug('Component is headless — skipping render');
            return;
        }
        this.element.innerHTML = this.renderComponent();
        if (this.shouldUseSatelliteRendering()) {
            this.mountSatellites();
        }
        this.cacheElements();
        const r = resolveDisplayConfig(this.config);
        uiLogger.debug('Component rendered', {
            displayMode: this.config.displayMode,
            selectorAppearance: r.selectorAppearance,
            listAppearance: r.listAppearance,
            cardSize: r.cardSize
        });
    }

    /**
     * Convenience-form rendering paths that decompose cleanly into a
     * `<web-dropzone-picker>` + `<web-dropzone-list>` pair.
     *
     * Gated by mode (hard switch — see DropzoneMode):
     *   - 'bulk' (default)  → satellite path; render callbacks IGNORED.
     *   - 'structural'      → in-class render path so render callbacks
     *                         (`renderFileItemCallback`, etc.) take effect.
     *   - 'headless'        → render() short-circuits before reaching us.
     *
     * Notes on the satellite path:
     *  - `popover` is satellite — the list satellite renders the summary
     *    anchor and dispatches `dz-summary-click`. The popover wrapper
     *    (Floating UI + resize + persistence) stays in-class and opens on
     *    that event via the bridge in `mountSatellites`.
     *  - `files-inside` is satellite — the picker satellite gets
     *    `inside="true"`, includes a `<slot>` inside its card, and the
     *    list satellite is mounted as the picker's light-DOM child with
     *    `nested="true"` so it uses the `.dz__files-inside--*` class
     *    family.
     */
    private shouldUseSatelliteRendering(): boolean {
        if (!this.config.hostElement) return false;
        if (this.config.mode === 'structural') return false;
        return true;
    }

    /** True only when consumer-provided render callbacks should be honored. */
    private isStructuralMode(): boolean {
        return this.config.mode === 'structural';
    }

    /**
     * Build + bind the satellite picker / list elements for the convenience
     * form. Called from `render()` after `innerHTML` has populated the
     * container shell. Each satellite is constructed imperatively so
     * `bindToStore` can run BEFORE `connectedCallback` fires — that way
     * the satellite sees `programmaticStoreEl` on its first connect and
     * never logs the "store not found" warning.
     */
    private mountSatellites(): void {
        const host = this.config.hostElement;
        if (!host) return;
        const container = this.element.querySelector('.dz__container');
        if (!container) return;
        const { selectorAppearance, listAppearance, cardSize } = resolveDisplayConfig(this.config);
        const filesInside = !!this.config.isFilesInsideEnabled;

        type BindableSatellite = HTMLElement & { bindToStore?: (el: HTMLElement) => void };

        const picker = document.createElement('web-dropzone-picker') as BindableSatellite;
        picker.setAttribute('selector-appearance', selectorAppearance);
        if (selectorAppearance === 'card') {
            picker.setAttribute('card-size', cardSize);
        }
        // Files-inside composition only makes sense with a card selector
        // (button / minimal have no inside-the-card surface). Falls back
        // to the sibling-layout otherwise.
        const insideMode = filesInside && selectorAppearance === 'card' && listAppearance !== 'none';
        if (insideMode) {
            picker.setAttribute('inside', 'true');
        }
        picker.bindToStore?.(host);
        container.appendChild(picker);

        if (listAppearance !== 'none') {
            const list = document.createElement('web-dropzone-list') as BindableSatellite;
            list.setAttribute('list-appearance', listAppearance);
            if (insideMode) {
                // Switch the list's container class family to
                // `.dz__files-inside--*` so the existing files-inside CSS
                // applies inside the satellite shadow.
                list.setAttribute('nested', 'true');
            }
            list.bindToStore?.(host);
            // Rolling appearance's queue button dispatches `dz-queue-open`
            // (the satellite owns no popover of its own). Bridge it to the
            // in-class popover so the convenience form behaves the same as
            // before. Standalone satellite consumers handle the event
            // themselves.
            if (listAppearance === 'rolling') {
                list.addEventListener('dz-queue-open', () => this.togglePopover());
            }
            // Popover summary anchor: list satellite renders the summary
            // line and fires `dz-summary-click` on activation. Convenience
            // form opens the in-class popover from that event; standalone
            // consumers wire any UI.
            if (listAppearance === 'popover') {
                list.addEventListener('dz-summary-click', () => this.togglePopover());
            }
            if (insideMode) {
                // List becomes a light-DOM child of the picker so the
                // picker's internal `<slot>` projects it into the card.
                picker.appendChild(list);
            } else {
                container.appendChild(list);
            }
            this.satelliteListEl = list;
        } else {
            this.satelliteListEl = null;
        }

        // Overall-progress satellite. Always appended (it auto-hides via
        // `[data-empty="true"]`) — same behavior as the legacy inline
        // strip which used `:empty` to collapse.
        const progress = document.createElement('web-dropzone-progress') as BindableSatellite;
        progress.bindToStore?.(host);
        container.appendChild(progress);
    }

    private renderComponent(): string {
        const { selectorAppearance, listAppearance, cardSize } = resolveDisplayConfig(this.config);
        const filesInside = this.config.isFilesInsideEnabled || false;

        // The summary line (`.dz__summary`) is the standalone click target for
        // listAppearance='popover'. It is only useful with a card selector —
        // for button/minimal selectors the selector itself is the trigger and
        // the popover anchors directly to it (see getPopoverAnchor).
        const needsSummary = listAppearance === 'popover' && selectorAppearance === 'card';

        // The standalone list area is rendered only for in-place list variants
        // (list/detailed/grid/badges/rolling) and only when files-inside is off.
        const needsListArea =
            !filesInside &&
            (listAppearance === 'list' ||
             listAppearance === 'detailed' ||
             listAppearance === 'grid' ||
             listAppearance === 'badges' ||
             listAppearance === 'rolling');

        // `--manual-upload` modifier hides the "pending" status icon across
        // all list appearances (per-row + the popover summary fallback) when
        // auto-upload is off — the icon would otherwise show the second a
        // file is added, before any actual upload activity has happened.
        const isManualUpload = this.config.isAutoUploadEnabled === false;

        const containerClasses = [
            'dz__container',
            `dz__container--selector-${selectorAppearance}`,
            `dz__container--list-${listAppearance}`,
            selectorAppearance === 'card' ? `dz__container--card-${cardSize}` : '',
            filesInside ? 'dz__container--files-inside' : '',
            isManualUpload ? 'dz__container--manual-upload' : ''
        ].filter(Boolean).join(' ');

        // Satellite path — emit just the container shell. Picker, list,
        // and overall-progress satellites are appended programmatically
        // in `mountSatellites()` so we can `bindToStore` them before they
        // connect (avoids the "store not found" warning).
        if (this.shouldUseSatelliteRendering()) {
            return `<div class="${containerClasses}"></div>`;
        }

        // Aggregate progress strip lives alongside any visible file surface in
        // the host area — the inline list (list/detailed/grid/badges) or the
        // summary line for card+popover. Inside the popover itself the same
        // readout is rendered in the footer; for button/minimal+popover the
        // selector's count badge plays a similar role so we skip the strip
        // there (it'd dangle below an icon-only trigger).
        const needsOverallProgress = needsListArea || needsSummary;

        return `
            <div class="${containerClasses}">
                ${this.renderSelector(selectorAppearance, cardSize)}
                ${needsSummary ? this.renderSummaryArea() : ''}
                ${needsListArea ? this.renderFileListArea(listAppearance) : ''}
                ${needsOverallProgress ? this.renderOverallProgressArea() : ''}
            </div>
        `;
    }

    /**
     * Render the selector area — card (drop zone), button, or minimal icon.
     * The native `<input type="file">` is included in every variant so the
     * file picker dialog can be opened from a click on any of them.
     */
    private renderSelector(appearance: SelectorAppearance, cardSize: CardSize): string {
        const disabled = this.config.isDisabled ? 'dz__dropzone--disabled' : '';
        const active = this.dragActive ? 'dz__dropzone--active' : '';
        const hasFiles = this.files.length > 0 ? 'dz__dropzone--has-files' : '';
        const filesInside = this.config.isFilesInsideEnabled ? 'dz__dropzone--files-inside' : '';

        const input = `
            <input type="file"
                class="dz__dropzone__input"
                ${this.config.isMultipleEnabled ? 'multiple' : ''}
                ${this.config.accept ? `accept="${this.config.accept}"` : ''}
                ${this.config.isDisabled ? 'disabled' : ''}
            >
        `;

        if (appearance === 'button') {
            const label = escapeHtml(this.config.selectFilesText || DEFAULT_CONFIG.selectFilesText);
            const count = this.files.length;
            return `
                <div class="dz__dropzone dz__dropzone--button ${disabled}">
                    ${input}
                    <button type="button" class="dz__button" ${this.config.isDisabled ? 'disabled' : ''}>
                        <span class="dz__button__label">${label}</span>
                        ${count > 0 ? `<span class="dz__button__badge">${count}</span>` : ''}
                    </button>
                </div>
            `;
        }

        if (appearance === 'minimal') {
            const icon = this.config.icon || DEFAULT_CONFIG.icon;
            const count = this.files.length;
            const ariaLabel = escapeHtml(this.config.promptText || DEFAULT_CONFIG.promptText);
            return `
                <div class="dz__dropzone dz__dropzone--minimal ${disabled}">
                    ${input}
                    <button type="button" class="dz__minimal" aria-label="${ariaLabel}" ${this.config.isDisabled ? 'disabled' : ''}>
                        <span class="dz__minimal__icon">${icon}</span>
                        ${count > 0 ? `<span class="dz__minimal__badge">${count}</span>` : ''}
                    </button>
                </div>
            `;
        }

        // Card (default)
        const content = this.renderCardContent(cardSize);
        const filesInsideContent = this.config.isFilesInsideEnabled ? this.renderFilesInsideArea() : '';

        return `
            <div class="dz__dropzone dz__dropzone--card dz__dropzone--card-${cardSize} ${disabled} ${active} ${hasFiles} ${filesInside}">
                ${input}
                ${content}
                ${filesInsideContent}
            </div>
        `;
    }

    /**
     * Render the inner content of the card selector. Honors
     * `renderPromptCallback` if provided.
     */
    private renderCardContent(cardSize: CardSize): string {
        if (this.isStructuralMode() && this.config.renderPromptCallback) {
            const result = this.config.renderPromptCallback();
            return typeof result === 'string' ? result : result.outerHTML;
        }

        const text = this.dragActive
            ? (this.config.dragActiveText || DEFAULT_CONFIG.dragActiveText)
            : (this.config.promptText || DEFAULT_CONFIG.promptText);

        const icon = this.config.icon || DEFAULT_CONFIG.icon;
        const hint = this.config.hintText
            ? `<div class="dz__dropzone__hint">${escapeHtml(this.config.hintText)}</div>`
            : '';

        // Big card optionally exposes a dedicated Browse button. For minimal/
        // compact, the whole card is the click target — so no explicit button
        // is needed (avoids visual noise on dense layouts).
        const browseBtn = cardSize === 'big'
            ? `<button type="button" class="dz__card__action">${escapeHtml(this.config.selectFilesText || DEFAULT_CONFIG.selectFilesText)}</button>`
            : '';

        return `
            <div class="dz__dropzone__content">
                <div class="dz__dropzone__icon">${icon}</div>
                <div class="dz__dropzone__text">${escapeHtml(text)}</div>
                ${browseBtn}
                ${hint}
            </div>
        `;
    }

    private renderSummaryArea(): string {
        return `<div class="dz__summary"></div>`;
    }

    private renderFileListArea(listAppearance: ListAppearance): string {
        const reorderClass = this.config.isReorderCompletedEnabled ? ' dz__file-list--reorder-completed' : '';
        return `<div class="dz__file-list dz__file-list--${listAppearance}${reorderClass}"></div>`;
    }

    private renderFilesInsideArea(): string {
        const { listAppearance } = resolveDisplayConfig(this.config);
        const reorderClass = this.config.isReorderCompletedEnabled ? ' dz__files-inside--reorder-completed' : '';
        return `<div class="dz__files-inside dz__files-inside--${listAppearance}${reorderClass}"></div>`;
    }

    /**
     * Return a snapshot of `this.files` ordered for rendering. When
     * `isReorderCompletedEnabled` is on, reorder-eligible files (status
     * 'complete' AND no pending reorder timer) slide to the end via a
     * stable sort (so within each bucket the original add order is
     * preserved). Used by the popover render path and the inline list's
     * cap-render slice; the inline list itself uses CSS `order` for
     * already-rendered rows.
     *
     * Eligibility (not raw `status === 'complete'`) means the popover
     * sort respects the same `reorderCompletedDelay` window the inline
     * CSS rule does — files mid-delay stay in the unresolved bucket.
     */
    private getOrderedFiles(): FileState[] {
        if (!this.config.isReorderCompletedEnabled) return this.files;
        return this.files
            .map((f, i) => ({ f, i, complete: this.isReorderEligible(f) ? 1 : 0 }))
            .sort((a, b) => (a.complete - b.complete) || (a.i - b.i))
            .map(x => x.f);
    }

    /** A file is reorder-eligible when its status is `complete` AND no
     *  delay timer is pending for it. Used by the popover sort and by
     *  the inline render functions to stamp `data-reorder-bucket`. */
    private isReorderEligible(file: FileState): boolean {
        if (!this.config.isReorderCompletedEnabled) return false;
        if (file.status !== 'complete') return false;
        return !this.reorderTimers.has(file.id);
    }

    /**
     * Schedule (or cancel) the delayed reorder for a file. Called from
     * `patchFileRow` whenever a row's status crosses the complete
     * boundary, and from teardown paths (`removeFile`, `retryFile`,
     * `clear`) to clean up.
     *
     * The visible row's `data-reorder-bucket` is the single source of
     * truth for CSS — set when the timer fires, cleared when the file
     * un-completes. The id-set `reorderEligibleIds` mirrors this for the
     * non-DOM render paths (popover sort, cap re-render).
     */
    private scheduleReorder(id: string, becomingComplete: boolean): void {
        // Always cancel any pending timer first; the caller's intent
        // overrides whatever the previous transition queued.
        const pending = this.reorderTimers.get(id);
        if (pending !== undefined) {
            clearTimeout(pending);
            this.reorderTimers.delete(id);
        }

        if (!this.config.isReorderCompletedEnabled) return;

        const apply = () => {
            // The file may have been removed during the timer wait.
            const stillExists = this.files.some(f => f.id === id);
            if (!stillExists) return;

            // Inline-list row: flip `data-reorder-bucket` so the CSS
            // `order: 1` rule kicks in (or releases). Doubles as the
            // visual state used by getOrderedFiles via isReorderEligible
            // (which checks timer presence, now cleared).
            const targetEl = this.config.isFilesInsideEnabled ? this.filesInsideEl : this.fileListEl;
            const row = targetEl?.querySelector(`[data-file-id="${id}"]`) as HTMLElement | null;
            if (row) {
                if (becomingComplete) row.dataset.reorderBucket = 'complete';
                else delete row.dataset.reorderBucket;
            }

            // Popover row: re-sort table via real DOM move (flex order
            // doesn't work on <tr>).
            if (this.popover) this.reorderPopoverRows();

            // Inline list with max-visible-files cap: the completed row
            // needs to drop out of the visible window and the next
            // hidden file slides up. Same condition as the in-line
            // boundary-cross trigger in patchFileRow.
            if ((this.config.maxVisibleFiles ?? 0) > 0 && !this.showAllList) {
                this.renderFileList();
            }
        };

        const delay = Math.max(0, this.config.reorderCompletedDelay ?? 1500);
        if (delay === 0) {
            // Microtask so cleanup hooks (remove / retry called in the
            // same tick) still get a chance to cancel.
            queueMicrotask(apply);
        } else {
            const handle = window.setTimeout(() => {
                this.reorderTimers.delete(id);
                apply();
            }, delay);
            this.reorderTimers.set(id, handle);
        }
    }

    /** Clear all pending reorder timers. Called from destroy / clear;
     *  individual cancellation goes through scheduleReorder(id, false). */
    private clearAllReorderTimers(): void {
        for (const handle of this.reorderTimers.values()) clearTimeout(handle);
        this.reorderTimers.clear();
    }

    /**
     * Empty strip below the inline list. Populated by `updateOverallProgress`
     * whenever any file is uploading / complete / error, and emptied (which
     * collapses it via `:empty`) when there's no upload activity to report.
     */
    private renderOverallProgressArea(): string {
        return `<div class="dz__overall-progress"></div>`;
    }

    /**
     * Parse an HTML string into a single root element. Uses <template> so
     * almost any tag (including <tr>) can be parsed without a wrapping
     * context.
     */
    private htmlToElement(html: string): HTMLElement | null {
        const trimmed = html.trim();
        // Table-content fragments (`<tr>`, `<td>`, `<tbody>`, etc.) can't
        // be parsed via a bare <template> in every browser — the HTML
        // parser's "in body" insertion mode handles them inconsistently
        // when they have no enclosing <table>. Parse them with explicit
        // context so the wrapper-callback table demo's per-tick row swap
        // (patchFileRow) actually finds the new <tr>.
        const lower = trimmed.toLowerCase();
        if (lower.startsWith('<tr')) {
            const tbody = document.createElement('tbody');
            tbody.innerHTML = trimmed;
            return tbody.firstElementChild as HTMLElement | null;
        }
        if (lower.startsWith('<td') || lower.startsWith('<th')) {
            const tr = document.createElement('tr');
            tr.innerHTML = trimmed;
            return tr.firstElementChild as HTMLElement | null;
        }
        if (lower.startsWith('<tbody') || lower.startsWith('<thead') || lower.startsWith('<tfoot')) {
            const table = document.createElement('table');
            table.innerHTML = trimmed;
            return table.firstElementChild as HTMLElement | null;
        }
        const template = document.createElement('template');
        template.innerHTML = trimmed;
        return template.content.firstElementChild as HTMLElement | null;
    }

    /**
     * Attach the main-list remove + row-action click handlers within a
     * subtree. Element-returning row callbacks (see `fileRowElements`)
     * cause this to be called multiple times against the SAME buttons
     * across re-renders — without the `data-dz-bound-*` marker, each
     * click would fire N handlers (one per render), which for retry
     * actions kicks off parallel uploads.
     */
    private bindListRemoveHandlers(root: ParentNode): void {
        root.querySelectorAll<HTMLElement>('[data-action="remove"]').forEach(btn => {
            if (btn.dataset.dzBoundRemove === '1') return;
            btn.dataset.dzBoundRemove = '1';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.fileId;
                if (id) this.handleUserRemoveClick(id);
            });
        });
        root.querySelectorAll<HTMLElement>('[data-action="row-action"]').forEach(btn => {
            if (btn.dataset.dzBoundRowAction === '1') return;
            btn.dataset.dzBoundRowAction = '1';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.fileId;
                if (id) this.handleUserActionClick(id);
            });
        });
    }

    /**
     * Attach the popover remove-button click handler. Behaves like the main
     * list, additionally refreshing the popover body (so the row visibly
     * disappears) and closing the popover when the last file is removed.
     *
     * Important: `removeFile` alone only updates `this.files` and re-renders
     * the inline list — it doesn't touch the popover. So this handler is
     * the ONE place responsible for keeping the popover's table in sync
     * after a per-row X click.
     */
    private bindPopoverRemoveHandlers(root: ParentNode): void {
        root.querySelectorAll('[data-action="remove"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = (btn as HTMLElement).dataset.fileId;
                if (!id) return;
                this.handleUserRemoveClick(id);
                if (this.files.length === 0) {
                    this.closePopover();
                } else {
                    this.updatePopoverContent();
                }
            });
        });
        // Per-row pause / resume / retry. No need to refresh the popover body
        // here — handleUserActionClick mutates file.status and patchFileRow
        // takes care of the in-place patch (button swap + status pill swap),
        // so the row stays put and the click registered on the button doesn't
        // get torn out from under the user.
        root.querySelectorAll('[data-action="row-action"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = (btn as HTMLElement).dataset.fileId;
                if (id) this.handleUserActionClick(id);
            });
        });
    }

    /**
     * Two-step X click — give the user a chance to recover from an
     * accidental click on an in-progress upload:
     *   - `uploading` → cancelFile (abort + status flips to `cancelled`,
     *      row stays in the list with the Retry button available).
     *   - everything else → removeFile (drop from the list, fire
     *      file-removed / file-deleted as appropriate).
     *
     * Apps that want single-click removal everywhere can listen to
     * `file-removed` / `file-deleted` and bypass the two-step UX by
     * calling `removeFile(id)` directly from their own click handler.
     */
    private handleUserRemoveClick(id: string): void {
        const file = this.files.find(f => f.id === id);
        if (!file) return;
        if (file.status === 'uploading') {
            this.cancelFile(id);
        } else {
            this.removeFile(id);
        }
    }

    /**
     * Patch a single file row in-place — in the main list (or files-inside
     * container) and in the open popover, if any. Hot path on every upload
     * tick, so we surgically update the bar fill / progress text / status
     * pill instead of rebuilding the row's DOM. Otherwise the X remove
     * button would be destroyed and re-created on every tick and clicks
     * would be swallowed (same problem the overall progress strip had).
     *
     * Custom renderers (renderFileItemCallback) opt out of in-place
     * patching — we can't introspect their DOM shape, so we fall back to
     * replaceWith and let the consumer eat the click-flicker tradeoff.
     */
    private patchFileRow(file: FileState): void {
        const { listAppearance } = resolveDisplayConfig(this.config);
        const hasCustomRenderer = this.isStructuralMode() && !!this.config.renderFileItemCallback;
        const index = this.files.indexOf(file);

        // Element-returning row callback opts in to the event-driven
        // update model — framework dispatches `file-row-update` on the
        // cached element instead of re-rendering. Wrapper callback
        // sacrifices identity (rows go through outerHTML), so this only
        // engages when wrapper is NOT set.
        const cachedRowEl = this.fileRowElements.get(file.id);

        const targetEl = this.config.isFilesInsideEnabled ? this.filesInsideEl : this.fileListEl;
        if (targetEl) {
            const existing = targetEl.querySelector(`[data-file-id="${file.id}"]`) as HTMLElement | null;
            if (existing) {
                // Capture status BEFORE the patch so we can detect a
                // complete-boundary crossing for the (delayed) reorder.
                const prevStatus = existing.dataset.status;

                if (cachedRowEl && existing === cachedRowEl) {
                    // Event-driven update: hand control to the consumer
                    // via a CustomEvent on the row itself. Bubbles +
                    // composed so listeners on the store element (or
                    // anywhere above) can also observe.
                    cachedRowEl.dispatchEvent(new CustomEvent('file-row-update', {
                        detail: { file },
                        bubbles: true,
                        composed: true
                    }));
                } else if (hasCustomRenderer) {
                    const next = this.htmlToElement(this.renderFileItem(file, index, false));
                    if (next) {
                        existing.replaceWith(next);
                        this.bindListRemoveHandlers(next);
                    }
                } else {
                    this.patchInlineRowInPlace(existing, file, listAppearance);
                }

                // Schedule the visual reorder on a delay (config:
                // reorderCompletedDelay, default 1500ms). The delay
                // helps the user track WHICH file just succeeded —
                // without it, a row sliding away immediately makes the
                // file underneath (with a different upload %) look like
                // it regressed. The popover sort and the cap re-render
                // are both deferred from inside scheduleReorder, so all
                // three surfaces stay synchronised.
                if (this.config.isReorderCompletedEnabled &&
                    prevStatus !== file.status &&
                    (prevStatus === 'complete' || file.status === 'complete')) {
                    this.scheduleReorder(file.id, file.status === 'complete');
                }
            }

            // Rolling appearance: the row in the DOM is the "front" file.
            // When any file's status changes, the front candidate may
            // shift (e.g. front uploading → complete, next uploading
            // becomes the new front; or a pending file behind the
            // scenes flips to uploading and overtakes a paused front).
            // Cheap to check: just compare the stored front-id against
            // getFrontFile(). Re-render only when they actually diverge.
            if (listAppearance === 'rolling') {
                const currentFrontEl = targetEl.querySelector('.dz__rolling__current') as HTMLElement | null;
                const desiredFront = this.getFrontFile();
                if (desiredFront && currentFrontEl?.dataset.frontId !== desiredFront.id) {
                    this.renderFileList();
                }
            }
        }

        if (this.popover) {
            const existingRow = this.popover.querySelector(`tr[data-file-id="${file.id}"]`) as HTMLTableRowElement | null;
            if (existingRow) {
                if (hasCustomRenderer) {
                    const next = this.htmlToElement(this.renderCompactItem(file));
                    if (next) {
                        existingRow.replaceWith(next);
                        this.bindPopoverRemoveHandlers(next);
                    }
                } else {
                    this.patchPopoverRowInPlace(existingRow, file);
                }
            }
            // Patch the footer in place — the totals don't change per tick,
            // but the embedded overall-progress strip does (and its action
            // buttons must NOT be re-created on every tick or they become
            // unclickable).
            this.refreshPopoverFooter(false);
        }

        // Aggregate progress strip under the inline list also reflects per-file
        // ticks. updateSummary() handles add/remove churn; this is the
        // hot-path entry point for upload progress.
        this.updateOverallProgress();
    }

    /**
     * In-place row patch for the popover. Updates the progress bar fill,
     * progress text, status pill (text + modifier class), uploading-animation
     * class on the row, and the remove button's hidden state. Everything
     * else — icon, filename, size, the remove button itself — stays put so
     * clicks land cleanly.
     */
    private patchPopoverRowInPlace(row: HTMLTableRowElement, file: FileState): void {
        // Track previous status for downstream observers. The reorder
        // move itself isn't triggered from here anymore — it's deferred
        // through scheduleReorder (called by patchFileRow's inline-list
        // branch) so the popover stays synchronised with the inline
        // list's delay window. reorderPopoverRows is invoked from the
        // timer's apply() callback.
        row.dataset.status = file.status;

        row.classList.toggle('dz__popover__row--uploading', file.status === 'uploading');

        const fill = row.querySelector('.dz__popover__progress-fill') as HTMLElement | null;
        if (fill) fill.style.width = `${file.progress}%`;

        const progressText = row.querySelector('.dz__popover__progress-text');
        if (progressText) progressText.textContent = `${file.progress.toFixed(1)}%`;

        const statusEl = row.querySelector('.dz__popover__status') as HTMLElement | null;
        if (statusEl && statusEl.dataset.status !== file.status) {
            statusEl.dataset.status = file.status;
            statusEl.className = `dz__popover__status dz__popover__status--${file.status}`;
            statusEl.title = STATUS_LABELS[file.status];
            statusEl.setAttribute('aria-label', `Status: ${STATUS_LABELS[file.status]}`);
            statusEl.innerHTML = STATUS_ICONS[file.status];
        }

        this.patchActionButton(
            row.querySelector('.dz__popover__row-action'),
            file,
            'dz__popover__row-action'
        );

        this.syncRemoveButtonHiddenState(
            row.querySelector('.dz__popover__remove'),
            file,
            'dz__popover__remove--hidden'
        );
    }

    /**
     * Resync the popover tbody's row order against getOrderedFiles(). Only
     * called when a row crosses the complete-incomplete boundary (and the
     * reorder toggle is on), so this isn't a hot path. Appending an element
     * already in the DOM moves it in place, so a stable single pass over
     * the desired order is sufficient.
     */
    private reorderPopoverRows(): void {
        if (!this.popover) return;
        const tbody = this.popover.querySelector('.dz__popover__table tbody') as HTMLTableSectionElement | null;
        if (!tbody) return;
        for (const f of this.getOrderedFiles()) {
            const tr = tbody.querySelector(`tr[data-file-id="${f.id}"]`) as HTMLTableRowElement | null;
            if (tr) tbody.appendChild(tr);
        }
    }

    /**
     * In-place row patch for inline lists (list / detailed / grid / badges).
     * Most of these modes don't render progress, so the patch is light:
     *   - badges: swap the status modifier class on the badge wrapper
     *   - grid:  swap the placeholder out for an <img> when previewUrl
     *            arrives (one-shot transition)
     *   - all:   sync the remove button's hidden state
     */
    private patchInlineRowInPlace(row: HTMLElement, file: FileState, appearance: ListAppearance): void {
        // Row-level data-status drives state-coloured progress bars (and any
        // future per-row state styling) via CSS attribute selectors.
        if (row.dataset.status !== file.status) {
            row.dataset.status = file.status;
        }

        if (appearance === 'badges') {
            // Badge wrapper carries the status modifier — recolors the
            // border via CSS. Pending status has no modifier class.
            row.className = file.status !== 'pending'
                ? `dz__badge dz__badge--${file.status}`
                : 'dz__badge';

            const statusEl = row.querySelector('.dz__badge-status') as HTMLElement | null;
            if (statusEl && statusEl.dataset.status !== file.status) {
                statusEl.dataset.status = file.status;
                statusEl.className = `dz__badge-status dz__badge-status--${file.status}`;
                statusEl.title = STATUS_LABELS[file.status];
                statusEl.setAttribute('aria-label', `Status: ${STATUS_LABELS[file.status]}`);
                statusEl.innerHTML = STATUS_ICONS[file.status];
            }

            this.patchActionButton(
                row.querySelector('.dz__badge-action'),
                file,
                'dz__badge-action'
            );
        }

        // list / detailed / rolling all use the same `.dz__file-item--*`
        // shape (rolling reuses renderListItem internally), so they share
        // the same patch path: progress fill width, percent text, status
        // pill, action button.
        if (appearance === 'list' || appearance === 'detailed' || appearance === 'rolling') {
            const fill = row.querySelector('.dz__file-item__progress-fill') as HTMLElement | null;
            if (fill) fill.style.width = `${file.progress}%`;

            const pct = row.querySelector('.dz__file-item__progress-text');
            if (pct) pct.textContent = `${file.progress.toFixed(1)}%`;

            const statusEl = row.querySelector('.dz__file-item__status') as HTMLElement | null;
            if (statusEl && statusEl.dataset.status !== file.status) {
                statusEl.dataset.status = file.status;
                statusEl.className = `dz__file-item__status dz__file-item__status--${file.status}`;
                statusEl.title = STATUS_LABELS[file.status];
                statusEl.setAttribute('aria-label', `Status: ${STATUS_LABELS[file.status]}`);
                statusEl.innerHTML = STATUS_ICONS[file.status];
            }

            this.patchActionButton(
                row.querySelector('.dz__file-item__action'),
                file,
                'dz__file-item__action'
            );
        }

        if (appearance === 'grid') {
            // Grid tiles get a bottom-edge progress bar and a corner status pill.
            const fill = row.querySelector('.dz__preview-item__progress-fill') as HTMLElement | null;
            if (fill) fill.style.width = `${file.progress}%`;

            const statusEl = row.querySelector('.dz__preview-item__status') as HTMLElement | null;
            if (statusEl && statusEl.dataset.status !== file.status) {
                statusEl.dataset.status = file.status;
                statusEl.className = `dz__preview-item__status dz__preview-item__status--${file.status}`;
                statusEl.title = STATUS_LABELS[file.status];
                statusEl.setAttribute('aria-label', `Status: ${STATUS_LABELS[file.status]}`);
                statusEl.innerHTML = STATUS_ICONS[file.status];
            }

            this.patchActionButton(
                row.querySelector('.dz__preview-item__action'),
                file,
                'dz__preview-item__action'
            );

            // One-shot placeholder → <img> swap when previewUrl arrives.
            if (file.previewUrl) {
                const placeholder = row.querySelector('.dz__preview-item__placeholder');
                if (placeholder) {
                    const img = document.createElement('img');
                    img.src = file.previewUrl;
                    img.alt = file.name;
                    img.className = 'dz__preview-item__image';
                    placeholder.replaceWith(img);
                    row.classList.add('dz__preview-item--image');
                }
            }
        }

        const removeSelector = appearance === 'badges'
            ? '.dz__badge-remove'
            : appearance === 'grid'
                ? '.dz__preview-item__remove'
                : '.dz__file-item__remove';
        const hiddenClass = removeSelector.slice(1) + '--hidden';
        this.syncRemoveButtonHiddenState(
            row.querySelector(removeSelector),
            file,
            hiddenClass
        );
    }

    /** Toggle the `--hidden` modifier on a per-row remove button plus the
     *  matching aria/tabindex attrs. Shared across all the patcher
     *  variants so the rules for hiding stay in one place. */
    private syncRemoveButtonHiddenState(
        btn: Element | null,
        file: FileState,
        hiddenClass: string
    ): void {
        if (!btn) return;
        const hidden = !this.isFileUserRemovable(file);
        btn.classList.toggle(hiddenClass, hidden);
        if (hidden) {
            btn.setAttribute('tabindex', '-1');
            btn.setAttribute('aria-hidden', 'true');
        } else {
            btn.removeAttribute('tabindex');
            btn.removeAttribute('aria-hidden');
        }
    }

    private renderFileList(): void {
        // Determine target element (filesInsideEl or fileListEl)
        const targetEl = this.config.isFilesInsideEnabled ? this.filesInsideEl : this.fileListEl;
        if (!targetEl) return;

        if (this.files.length === 0) {
            this.fileRowElements.clear();
            targetEl.innerHTML = this.config.isFilesInsideEnabled ? '' : `<div class="dz__empty">${escapeHtml(this.config.emptyMessage || DEFAULT_CONFIG.emptyMessage)}</div>`;
            return;
        }

        const { listAppearance } = resolveDisplayConfig(this.config);

        // Rolling appearance is a single-row "front file" view + a queue
        // button that opens the popover. Bypasses the visible-files
        // slice / show-more toggle entirely — only one row is ever in
        // the DOM at a time.
        if (listAppearance === 'rolling') {
            this.renderRollingList(targetEl);
            return;
        }

        const visible = this.getVisibleFiles();
        const structural = this.isStructuralMode();
        const wrapperCb = structural ? this.config.renderListWrapperCallback : null;
        const toggle = this.renderToggleButton(listAppearance);

        // Build the row nodes — strings for the default path, HTMLElements
        // when the consumer's renderFileItemCallback returns one. Element
        // identity is preserved across re-renders via fileRowElements so
        // listeners survive and `file-row-update` events stay meaningful.
        type RowNode = { file: FileState; node: string | HTMLElement };
        const rows: RowNode[] = visible.map((file, index) => {
            const cached = this.fileRowElements.get(file.id);
            if (cached) return { file, node: cached };
            const rendered = this.renderFileItemForList(file, index);
            if (rendered instanceof HTMLElement) {
                this.fileRowElements.set(file.id, rendered);
            }
            return { file, node: rendered };
        });

        // Prune cached elements for files no longer visible (removed, or
        // filtered out by show-more cap). They're gone from the DOM
        // anyway after the upcoming replaceChildren / innerHTML.
        const visibleIds = new Set(visible.map(f => f.id));
        for (const id of this.fileRowElements.keys()) {
            if (!visibleIds.has(id)) this.fileRowElements.delete(id);
        }

        const hasElementRow = rows.some(r => r.node instanceof HTMLElement);

        if (wrapperCb) {
            // Wrapper callback path. Element identity is sacrificed here
            // because the wrapper signature is string-based — documented.
            const itemsHtml = rows.map(r => typeof r.node === 'string' ? r.node : r.node.outerHTML).join('');
            const wrapped = wrapperCb(itemsHtml, visible);
            if (typeof wrapped === 'string') {
                targetEl.innerHTML = wrapped + toggle;
            } else {
                targetEl.replaceChildren(wrapped);
                if (toggle) targetEl.insertAdjacentHTML('beforeend', toggle);
            }
        } else if (hasElementRow) {
            // Element-preserving path — no wrapper callback in play, but
            // at least one row is an HTMLElement. Use replaceChildren so
            // we keep the same DOM nodes (and their listeners) across
            // re-renders.
            targetEl.replaceChildren();
            for (const r of rows) {
                if (typeof r.node === 'string') {
                    targetEl.insertAdjacentHTML('beforeend', r.node);
                } else {
                    targetEl.appendChild(r.node);
                }
            }
            if (toggle) targetEl.insertAdjacentHTML('beforeend', toggle);
        } else {
            // Default fast path — all rows are strings, single innerHTML.
            const items = rows.map(r => r.node as string).join('');
            targetEl.innerHTML = items + toggle;
        }

        this.bindListRemoveHandlers(targetEl);
        this.bindToggleHandler(targetEl);

        uiLogger.debug('File list rendered', {
            count: this.files.length,
            visible: visible.length,
            filesInside: this.config.isFilesInsideEnabled
        });
    }

    /**
     * Like `renderFileItem(file, i, false)` but preserves an
     * HTMLElement return from `renderFileItemCallback`. The popover and
     * the rolling path keep using `renderFileItem` (string-only) because
     * those layouts don't benefit from element identity — they re-render
     * the front row / table-row anyway.
     */
    private renderFileItemForList(file: FileState, index: number): string | HTMLElement {
        const { listAppearance } = resolveDisplayConfig(this.config);
        if (this.isStructuralMode() && this.config.renderFileItemCallback) {
            const displayMode = this.config.displayMode ?? this.deriveLegacyDisplayMode(listAppearance);
            const context: FileItemRenderContext = { index, displayMode, isInPopover: false };
            return this.config.renderFileItemCallback(file, context);
        }
        // Fall through to the string-only path — same selection logic as
        // renderFileItem, popover branch removed.
        switch (listAppearance) {
            case 'grid':     return this.renderGridItem(file);
            case 'detailed': return this.renderDetailedItem(file);
            case 'badges':   return this.renderBadgeItem(file);
            case 'popover':  return this.renderCompactItem(file);
            case 'none':     return '';
            case 'list':
            default:         return this.renderListItem(file);
        }
    }

    /**
     * Pick the file currently occupying the "front" slot in the rolling
     * appearance. Priority: first uploading → first pending → first
     * paused/error/cancelled (needs attention) → last completed (so the
     * user sees the result for a beat before the slot empties). Returns
     * null only when `this.files` is empty.
     */
    private getFrontFile(): FileState | null {
        if (this.files.length === 0) return null;
        // Active first — what's literally in flight RIGHT NOW.
        const uploading = this.files.find(f => f.status === 'uploading');
        if (uploading) return uploading;
        // Queued next — what the worker pool will pick up.
        const pending = this.files.find(f => f.status === 'pending');
        if (pending) return pending;
        // Stalled — needs the user's attention before anything else can
        // happen.
        const needsAction = this.files.find(f =>
            f.status === 'paused' || f.status === 'error' || f.status === 'cancelled'
        );
        if (needsAction) return needsAction;
        // Everything finished — show the most recent completion so the
        // slot doesn't suddenly go empty at 100%.
        for (let i = this.files.length - 1; i >= 0; i--) {
            if (this.files[i].status === 'complete') return this.files[i];
        }
        return this.files[0];
    }

    /**
     * Render the rolling appearance — a stable container that acts as the
     * popover anchor. Inside, the "current" front-file row overlaps with
     * any outgoing one in the same grid cell so the rotation keyframes
     * (slide-in / horizontal / vertical) can play simultaneously without
     * shifting the container. The queue button floats in the container's
     * top-right corner as a count badge.
     *
     * Same call serves both first render and front-changed re-render —
     * previousCurrent is detected from the DOM. When the front file is
     * unchanged we leave the inner row alone (patchInlineRowInPlace
     * handles per-tick progress / status churn elsewhere) and just refresh
     * the queue count.
     */
    private renderRollingList(targetEl: HTMLElement): void {
        const rotation = (this.config.rollingRotation ?? 'slide-in') as RollingRotation;
        targetEl.dataset.rotation = rotation;

        // Status-surface body callback: lets users own the entire rolling
        // container (no animation slots, no queue badge). Skipped when
        // returns null (library default). `false` hides the rolling block.
        const args = buildStatusSurfaceArgs(this.files, this);
        const bodyResult = this.isStructuralMode() && this.config.renderRollingBodyCallback
            ? this.config.renderRollingBodyCallback(args)
            : null;
        const { current, previous } = this.rollingSurface.applyBody(targetEl, bodyResult);
        if (current === 'hidden') return;
        if (current === 'custom') {
            targetEl.hidden = false;
            // Slot memoization is stale — custom body wiped the default slots.
            this.rollingSurface.resetSlots();
            return;
        }

        // current === 'default'. If we were previously in custom-body mode the
        // targetEl still has the custom content; clear it before the default
        // path repopulates.
        if (previous === 'custom') {
            targetEl.innerHTML = '';
        }
        targetEl.hidden = false;

        const front = this.getFrontFile();
        if (!front) {
            targetEl.innerHTML = '';
            this.rollingSurface.resetSlots();
            return;
        }

        const queueCount = this.files.length;
        const showQueueBtn = queueCount > 1;

        // Find the "settled" current slot — not one already animating out.
        // This is what we compare against to decide whether the front
        // file actually changed.
        const previousCurrent = targetEl.querySelector(
            '.dz__rolling__current:not(.dz__rolling__current--leaving)'
        ) as HTMLElement | null;
        const previousFrontId = previousCurrent?.dataset.frontId;

        if (previousCurrent && previousFrontId === front.id) {
            // Same front, nothing to animate. Per-row tick updates land via
            // patchInlineRowInPlace elsewhere; here we just keep the badge
            // count fresh + refresh slot callbacks (so a re-render driven
            // by file-status-changed picks up the new state).
            this.applyRollingSlots(previousCurrent, args);
            this.updateRollingQueueButton(targetEl, queueCount, showQueueBtn);
            return;
        }

        // Build the new current slot.
        const newCurrentEl = document.createElement('div');
        newCurrentEl.className = 'dz__rolling__current';
        newCurrentEl.dataset.frontId = front.id;
        newCurrentEl.innerHTML = this.renderListItem(front);
        // After the row HTML is in place, swap the file-info / progress
        // slot subtrees if the user supplied callbacks. Reset memoization
        // because this is a fresh slot — prev snapshots came from the
        // OUTGOING row's subtrees.
        this.rollingSurface.resetSlots();
        this.applyRollingSlots(newCurrentEl, args);

        if (previousCurrent && rotation !== 'slide-in') {
            // True rotation — the outgoing slot stays mounted so its keyframe
            // can play (translateX/Y out) in parallel with the incoming one.
            // Both share the same grid cell, so they overlap visually.
            previousCurrent.classList.add('dz__rolling__current--leaving');
            targetEl.insertBefore(newCurrentEl, previousCurrent);
            const toRemove = previousCurrent;
            // Slightly longer than the animation so we don't yank the node
            // mid-keyframe; the spare ~150ms is invisible.
            setTimeout(() => { toRemove.remove(); }, 500);
        } else if (previousCurrent) {
            // slide-in: snap-replace the old slot; the new slot's keyframe
            // is the only motion.
            previousCurrent.replaceWith(newCurrentEl);
        } else {
            // First render. Insert at the top; the queue badge (added below
            // / reused) sits after it but is absolute-positioned, so DOM
            // order is purely cosmetic.
            targetEl.insertBefore(newCurrentEl, targetEl.firstChild);
        }

        this.bindListRemoveHandlers(newCurrentEl);
        this.updateRollingQueueButton(targetEl, queueCount, showQueueBtn);
    }

    /**
     * Apply the rolling file-info + progress callbacks (if set) into the
     * row inside `currentEl`. The row template's existing
     * `.dz__file-item__name` span hosts the file-info slot; the
     * `.dz__file-item__progress` block hosts the progress slot. Each is
     * routed through the shared memoizer so cached element returns
     * (e.g. WAAPI spinners) survive across ticks.
     *
     * When a callback isn't set or returns null, the corresponding slot
     * keeps the polished default contents that `renderListItem` already
     * generated — no DOM write.
     */
    private applyRollingSlots(currentEl: HTMLElement, args: StatusSurfaceArgs): void {
        // File-info slot — replace `.dz__file-item__name` with the callback's
        // content. No fallback: a null result leaves the row template's
        // pre-rendered name span alone (covers the common case where users
        // only want to customize progress).
        const structural = this.isStructuralMode();
        const fileInfoCb = structural ? this.config.renderRollingFileInfoCallback : null;
        const fileInfoSlot = currentEl.querySelector<HTMLElement>('.dz__file-item__name');
        if (fileInfoCb && fileInfoSlot) {
            this.rollingSurface.applyFileInfo(fileInfoSlot, fileInfoCb(args));
        }

        // Progress slot — same pattern. Default is the bar + percent text
        // that came out of renderListItem.
        const progressCb = structural ? this.config.renderRollingProgressCallback : null;
        const progressSlot = currentEl.querySelector<HTMLElement>('.dz__file-item__progress');
        if (progressCb && progressSlot) {
            this.rollingSurface.applyProgress(progressSlot, progressCb(args));
        }
    }

    /**
     * Ensure the rolling queue badge exists inside `targetEl` and reflects
     * the current file count. Created once and reused across re-renders so
     * its click handler isn't repeatedly rebound (and so the badge doesn't
     * flicker during a front-file swap).
     */
    private updateRollingQueueButton(targetEl: HTMLElement, queueCount: number, showQueueBtn: boolean): void {
        let queueBtn = targetEl.querySelector('.dz__rolling__queue') as HTMLButtonElement | null;
        if (!queueBtn) {
            queueBtn = document.createElement('button');
            queueBtn.type = 'button';
            queueBtn.className = 'dz__rolling__queue';
            queueBtn.dataset.action = 'open-queue';
            queueBtn.innerHTML = '<span class="dz__rolling__queue-count"></span>';
            queueBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePopover();
            });
            targetEl.appendChild(queueBtn);
        }
        const countEl = queueBtn.querySelector('.dz__rolling__queue-count');
        if (countEl) countEl.textContent = String(queueCount);
        queueBtn.classList.toggle('dz__rolling__queue--hidden', !showQueueBtn);
        queueBtn.setAttribute('aria-label', `Show full queue (${queueCount} files)`);
        queueBtn.setAttribute('title', `Show all ${queueCount} files`);
    }

    /**
     * Slice `files` to the visible window. When `maxVisibleFiles` is 0/unset,
     * or `showAllList` is true, the full selection is returned. Otherwise only
     * the first `maxVisibleFiles` files are rendered and the rest are hidden
     * behind the "Show N more" toggle.
     */
    private getVisibleFiles(): FileState[] {
        const ordered = this.getOrderedFiles();
        const cap = this.config.maxVisibleFiles || 0;
        if (cap <= 0 || this.showAllList) return ordered;
        return ordered.slice(0, cap);
    }

    /**
     * Render the trailing "Show N more" / "Show less" toggle. The visual
     * differs by list appearance:
     *   - badges       — compact pill matching the badge frame ("+5" / "−")
     *   - everything else — full-width text button under the list
     * Returns "" when no toggle is needed (no cap, or selection fits).
     */
    private renderToggleButton(listAppearance: ListAppearance): string {
        const cap = this.config.maxVisibleFiles || 0;
        if (cap <= 0 || this.files.length <= cap) return '';

        const isBadges = listAppearance === 'badges';

        if (this.showAllList) {
            return isBadges
                ? `<button type="button" class="dz__badge dz__badge--more" data-action="toggle-visible" aria-label="Show fewer">−</button>`
                : `<button type="button" class="dz__show-more" data-action="toggle-visible">Show less</button>`;
        }

        const hidden = this.files.length - cap;
        return isBadges
            ? `<button type="button" class="dz__badge dz__badge--more" data-action="toggle-visible" aria-label="Show ${hidden} more">+${hidden}</button>`
            : `<button type="button" class="dz__show-more" data-action="toggle-visible">Show ${hidden} more</button>`;
    }

    /** Attach the "Show more / Show less" click handler within a subtree.
     *  Only used by the inline list — the popover scrolls internally, so its
     *  body is never sliced. */
    private bindToggleHandler(root: ParentNode): void {
        root.querySelectorAll('[data-action="toggle-visible"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showAllList = !this.showAllList;
                this.renderFileList();
            });
        });
    }

    private renderFileItem(file: FileState, index: number, isInPopover: boolean): string {
        const { listAppearance } = resolveDisplayConfig(this.config);

        // The custom renderer keeps its legacy `displayMode` field for backward
        // compatibility — populated from the shorthand if set, otherwise
        // derived from listAppearance.
        if (this.isStructuralMode() && this.config.renderFileItemCallback) {
            const displayMode = this.config.displayMode ?? this.deriveLegacyDisplayMode(listAppearance);
            const context: FileItemRenderContext = { index, displayMode, isInPopover };
            const result = this.config.renderFileItemCallback(file, context);
            return typeof result === 'string' ? result : result.outerHTML;
        }

        // The popover always uses the compact (table-row) item shape regardless
        // of what the inline list looks like — that's its dedicated layout.
        if (isInPopover) return this.renderCompactItem(file);

        switch (listAppearance) {
            case 'grid':     return this.renderGridItem(file);
            case 'detailed': return this.renderDetailedItem(file);
            case 'badges':   return this.renderBadgeItem(file);
            case 'popover':  return this.renderCompactItem(file);
            case 'none':     return '';
            case 'list':
            default:         return this.renderListItem(file);
        }
    }

    /**
     * Resolve the "use thumbnails" flag with per-mode auto-default. The grid
     * appearance kept image previews even before the attribute existed, so
     * leaving show-thumbnails unset there still produces thumbnails. Every
     * other appearance defaults to icons so adding the attribute to the family
     * doesn't quietly change the look of existing badge / detailed lists.
     */
    private shouldShowThumbnails(listAppearance: ListAppearance): boolean {
        if (this.config.isShowThumbnailsEnabled !== undefined) {
            return this.config.isShowThumbnailsEnabled;
        }
        return listAppearance === 'grid';
    }

    /** Reverse-map listAppearance → DisplayMode for backward-compatible callbacks. */
    private deriveLegacyDisplayMode(listAppearance: ListAppearance): DisplayMode {
        switch (listAppearance) {
            case 'detailed': return 'detailed';
            case 'grid':     return 'grid';
            case 'popover':  return 'compact';
            default:         return 'list';
        }
    }

    /**
     * Whether the remove button should be rendered as interactive for this
     * file. Returns `false` when the file finished uploading AND the caller
     * opted out of allowing user-driven deletion of completed files; in that
     * case the renderers emit the button anyway (so column / cell widths
     * stay reserved) but stamp a `--hidden` modifier that drops it from the
     * tab order and hides it via `visibility: hidden`.
     */
    private isFileUserRemovable(file: FileState): boolean {
        if (file.status !== 'complete') return true;
        return this.config.isUploadedFileDeletable !== false;
    }

    /** In-place patch the action button as file.status transitions
     *  (pending→uploading→paused→…→complete). Gated on `data-row-action`
     *  so clicks on the live button aren't disrupted between transitions. */
    private patchActionButton(btn: HTMLElement | null, file: FileState, baseClass: string): void {
        if (!btn) return;
        const action = actionForStatus(file.status);
        const current = btn.dataset.rowAction || '';
        const target = action ?? '';
        if (current === target) return;

        btn.dataset.rowAction = target;
        const hidden = !action;
        btn.className = hidden ? `${baseClass} ${baseClass}--hidden` : baseClass;
        btn.innerHTML = action ? ACTION_ICONS[action] : '';

        if (action) {
            btn.setAttribute('aria-label', `${ACTION_LABELS[action]} ${file.name}`);
            btn.title = ACTION_LABELS[action];
            btn.removeAttribute('tabindex');
            btn.removeAttribute('aria-hidden');
        } else {
            btn.setAttribute('aria-label', '');
            btn.title = '';
            btn.tabIndex = -1;
            btn.setAttribute('aria-hidden', 'true');
        }
    }

    /** Two-step action click — uploading→pauseFile, paused→resumeFile,
     *  error→retryFile. Other statuses are no-ops (the button is rendered
     *  inert via `--hidden`). */
    private handleUserActionClick(id: string): void {
        const file = this.files.find(f => f.id === id);
        if (!file) return;
        const action = actionForStatus(file.status);
        if (action === 'pause')  this.pauseFile(id);
        if (action === 'resume') this.resumeFile(id);
        if (action === 'retry')  this.retryFile(id);
    }

    /**
     * Pack per-row knobs for the shared template module. The shared module
     * has no view of the store's config — `isReorderEligible` /
     * `isFileUserRemovable` / `shouldShowThumbnails` live here because they
     * read config-driven state (reorder mode, post-upload deletion flag,
     * thumbnail policy per appearance). We compute the booleans here and
     * hand them to the template as plain data.
     */
    private rowOpts(file: FileState, appearance: ListAppearance): RowTemplateOptions {
        return {
            reorderEligible: this.isReorderEligible(file),
            removable: this.isFileUserRemovable(file),
            useThumbnail: this.shouldShowThumbnails(appearance)
        };
    }

    private renderListItem(file: FileState): string {
        return RowTemplate.renderListItem(file, this.rowOpts(file, 'list'));
    }

    private renderDetailedItem(file: FileState): string {
        return RowTemplate.renderDetailedItem(file, this.rowOpts(file, 'detailed'));
    }

    private renderGridItem(file: FileState): string {
        return RowTemplate.renderGridItem(file, this.rowOpts(file, 'grid'));
    }

    private renderBadgeItem(file: FileState): string {
        return RowTemplate.renderBadgeItem(file, this.rowOpts(file, 'badges'));
    }

    private renderCompactItem(file: FileState): string {
        const useThumbnail = this.shouldShowThumbnails('popover');
        const inner = RowTemplate.renderPlaceholderInner(file, useThumbnail);
        const statusClass = `dz__popover__status--${file.status}`;
        const isUploading = file.status === 'uploading';
        const removable = this.isFileUserRemovable(file);

        // X button is ALWAYS rendered — column width stays stable as files
        // transition pending → uploading → complete and the button doesn't
        // pop in/out. When isUploadedFileDeletable=false and the file has
        // finished uploading, removeButtonAttrs() stamps a `--hidden`
        // modifier (visibility: hidden + tabindex=-1) so the slot stays
        // reserved but the user can't click it; removeFile(id) still works
        // programmatically.
        return `
            <tr class="dz__popover__row ${isUploading ? 'dz__popover__row--uploading' : ''}" data-file-id="${file.id}">
                <td class="dz__popover__cell dz__popover__cell--icon"><span class="dz__popover__placeholder">${inner}</span></td>
                <td class="dz__popover__cell dz__popover__cell--name">${escapeHtml(file.name)}</td>
                <td class="dz__popover__cell dz__popover__cell--size">${formatFileSize(file.size)}</td>
                <td class="dz__popover__cell dz__popover__cell--progress">
                    <div class="dz__popover__progress-bar">
                        <div class="dz__popover__progress-fill" style="width: ${file.progress}%"></div>
                    </div>
                    <span class="dz__popover__progress-text">${file.progress.toFixed(1)}%</span>
                </td>
                <td class="dz__popover__cell dz__popover__cell--action">
                    ${RowTemplate.renderRowActionButton(file, 'dz__popover__row-action')}
                </td>
                <td class="dz__popover__cell dz__popover__cell--status">
                    <span class="dz__popover__status ${statusClass}" title="${STATUS_LABELS[file.status]}" aria-label="Status: ${STATUS_LABELS[file.status]}" data-status="${file.status}">${STATUS_ICONS[file.status]}</span>
                </td>
                <td class="dz__popover__cell dz__popover__cell--actions">
                    <button type="button" ${RowTemplate.removeButtonAttrs(file, 'dz__popover__remove', removable)}></button>
                </td>
            </tr>
        `;
    }

    /**
     * Render the icon shown in the popover-summary line. Paperclip when the
     * selection hasn't seen any upload activity yet (still purely pending),
     * otherwise the aggregate status icon — same Lucide glyph + colour rules
     * as the per-row status pill, so the summary reads as "uploading /
     * paused / errored / done" at a glance even when the popover is closed.
     */
    private renderSummaryIcon(): string {
        const overall = this.getOverallProgress();
        if (!overall.hasActivity) {
            return '<span class="dz__summary__icon" data-status="pending">📎</span>';
        }
        const s = overall.aggregateStatus;
        return `<span class="dz__summary__icon dz__summary__icon--${s}" data-status="${s}" aria-label="Status: ${STATUS_LABELS[s]}">${STATUS_ICONS[s]}</span>`;
    }

    /**
     * Per-tick patch for the summary-line icon. Called from
     * updateOverallProgress so the icon swaps from paperclip → spinner →
     * check / error / pause without rebuilding the summary line (which
     * would tear down its click handler).
     */
    private patchSummaryIcon(): void {
        if (!this.summaryEl) return;
        const iconEl = this.summaryEl.querySelector('.dz__summary__icon') as HTMLElement | null;
        if (!iconEl) return;
        const overall = this.getOverallProgress();
        const nextStatus = overall.hasActivity ? overall.aggregateStatus : 'pending';
        if (iconEl.dataset.status === nextStatus) return;
        iconEl.outerHTML = this.renderSummaryIcon();
    }

    private updateSummary(): void {
        // The button and minimal selectors each carry a top-right count badge
        // — neither is tied to the popover-summary surface, so refresh both
        // here on every files change regardless of whether a summary line is
        // rendered.
        this.updateSelectorBadge();

        // The aggregate progress strip lives outside the file list and the
        // popover, so it has to be refreshed here too — both for the initial
        // empty-state render and so removing the last in-flight file collapses
        // the strip.
        this.updateOverallProgress();

        if (!this.summaryEl) return;

        if (this.files.length === 0) {
            this.summaryEl.innerHTML = '';
            return;
        }

        let content: string;
        if (this.isStructuralMode() && this.config.renderSummaryCallback) {
            const result = this.config.renderSummaryCallback(this.files);
            content = typeof result === 'string' ? result : result.outerHTML;
        } else {
            const totalSize = this.files.reduce((sum, f) => sum + f.size, 0);
            const template = this.config.summaryTemplate || DEFAULT_CONFIG.summaryTemplate;
            const text = template
                .replace('{count}', String(this.files.length))
                .replace('{size}', formatFileSize(totalSize));

            content = `
                <div class="dz__summary__line" tabindex="0" role="button" aria-label="Click to view files">
                    ${this.renderSummaryIcon()}
                    <span class="dz__summary__text">${escapeHtml(text)}</span>
                </div>
            `;
        }

        this.summaryEl.innerHTML = content;

        // Add click handler for popover
        const summaryLine = this.summaryEl.querySelector('.dz__summary__line');
        if (summaryLine) {
            summaryLine.addEventListener('click', () => this.togglePopover());
            summaryLine.addEventListener('keydown', (e) => {
                if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
                    e.preventDefault();
                    this.togglePopover();
                }
            });
        }
    }

    /**
     * Patch the count badge on the active selector (button or minimal) in
     * place. Each selector renders its badge conditionally inside
     * renderSelector() at component-build time (count = 0 means no badge in
     * the DOM), so the badge has to be created / removed / updated on every
     * files change rather than re-rendering the whole selector (which would
     * trash the hidden <input> and its listeners).
     */
    private updateSelectorBadge(): void {
        if (!this.dropzoneEl) return;

        const count = this.files.length;
        // Same aggregate-state priority as the overall progress strip — so
        // a hidden errored file shows as red on the button badge even when
        // the user can't see the row itself. hasActivity is the gate: a
        // freshly-added selection (all pending, nothing started yet) keeps
        // the badge in its neutral state.
        const { aggregateStatus, hasActivity, completedCount } = this.getOverallProgress();
        // "X/Y" makes sense while uploads are mid-flight or stalled (paused
        // / errored); once everything's complete the X==Y readout is
        // redundant, so collapse back to a single count.
        const showProgress = hasActivity && aggregateStatus !== 'complete';
        const text = showProgress ? `${completedCount}/${count}` : String(count);

        for (const [hostClass, badgeClass] of [
            ['dz__minimal', 'dz__minimal__badge'],
            ['dz__button',  'dz__button__badge']
        ] as const) {
            const host = this.dropzoneEl.querySelector(`.${hostClass}`);
            if (!host) continue;

            let badge = host.querySelector(`.${badgeClass}`) as HTMLElement | null;

            if (count > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = badgeClass;
                    host.appendChild(badge);
                }
                badge.textContent = text;
                // data-status drives the badge's background colour via CSS
                // attribute selectors (see .dz__button__badge[data-status=…]).
                if (hasActivity) badge.dataset.status = aggregateStatus;
                else delete badge.dataset.status;
            } else if (badge) {
                badge.remove();
            }
        }
    }

    // ========================================================================
    // POPOVER (Compact Mode)
    // ========================================================================

    private togglePopover(): void {
        if (this.isPopoverOpen) {
            this.closePopover();
        } else {
            this.openPopover();
        }
    }

    private openPopover(): void {
        if (this.isPopoverOpen) return;

        // The popover needs an anchor element. Prefer the summary line (card +
        // popover combo), but fall back to the selector itself for button /
        // minimal selectors where the selector is the trigger.
        const anchor = this.getPopoverAnchor();
        if (!anchor) return;

        const container = this.config.container || this.element;

        // Create popover
        this.popover = document.createElement('div');
        this.popover.className = this.config.isAutoUploadEnabled === false
            ? 'dz__popover dz__popover--manual-upload'
            : 'dz__popover';

        // Kick off the state-restore asynchronously. Reading is cheap when
        // backed by localStorage (synchronous, just await ms), but the
        // callback flavour may go to the network. Apply width/height once
        // resolved — autoUpdate re-positions on the size change.
        void this.loadDropzoneState().then(state => {
            if (!this.popover || !state) return;
            if (typeof state.popoverWidth === 'number') {
                this.popover.style.width = `${state.popoverWidth}px`;
            }
            if (typeof state.popoverHeight === 'number') {
                this.popover.style.height = `${state.popoverHeight}px`;
            }
        });
        this.popover.innerHTML = `
            <div class="dz__popover__sticky-top">
                <div class="dz__popover__header">
                    <span class="dz__popover__count">${escapeHtml(this.getFileCountLabel())}</span>
                    <div class="dz__popover__actions">
                        ${this.config.isDisabled ? '' : `<button type="button" class="dz__popover__action" data-action="add-more">Add more</button>`}
                        <button type="button" class="dz__popover__action" data-action="clear">Clear all</button>
                    </div>
                </div>
                <div class="dz__popover__limits">${escapeHtml(this.getLimitsHint())}</div>
            </div>
            <div class="dz__popover__body">
                <table class="dz__popover__table">
                    <tbody>
                        ${this.getOrderedFiles().map((f) => this.renderCompactItem(f)).join('')}
                    </tbody>
                </table>
            </div>
            <div class="dz__popover__footer">${this.getFooterContent()}</div>
        `;

        container.appendChild(this.popover);

        // Position popover
        this.positionPopover();

        // Add event handlers
        this.popover.querySelector('[data-action="clear"]')?.addEventListener('click', () => {
            this.clear();
            this.closePopover();
        });

        this.popover.querySelector('[data-action="add-more"]')?.addEventListener('click', () => {
            // Open the native file picker without dismissing the popover. The
            // input lives inside the dropzone (not the popover), so the
            // synthesised click from inputEl.click() would otherwise be picked
            // up as an "outside" click — handleDocumentClick filters this out
            // by also excluding the input element.
            this.inputEl?.click();
        });

        // Fill the (empty) overall-progress container inside the footer.
        // refreshOverallProgress builds the markup and binds the action
        // handlers, so we don't need to call bindOverallProgressHandlers
        // separately here.
        const footerOverall = this.popover.querySelector('.dz__popover__footer .dz__overall-progress') as HTMLElement | null;
        if (footerOverall) this.refreshOverallProgress(footerOverall);

        // Single canonical binder used for every popover X click — initial
        // open, body rebuild, and per-tick patches all converge here so
        // remove behavior stays identical regardless of how the row was
        // rendered.
        this.bindPopoverRemoveHandlers(this.popover);

        // Watch for user-driven resize (CSS `resize: both` handle) and
        // persist the resulting dimensions. ResizeObserver fires on every
        // drag tick; debounce ~250ms so we only write once the user
        // settles. Skipped when persistence is disabled — the observer
        // itself is cheap but the storage round-trip isn't free.
        if (this.getStorageKey() && typeof ResizeObserver !== 'undefined') {
            this.popoverResizeObserver = new ResizeObserver(() => {
                if (this.popoverSaveTimer !== null) clearTimeout(this.popoverSaveTimer);
                this.popoverSaveTimer = window.setTimeout(() => {
                    this.popoverSaveTimer = null;
                    this.flushPopoverSize();
                }, 250);
            });
            this.popoverResizeObserver.observe(this.popover);
        }

        this.isPopoverOpen = true;
        document.addEventListener('click', this.boundHandleDocumentClick);
        document.addEventListener('keydown', this.boundHandleKeyDown);

        uiLogger.debug('Popover opened');
    }

    /**
     * Build the popover's file-count label ("3 files", "1 file"). Used in the
     * header in place of a static "Selected Files" title.
     */
    private getFileCountLabel(): string {
        const n = this.files.length;
        return n === 1 ? '1 file' : `${n} files`;
    }

    /**
     * Compose a one-liner restating accept / max-size / max-files. Shown under
     * the header in the popover where the card's hint isn't visible. Falls back
     * to the caller-configured hintText when set; otherwise auto-derived from
     * validation config.
     */
    private getLimitsHint(): string {
        if (this.config.hintText) return this.config.hintText;

        const parts: string[] = [];
        if (this.config.accept) parts.push(this.config.accept);

        const maxFileSize = this.config.maxFileSize ?? 0;
        const minFileSize = this.config.minFileSize ?? 0;
        const maxTotal = this.config.maxTotalSize ?? 0;
        const maxCount = this.config.maxFileCount ?? 0;
        const minCount = this.config.minFileCount ?? 0;

        if (maxFileSize > 0) parts.push(`max ${formatFileSize(maxFileSize)} each`);
        if (minFileSize > 0) parts.push(`min ${formatFileSize(minFileSize)} each`);

        // Total size cap — show "X left" once there are files so the user knows
        // their remaining headroom. FluentUI does the same.
        if (maxTotal > 0) {
            if (this.files.length > 0) {
                const used = this.files.reduce((sum, f) => sum + f.size, 0);
                const left = Math.max(0, maxTotal - used);
                parts.push(`up to ${formatFileSize(maxTotal)} total · ${formatFileSize(left)} left`);
            } else {
                parts.push(`up to ${formatFileSize(maxTotal)} total`);
            }
        }

        // File-count cap with remaining slots.
        if (maxCount > 0) {
            if (this.files.length > 0) {
                const left = Math.max(0, maxCount - this.files.length);
                parts.push(`up to ${maxCount} files · ${left} left`);
            } else {
                parts.push(`up to ${maxCount} files`);
            }
        }

        if (minCount > 0) parts.push(`at least ${minCount} files`);

        return parts.join(' · ');
    }

    /**
     * Footer content for the popover — overall totals (count + total size),
     * with an aggregate progress strip above when any upload is in flight or
     * already finished. Returns "" when there are no files (the :empty CSS
     * selector then hides the footer entirely).
     */
    private getFooterContent(): string {
        if (this.files.length === 0) return '';
        const totalBytes = this.files.reduce((sum, f) => sum + f.size, 0);
        // Overall progress strip lives inside a `.dz__overall-progress`
        // container so per-tick refreshes can patch it without touching the
        // surrounding totals row. The container starts empty and is filled by
        // refreshOverallProgress() after this markup is mounted.
        return `
            <div class="dz__overall-progress"></div>
            <div class="dz__popover__footer__totals">
                <span class="dz__popover__footer__count">${escapeHtml(this.getFileCountLabel())}</span>
                <span class="dz__popover__footer__bytes">${escapeHtml(formatFileSize(totalBytes))}</span>
            </div>
        `;
    }

    /**
     * In-place refresh of the popover footer. The overall progress strip is
     * delegated to refreshOverallProgress (which preserves action buttons
     * across ticks); the totals row is patched span-by-span. `includeTotals`
     * lets the hot path (progress ticks) skip the totals work, since per-file
     * size doesn't change mid-upload.
     */
    private refreshPopoverFooter(includeTotals: boolean): void {
        if (!this.popover) return;
        const footer = this.popover.querySelector('.dz__popover__footer') as HTMLElement | null;
        if (!footer) return;

        // Empty selection collapses the footer entirely (matches the :empty
        // CSS rule that hides the chrome).
        if (this.files.length === 0) {
            footer.innerHTML = '';
            return;
        }

        // Re-install the structure if the footer was previously empty.
        if (!footer.firstElementChild) {
            footer.innerHTML = this.getFooterContent();
        }

        const inner = footer.querySelector('.dz__overall-progress') as HTMLElement | null;
        if (inner) this.refreshOverallProgress(inner);

        if (includeTotals) {
            const countEl = footer.querySelector('.dz__popover__footer__count');
            if (countEl) countEl.textContent = this.getFileCountLabel();
            const bytesEl = footer.querySelector('.dz__popover__footer__bytes');
            if (bytesEl) {
                const totalBytes = this.files.reduce((s, f) => s + f.size, 0);
                bytesEl.textContent = formatFileSize(totalBytes);
            }
        }
    }

    /**
     * Aggregate upload stats across the current selection. Mirrors FluentUI
     * InputFile's overallProgress: completed files count for their full size,
     * uploading files contribute size × progress%. `hasActivity` is the gate
     * for showing the strip — pure pending selections (nothing uploaded yet)
     * keep the strip hidden so it doesn't appear at 0% before any upload
     * starts.
     *
     * Public so satellite surfaces (`<web-dropzone-progress>`) can read the
     * same aggregate without duplicating the calculation.
     */
    getOverallProgress(): {
        uploadedBytes: number;
        totalBytes: number;
        completedCount: number;
        failedCount: number;
        uploadingCount: number;
        pausedCount: number;
        percent: number;
        hasActivity: boolean;
        aggregateStatus: 'uploading' | 'paused' | 'error' | 'complete';
    } {
        let uploadedBytes = 0;
        let totalBytes = 0;
        let completedCount = 0;
        let failedCount = 0;
        let uploadingCount = 0;
        let pausedCount = 0;

        for (const f of this.files) {
            totalBytes += f.size;
            if (f.status === 'complete') {
                uploadedBytes += f.size;
                completedCount++;
            } else {
                // Every other state contributes whatever progress was last
                // reported. This keeps the overall bar smooth across status
                // transitions — particularly during resume where a file
                // momentarily goes paused → pending → uploading. If only
                // some of those states counted, the overall bar would animate
                // down then back up and the user sees a "jump back".
                uploadedBytes += Math.floor(f.size * (f.progress / 100));
                if (f.status === 'uploading') uploadingCount++;
                else if (f.status === 'paused') pausedCount++;
                else if (f.status === 'error' || f.status === 'cancelled') {
                    // Cancelled rolls into "failed" for the overall readout —
                    // both need user intervention (retry) to ever finish.
                    failedCount++;
                }
                // 'pending' contributes only to uploadedBytes — no dedicated
                // counter, since pending isn't a "state the user acts on".
            }
        }

        const percent = totalBytes === 0
            ? 0
            : Math.min(100, (uploadedBytes / totalBytes) * 100);
        const hasActivity =
            uploadingCount > 0 || completedCount > 0 || failedCount > 0 || pausedCount > 0;

        // Aggregate-state priority (drives the overall bar's color):
        //   error > uploading > paused > complete
        // Errors override everything else because a hidden errored file
        // (e.g. a badge off-screen) would otherwise blend into a partial
        // bar and the user wouldn't notice why the strip never hits 100%.
        // Active uploads win over paused so the bar reads as "live" while
        // anything's still moving; paused wins over complete so a "half
        // done, half paused" selection signals action-needed rather than
        // a happy in-progress state.
        const aggregateStatus: 'uploading' | 'paused' | 'error' | 'complete' =
            failedCount > 0          ? 'error'
          : uploadingCount > 0       ? 'uploading'
          : pausedCount > 0          ? 'paused'
          : completedCount === this.files.length && this.files.length > 0 ? 'complete'
          : 'uploading';

        return { uploadedBytes, totalBytes, completedCount, failedCount, uploadingCount, pausedCount, percent, hasActivity, aggregateStatus };
    }

    /**
     * Shared HTML for the aggregate progress strip — bar + a single stats line
     * showing completed/total counts, bytes uploaded vs. total, and percent.
     * Used both inline (under the file list) and inside the popover footer.
     * When any file is in the 'error' state, a "Retry all" button appears
     * between the stats and the percent (mirrors FluentUI's overallFooter).
     */
    private renderOverallProgressMarkup(o: ReturnType<WebDropzone['getOverallProgress']>): string {
        const pct = Math.round(o.percent);
        // Layout is anchored on three flex children: counts (flex: 1, pushes
        // everything else to the right edge), actions group (collapses via
        // :empty when no bulk actions apply), and percent (fixed min-width
        // so 9%/99%/100% all take the same horizontal space — no jitter as
        // the upload progresses). Matches FluentUI's footer-stats layout.
        return `
            <div class="dz__overall-progress__bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
                <div class="dz__overall-progress__fill" style="width: ${o.percent}%"></div>
            </div>
            <div class="dz__overall-progress__stats">
                <span class="dz__overall-progress__counts">${this.renderOverallCountsInner(o)}</span>
                <div class="dz__overall-progress__actions">${this.renderOverallActions(o)}</div>
                <span class="dz__overall-progress__percent">${pct}%</span>
            </div>
        `;
    }

    /**
     * Inner HTML of the counts line — extracted so per-tick patching can
     * refresh just this span without disturbing the surrounding action
     * buttons.
     */
    private renderOverallCountsInner(o: ReturnType<WebDropzone['getOverallProgress']>): string {
        const pausedSegment = o.pausedCount > 0
            ? ` · <span class="dz__overall-progress__paused">${o.pausedCount} paused</span>`
            : '';
        const failedSegment = o.failedCount > 0
            ? ` · <span class="dz__overall-progress__failed">${o.failedCount} failed</span>`
            : '';
        return `${o.completedCount} of ${this.files.length} · ${escapeHtml(formatFileSize(o.uploadedBytes))} / ${escapeHtml(formatFileSize(o.totalBytes))}${pausedSegment}${failedSegment}`;
    }

    /**
     * Bulk-action buttons rendered between the counts and the percent. Each
     * gates on a state crossing zero (Pause all when something's uploading,
     * Resume all when something's paused, Retry all when something errored).
     * Returns "" when no actions apply.
     */
    private renderOverallActions(o: ReturnType<WebDropzone['getOverallProgress']>): string {
        const pipelineActive = !!this.config.uploadFileCallback;
        const out: string[] = [];
        if (pipelineActive && o.uploadingCount > 0) {
            out.push(`<button type="button" class="dz__overall-progress__action" data-action="pause-all">Pause all</button>`);
        }
        if (pipelineActive && o.pausedCount > 0) {
            out.push(`<button type="button" class="dz__overall-progress__action" data-action="resume-all">Resume all</button>`);
        }
        if (o.failedCount > 0) {
            out.push(`<button type="button" class="dz__overall-progress__action" data-action="retry-all">Retry all</button>`);
        }
        return out.join('');
    }

    /**
     * Single-character signature of which action buttons are currently
     * showing. Stored on the container's dataset; per-tick refreshes only
     * rebuild the buttons when this signature actually changes. Otherwise
     * the buttons stay put across ticks — without this, every progress
     * update would destroy and re-create them, making them unclickable.
     */
    private overallActionsSignature(o: ReturnType<WebDropzone['getOverallProgress']>): string {
        const pipelineActive = !!this.config.uploadFileCallback;
        const p = pipelineActive && o.uploadingCount > 0 ? '1' : '0';
        const r = pipelineActive && o.pausedCount > 0 ? '1' : '0';
        const e = o.failedCount > 0 ? '1' : '0';
        return `${p}${r}${e}`;
    }

    /**
     * Attach the "Retry all" click handler within a subtree. Used everywhere
     * the overall progress markup is rendered: the inline strip's update path,
     * the initial popover render, and the popover's footer refresh.
     */
    private bindOverallProgressHandlers(root: ParentNode): void {
        root.querySelectorAll('[data-action="retry-all"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.retryAll();
            });
        });
        root.querySelectorAll('[data-action="pause-all"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.pauseAll();
            });
        });
        root.querySelectorAll('[data-action="resume-all"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                void this.resumeAll();
            });
        });
    }

    /**
     * Refresh the inline aggregate progress strip below the file list. Cleared
     * to empty (which collapses via `:empty`) when there's no activity to
     * report; otherwise renders the shared bar+stats markup.
     */
    private updateOverallProgress(): void {
        // Summary-line icon mirrors the same aggregate state — patched here
        // (not in refreshOverallProgress) so it tracks state changes even on
        // surfaces that don't render the inline progress strip (e.g. when
        // the strip is collapsed via :empty before any activity).
        this.patchSummaryIcon();
        // Same reason for the button/minimal selector badge — it shows
        // "X/Y · aggregateStatus" and needs to refresh every time a file
        // transitions, not just when the file set changes.
        this.updateSelectorBadge();
        if (!this.overallProgressEl) return;
        this.refreshOverallProgress(this.overallProgressEl);
    }

    /**
     * Refresh an overall-progress container in place. Patches the bar fill /
     * counts / percent on every call (cheap, no event handlers to thrash);
     * only rebuilds the inner DOM when the structure is missing or when the
     * action-button set changes. Used by both the inline strip and the
     * popover footer's embedded strip.
     */
    private refreshOverallProgress(container: HTMLElement): void {
        const overall = this.getOverallProgress();
        if (!overall.hasActivity) {
            container.innerHTML = '';
            delete container.dataset.dzButtonsSig;
            delete container.dataset.status;
            return;
        }

        const sig = this.overallActionsSignature(overall);
        const fillEl = container.querySelector('.dz__overall-progress__fill') as HTMLElement | null;
        const barEl = container.querySelector('.dz__overall-progress__bar') as HTMLElement | null;
        const countsEl = container.querySelector('.dz__overall-progress__counts') as HTMLElement | null;
        const percentEl = container.querySelector('.dz__overall-progress__percent') as HTMLElement | null;
        const actionsEl = container.querySelector('.dz__overall-progress__actions') as HTMLElement | null;

        // Aggregate-state attribute drives the bar's fill & track color
        // via CSS selectors. Errors win so a hidden errored badge can't
        // mask itself as "97% green, nothing to see here".
        if (container.dataset.status !== overall.aggregateStatus) {
            container.dataset.status = overall.aggregateStatus;
        }

        // First-time render — install the full structure.
        if (!fillEl || !countsEl || !percentEl || !actionsEl) {
            container.innerHTML = this.renderOverallProgressMarkup(overall);
            this.bindOverallProgressHandlers(container);
            container.dataset.dzButtonsSig = sig;
            return;
        }

        // Always-changing bits — bar fill, counts, percent.
        const pct = Math.round(overall.percent);
        fillEl.style.width = `${overall.percent}%`;
        barEl?.setAttribute('aria-valuenow', String(pct));
        countsEl.innerHTML = this.renderOverallCountsInner(overall);
        percentEl.textContent = `${pct}%`;

        // Only rebuild the actions group when the visible button set crosses
        // a threshold (Pause/Resume/Retry appearing or disappearing). The
        // surrounding strip — bar, counts span, percent — stays put, so the
        // percent doesn't slide left/right as buttons come and go.
        if (container.dataset.dzButtonsSig !== sig) {
            actionsEl.innerHTML = this.renderOverallActions(overall);
            this.bindOverallProgressHandlers(actionsEl);
            container.dataset.dzButtonsSig = sig;
        }
    }

    private closePopover(): void {
        if (!this.isPopoverOpen || !this.popover) return;

        // Detach Floating UI's scroll/resize observers before tearing the
        // popover out — leaking these is the classic autoUpdate footgun
        // (they keep firing against a detached element forever).
        this.popoverPositionCleanup?.();
        this.popoverPositionCleanup = null;

        // Tear down the user-resize observer + flush any pending save so
        // a quick close-after-resize doesn't lose the final dimension.
        this.popoverResizeObserver?.disconnect();
        this.popoverResizeObserver = null;
        if (this.popoverSaveTimer !== null) {
            clearTimeout(this.popoverSaveTimer);
            this.popoverSaveTimer = null;
            this.flushPopoverSize();
        }

        this.popover.remove();
        this.popover = null;
        this.isPopoverOpen = false;

        document.removeEventListener('click', this.boundHandleDocumentClick);
        document.removeEventListener('keydown', this.boundHandleKeyDown);

        uiLogger.debug('Popover closed');
    }

    // ========================================================================
    // PERSISTED UI STATE
    // ========================================================================

    /** Resolve the storage namespace key. Persistence is disabled (everything
     *  becomes a no-op) when no storage-key is configured. */
    private getStorageKey(): string | null {
        const k = this.config.storageKey;
        return (typeof k === 'string' && k.length > 0) ? k : null;
    }

    /** localStorage key paired with the configured storage-key. */
    private localStorageKeyFor(storageKey: string): string {
        return `dz-state:${storageKey}`;
    }

    /**
     * Load persisted state. Prefers `loadStateCallback` when set; otherwise
     * falls back to localStorage. Returns null when no state is found OR
     * when persistence is disabled. Tolerant of corruption (JSON parse
     * errors) and missing globals (SSR / sandboxed contexts).
     */
    private async loadDropzoneState(): Promise<import('./types').DropzoneState | null> {
        const key = this.getStorageKey();
        if (!key) return null;

        if (this.config.loadStateCallback) {
            try {
                const result = await this.config.loadStateCallback(key);
                return result ?? null;
            } catch (err) {
                uiLogger.warn('loadStateCallback threw, ignoring', err);
                return null;
            }
        }

        try {
            const raw = globalThis.localStorage?.getItem(this.localStorageKeyFor(key));
            return raw ? JSON.parse(raw) : null;
        } catch {
            // localStorage may be unavailable (private mode, SSR) or the
            // serialized value may be corrupted. Either way, start fresh.
            return null;
        }
    }

    /**
     * Merge `partial` into the existing state and write it back through
     * the configured sink (callback or localStorage). The full snapshot is
     * always passed to `persistStateCallback` — implementations can write
     * the full object or diff against their own prior view as they prefer.
     */
    private async saveDropzoneState(partial: Partial<import('./types').DropzoneState>): Promise<void> {
        const key = this.getStorageKey();
        if (!key) return;

        const current = (await this.loadDropzoneState()) ?? {};
        const next = { ...current, ...partial };

        if (this.config.persistStateCallback) {
            try {
                await this.config.persistStateCallback(key, next);
            } catch (err) {
                uiLogger.warn('persistStateCallback threw, falling back to in-memory', err);
            }
            return;
        }

        try {
            globalThis.localStorage?.setItem(
                this.localStorageKeyFor(key),
                JSON.stringify(next)
            );
        } catch {
            // localStorage write failures (quota, private mode) are
            // swallowed — the UI keeps working with in-memory state.
        }
    }

    /** Read the popover's current size from its computed style and persist
     *  it. Called from the ResizeObserver's debounced tick and from the
     *  flush path in closePopover so a late close doesn't drop the final
     *  dimension. */
    private flushPopoverSize(): void {
        if (!this.popover) return;
        const rect = this.popover.getBoundingClientRect();
        void this.saveDropzoneState({
            popoverWidth: Math.round(rect.width),
            popoverHeight: Math.round(rect.height)
        });
    }

    /**
     * Resolve the popover's anchor element. The current rendering surface
     * exposes a `.dz__summary__line` when selectorAppearance='card' (since the
     * summary line is the click trigger), and falls back to the inline
     * selector button (button or minimal modes) where the selector itself is
     * the click trigger.
     */
    private getPopoverAnchor(): HTMLElement | null {
        const summaryLine = this.summaryEl?.querySelector('.dz__summary__line') as HTMLElement | null;
        if (summaryLine) return summaryLine;
        // Rolling appearance: anchor to the container itself (the visible
        // "current file" rectangle) rather than the queue badge inside it.
        // Container is stable across front-file swaps; the badge isn't a
        // good positioning reference because it's a small corner overlay.
        const targetEl = this.config.isFilesInsideEnabled ? this.filesInsideEl : this.fileListEl;
        if (targetEl?.classList.contains('dz__file-list--rolling') ||
            targetEl?.classList.contains('dz__files-inside--rolling')) {
            return targetEl;
        }
        // Satellite path (rolling or popover summary): the actual anchor
        // element is inside the `<web-dropzone-list>` shadow root and
        // isn't reachable here. Use the satellite host element's bounding
        // rect — it's the same outer rectangle the user sees and Floating
        // UI positions just fine against it.
        const { listAppearance } = resolveDisplayConfig(this.config);
        if ((listAppearance === 'rolling' || listAppearance === 'popover') && this.satelliteListEl) {
            return this.satelliteListEl;
        }
        const btn = this.dropzoneEl?.querySelector('.dz__button, .dz__minimal') as HTMLElement | null;
        return btn ?? this.dropzoneEl;
    }

    private positionPopover(): void {
        if (!this.popover) return;
        const anchor = this.getPopoverAnchor();
        if (!anchor) return;

        const placement = (this.config.popoverPlacement || DEFAULT_CONFIG.popoverPlacement) as Placement;
        const popover = this.popover;

        // autoUpdate keeps the popover correctly placed whenever ANYTHING
        // moves — scroll, anchor reflow, viewport resize, AND user-driven
        // resize of the popover itself via the CSS `resize` handle. The
        // returned cleanup detaches the observers; we hold onto it so
        // closePopover() can call it when the popover goes away.
        const update = async () => {
            const { x, y } = await computePosition(anchor, popover, {
                placement,
                middleware: [
                    offset(8),
                    flip(),
                    // size middleware caps maxWidth/maxHeight at the
                    // viewport edge minus 8px padding. Without this, the
                    // user can drag the resize handle past the viewport
                    // and the bottom rows disappear off-screen.
                    size({
                        padding: 8,
                        apply({ availableWidth, availableHeight, elements }) {
                            Object.assign(elements.floating.style, {
                                maxWidth:  `${Math.max(0, availableWidth)}px`,
                                maxHeight: `${Math.max(0, availableHeight)}px`
                            });
                        }
                    }),
                    shift({ padding: 8 })
                ]
            });
            Object.assign(popover.style, {
                left: `${x}px`,
                top: `${y}px`
            });
        };

        this.popoverPositionCleanup?.();
        this.popoverPositionCleanup = autoUpdate(anchor, popover, update);
    }

    private updatePopoverContent(): void {
        if (!this.popover) return;

        // Refresh the file-count label, limits hint, body rows, and totals
        // footer. The limits hint includes dynamic "X left" segments for
        // max-total-size / max-file-count, so it has to re-render on every
        // files change just like the count and footer.
        const countEl = this.popover.querySelector('.dz__popover__count');
        if (countEl) countEl.textContent = this.getFileCountLabel();

        const limitsEl = this.popover.querySelector('.dz__popover__limits');
        if (limitsEl) limitsEl.textContent = this.getLimitsHint();

        // Patch the footer in place — preserves action buttons across the
        // refresh just like patchFileRow above. Add/remove changes the
        // totals, so include them here.
        this.refreshPopoverFooter(true);

        const body = this.popover.querySelector('.dz__popover__body');
        if (body) {
            body.innerHTML = `
                <table class="dz__popover__table">
                    <tbody>
                        ${this.getOrderedFiles().map((f) => this.renderCompactItem(f)).join('')}
                    </tbody>
                </table>
            `;
            this.bindPopoverRemoveHandlers(body);
        }
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    private cacheElements(): void {
        this.dropzoneEl = this.element.querySelector('.dz__dropzone');
        this.inputEl = this.element.querySelector('.dz__dropzone__input');
        this.fileListEl = this.element.querySelector('.dz__file-list');
        this.filesInsideEl = this.element.querySelector('.dz__files-inside');
        this.summaryEl = this.element.querySelector('.dz__summary');
        this.overallProgressEl = this.element.querySelector('.dz__overall-progress');
    }

    private attachEventListeners(): void {
        if (this.dropzoneEl) {
            this.dropzoneEl.addEventListener('dragover', this.boundHandleDragOver);
            this.dropzoneEl.addEventListener('dragleave', this.boundHandleDragLeave);
            this.dropzoneEl.addEventListener('drop', this.boundHandleDrop);
            this.dropzoneEl.addEventListener('click', this.boundHandleClick);
        }

        if (this.inputEl) {
            this.inputEl.addEventListener('change', this.boundHandleInputChange);
        }
    }

    private detachEventListeners(): void {
        if (this.dropzoneEl) {
            this.dropzoneEl.removeEventListener('dragover', this.boundHandleDragOver);
            this.dropzoneEl.removeEventListener('dragleave', this.boundHandleDragLeave);
            this.dropzoneEl.removeEventListener('drop', this.boundHandleDrop);
            this.dropzoneEl.removeEventListener('click', this.boundHandleClick);
        }

        if (this.inputEl) {
            this.inputEl.removeEventListener('change', this.boundHandleInputChange);
        }

        document.removeEventListener('click', this.boundHandleDocumentClick);
        document.removeEventListener('keydown', this.boundHandleKeyDown);
    }

    private handleDragOver(e: DragEvent): void {
        e.preventDefault();
        e.stopPropagation();

        if (this.config.isDisabled) return;

        if (!this.dragActive) {
            this.dragActive = true;
            this.dropzoneEl?.classList.add('dz__dropzone--active');
            interactionLogger.debug('Drag enter');
        }
    }

    private handleDragLeave(e: DragEvent): void {
        e.preventDefault();
        e.stopPropagation();

        // Only handle if leaving the dropzone entirely
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (this.dropzoneEl?.contains(relatedTarget)) return;

        this.dragActive = false;
        this.dropzoneEl?.classList.remove('dz__dropzone--active');
        interactionLogger.debug('Drag leave');
    }

    private handleDrop(e: DragEvent): void {
        e.preventDefault();
        e.stopPropagation();

        this.dragActive = false;
        this.dropzoneEl?.classList.remove('dz__dropzone--active');

        if (this.config.isDisabled) return;

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            interactionLogger.debug('Files dropped', { count: files.length });
            this.processFiles(Array.from(files));
        }
    }

    private handleClick(e: MouseEvent): void {
        // Don't trigger if clicking on remove or row-action button
        if ((e.target as HTMLElement).closest('[data-action="remove"]')) return;
        if ((e.target as HTMLElement).closest('[data-action="row-action"]')) return;

        // The hidden input sits inside the dropzone, so when we open the file
        // picker programmatically (popover's "Add more", the dropzone's own
        // click→browse flow, etc.) the synthetic click on the input bubbles
        // back through here. Without this guard we'd recurse into another
        // inputEl.click() — the second call cancels the first dialog and the
        // resulting `change` event arrives with an empty FileList. See the
        // popover Add-more handler.
        if (e.target === this.inputEl) return;

        if (this.config.isDisabled) return;

        // For selector=button/minimal + listAppearance=popover, clicks on the
        // selector toggle the popover when files exist. Otherwise (or when
        // empty) they open the picker. This matches FluentUI's minimal+popover
        // convention.
        const { selectorAppearance, listAppearance } = resolveDisplayConfig(this.config);
        if (
            listAppearance === 'popover' &&
            (selectorAppearance === 'button' || selectorAppearance === 'minimal') &&
            this.files.length > 0
        ) {
            this.togglePopover();
            return;
        }

        this.inputEl?.click();
        interactionLogger.debug('Dropzone clicked');
    }

    private handleInputChange(e: Event): void {
        const input = e.target as HTMLInputElement;
        const files = input.files;

        if (files && files.length > 0) {
            interactionLogger.debug('Files selected via input', { count: files.length });
            this.processFiles(Array.from(files));
        }

        // Reset input so same file can be selected again
        input.value = '';
    }

    private handleDocumentClick(e: MouseEvent): void {
        if (!this.isPopoverOpen || !this.popover) return;

        // The popover lives inside Shadow DOM, so `e.target` at document level
        // is re-targeted to the host element — `popover.contains(target)` is
        // always false. composedPath() walks the real path through the shadow
        // root and exposes the actual clicked element.
        const path = e.composedPath();

        // Clicks inside the popover itself stay open.
        if (path.includes(this.popover)) return;

        // The "Add more" button calls inputEl.click() which synthesises a
        // bubbling click on the hidden <input type="file">. That input lives
        // inside the dropzone — not inside the popover or anchor — so without
        // this guard the popover would dismiss itself the moment the user
        // tries to add more files.
        if (this.inputEl && path.includes(this.inputEl)) return;

        // Clicks on the trigger (summary line for card+popover, button/minimal
        // selector for the other families) are handled by the trigger's own
        // toggle handler — letting this branch close would race with that.
        const anchor = this.getPopoverAnchor();
        if (anchor && path.includes(anchor)) return;

        this.closePopover();
    }

    private handleKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Escape' && this.isPopoverOpen) {
            this.closePopover();
        }
    }

    // ========================================================================
    // EVENTS
    // ========================================================================

    private emitAddEvent(file: FileState): void {
        const event = new CustomEvent('file-added', {
            detail: { file, files: this.getFiles() },
            bubbles: true,
            composed: true
        });
        this.element.dispatchEvent(event);
        this.markFilesChanged(file.id);

        if (this.config.addCallback) {
            this.config.addCallback([file]);
        }
    }

    private emitRemoveEvent(file: FileState): void {
        const event = new CustomEvent('file-removed', {
            detail: { file, files: this.getFiles() },
            bubbles: true,
            composed: true
        });
        this.element.dispatchEvent(event);
        this.markFilesChanged(file.id);

        if (this.config.removeCallback) {
            this.config.removeCallback(file);
        }
    }

    /**
     * Mark a file id as dirty and schedule the coalesced
     * `files-changed` event for the next animation frame. Multiple
     * calls within the same frame collapse into a single dispatch
     * with the union of dirty ids. The dispatch carries the current
     * `getFiles()` snapshot — reactive consumers diff against their
     * own last-seen list.
     */
    private markFilesChanged(id: string): void {
        this.dirtyFileIds.add(id);
        if (this.filesChangedRafHandle !== null) return;
        this.filesChangedRafHandle = requestAnimationFrame(() => {
            this.filesChangedRafHandle = null;
            const changedIds = Array.from(this.dirtyFileIds);
            this.dirtyFileIds.clear();
            const event = new CustomEvent('files-changed', {
                detail: { changedIds, files: this.getFiles() },
                bubbles: true,
                composed: true
            });
            this.element.dispatchEvent(event);
        });
    }

    private emitChangeEvent(): void {
        const event = new CustomEvent('change', {
            detail: { files: this.getFiles() },
            bubbles: true,
            composed: true
        });
        this.element.dispatchEvent(event);

        if (this.config.changeCallback) {
            this.config.changeCallback(this.getFiles());
        }
    }

    private emitRejectEvent(rejectedFiles: RejectedFile[]): void {
        const event = new CustomEvent('files-rejected', {
            detail: { rejectedFiles },
            bubbles: true,
            composed: true
        });
        this.element.dispatchEvent(event);

        if (this.config.rejectCallback) {
            this.config.rejectCallback(rejectedFiles);
        }
    }

    private emitRetryEvent(file: FileState): void {
        const event = new CustomEvent('file-retry', {
            detail: { file, files: this.getFiles() },
            bubbles: true,
            composed: true
        });
        this.element.dispatchEvent(event);

        if (this.config.retryCallback) {
            this.config.retryCallback(file);
        }
    }

    private emitUploadedEvent(file: FileState): void {
        const event = new CustomEvent('file-uploaded', {
            detail: { file, files: this.getFiles() },
            bubbles: true,
            composed: true
        });
        this.element.dispatchEvent(event);

        if (this.config.uploadedCallback) {
            this.config.uploadedCallback(file);
        }
    }

    private emitDeleteEvent(file: FileState): void {
        const event = new CustomEvent('file-deleted', {
            detail: { file, files: this.getFiles() },
            bubbles: true,
            composed: true
        });
        this.element.dispatchEvent(event);

        if (this.config.deleteCallback) {
            this.config.deleteCallback(file);
        }
    }

    /**
     * Substrate event for satellite renderers (`<web-dropzone-list>`,
     * `<web-dropzone-indicator>`, …). Fires whenever a file's progress
     * value changes — including the implicit 0→100 jump on `setFileStatus`
     * → 'complete'. bubbles + composed so listeners in other shadow roots
     * pick it up. See ARCHITECTURE.md.
     */
    private emitFileProgress(file: FileState): void {
        const event = new CustomEvent('file-progress', {
            detail: { id: file.id, progress: file.progress, status: file.status, file },
            bubbles: true,
            composed: true
        });
        this.element.dispatchEvent(event);
        this.markFilesChanged(file.id);
    }

    /**
     * Substrate event — fires whenever a file's status transitions.
     * `prevStatus !== nextStatus` is guaranteed (no-op mutations are
     * suppressed in `mutateFileState`). bubbles + composed.
     */
    private emitFileStatusChanged(
        file: FileState,
        prevStatus: FileState['status'],
        nextStatus: FileState['status']
    ): void {
        const event = new CustomEvent('file-status-changed', {
            detail: { id: file.id, prevStatus, nextStatus, file },
            bubbles: true,
            composed: true
        });
        this.element.dispatchEvent(event);
        this.markFilesChanged(file.id);
    }

    /**
     * Centralized status/progress mutator. **All** status and progress
     * mutations must route through here so the substrate events
     * (`file-progress`, `file-status-changed`) fire at every transition.
     * Direct `file.status = …` / `file.progress = …` writes leave
     * satellite renderers stale.
     *
     * `progress` is clamped to [0, 100]. No-op mutations (status equals
     * prev, progress equals prev) do not emit. `file.error` is intentionally
     * out of scope — events only carry status / progress; callers handle
     * error inline.
     */
    private mutateFileState(
        file: FileState,
        patch: { status?: FileState['status']; progress?: number }
    ): void {
        const prevStatus = file.status;
        const prevProgress = file.progress;

        if (patch.status !== undefined) file.status = patch.status;
        if (patch.progress !== undefined) {
            file.progress = Math.max(0, Math.min(100, patch.progress));
        }

        if (file.status !== prevStatus) {
            this.emitFileStatusChanged(file, prevStatus, file.status);
        }
        if (file.progress !== prevProgress) {
            this.emitFileProgress(file);
        }
    }

    // ========================================================================
    // DRAG OVERLAY (Ultra-Compact Mode)
    // ========================================================================

    private setupOverlayTarget(): void {
        if (!this.config.overlayTarget) return;

        // Get target element
        if (typeof this.config.overlayTarget === 'string') {
            this.overlayTarget = document.getElementById(this.config.overlayTarget);
        } else {
            this.overlayTarget = this.config.overlayTarget;
        }

        if (!this.overlayTarget) {
            initLogger.warn('Overlay target not found', { target: this.config.overlayTarget });
            return;
        }

        // Listen for drag events on document to detect file drags
        document.addEventListener('dragenter', this.boundHandleOverlayDragEnter);
        window.addEventListener('blur', this.boundHandleWindowBlur);

        initLogger.debug('Overlay target setup', { target: this.overlayTarget });
    }

    private handleOverlayDragEnter(e: DragEvent): void {
        // Only activate if dragging files
        if (!e.dataTransfer?.types.includes('Files')) return;

        // Only activate if not disabled and target exists
        if (this.config.isDisabled || !this.overlayTarget) return;

        // Only create overlay if not already showing
        if (this.dragOverlay) return;

        this.createOverlay();
    }

    private createOverlay(): void {
        if (!this.overlayTarget || this.dragOverlay) return;

        const rect = this.overlayTarget.getBoundingClientRect();
        const icon = this.config.overlayIcon || DEFAULT_CONFIG.overlayIcon;
        const text = this.config.overlayText || DEFAULT_CONFIG.overlayText;

        this.dragOverlay = document.createElement('div');
        this.dragOverlay.className = 'dz__overlay';
        // Only the rect-derived positioning is inline; the rest (position:fixed,
        // z-index, colors, layout) lives in _modifiers.css under .dz__overlay.
        this.dragOverlay.style.top = `${rect.top}px`;
        this.dragOverlay.style.left = `${rect.left}px`;
        this.dragOverlay.style.width = `${rect.width}px`;
        this.dragOverlay.style.height = `${rect.height}px`;

        this.dragOverlay.innerHTML = `
            <div class="dz__overlay__content">
                <div class="dz__overlay__icon">${icon}</div>
                <div class="dz__overlay__text">${escapeHtml(text)}</div>
            </div>
        `;

        document.body.appendChild(this.dragOverlay);

        // Handle drag events on overlay
        this.dragOverlay.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        this.dragOverlay.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                interactionLogger.debug('Files dropped on overlay', { count: files.length });
                this.processFiles(Array.from(files));
            }

            this.removeOverlay();
        });

        this.dragOverlay.addEventListener('dragleave', (e) => {
            // Only remove if leaving the overlay entirely
            const relatedTarget = e.relatedTarget as HTMLElement;
            if (this.dragOverlay?.contains(relatedTarget)) return;

            this.removeOverlay();
        });

        // ESC to close
        document.addEventListener('keydown', this.handleOverlayKeyDown);

        uiLogger.debug('Overlay created');
    }

    private handleOverlayKeyDown = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') {
            this.removeOverlay();
        }
    };

    private removeOverlay(): void {
        if (this.dragOverlay) {
            document.removeEventListener('keydown', this.handleOverlayKeyDown);
            this.dragOverlay.remove();
            this.dragOverlay = null;
            uiLogger.debug('Overlay removed');
        }
    }

    private cleanupOverlay(): void {
        this.removeOverlay();
        document.removeEventListener('dragenter', this.boundHandleOverlayDragEnter);
        window.removeEventListener('blur', this.boundHandleWindowBlur);
    }
}
