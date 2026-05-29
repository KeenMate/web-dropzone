/**
 * WebDropzone - Core file dropzone component
 *
 * A feature-rich file dropzone with drag-drop, previews, validation,
 * and multiple display modes.
 */

import { computePosition, flip, shift, offset } from '@floating-ui/dom';
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
    CardSize,
    FileTypeCategory,
    FILE_TYPE_ICONS,
    FileItemRenderContext
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

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<Omit<DropzoneConfig, 'validateCallback' | 'addCallback' | 'removeCallback' | 'changeCallback' | 'rejectCallback' | 'retryCallback' | 'uploadFileCallback' | 'uploadedCallback' | 'deleteCallback' | 'renderFileItemCallback' | 'renderPromptCallback' | 'renderSummaryCallback' | 'customStylesCallback' | 'container' | 'hostElement' | 'overlayTarget' | 'selectorAppearance' | 'listAppearance' | 'cardSize' | 'isShowThumbnailsEnabled' | 'retryPolicy'>> = {
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
    isUploadedFileDeletable: true
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

    // DOM elements
    private dropzoneEl: HTMLElement | null = null;
    private inputEl: HTMLInputElement | null = null;
    private fileListEl: HTMLElement | null = null;
    private filesInsideEl: HTMLElement | null = null;
    private summaryEl: HTMLElement | null = null;
    private overallProgressEl: HTMLElement | null = null;

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
     * Add files programmatically
     */
    addFiles(fileList: FileList | File[]): void {
        const files = Array.from(fileList);
        this.processFiles(files);
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

        const file = this.files[index];
        const hasServerState = this.hasServerSideState(file);
        this.files.splice(index, 1);

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
        const file = this.files.find(f => f.id === id);
        if (!file) return;

        file.progress = Math.max(0, Math.min(100, progress));

        // Auto-update status based on progress
        if (file.progress > 0 && file.progress < 100 && file.status === 'pending') {
            file.status = 'uploading';
        } else if (file.progress === 100 && file.status === 'uploading') {
            file.status = 'complete';
        }

        fileLogger.debug('File progress updated', { id, progress: file.progress, status: file.status });

        this.patchFileRow(file);
    }

    /**
     * Set file status (pending, uploading, complete, error). Patches the
     * affected row in place — see updateFileProgress.
     */
    setFileStatus(id: string, status: FileState['status'], error?: string): void {
        const file = this.files.find(f => f.id === id);
        if (!file) return;

        file.status = status;
        if (error) file.error = error;
        if (status === 'complete') file.progress = 100;

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
     * Reset a single file's upload state and either re-queue it (if the
     * component owns the pipeline) or fire `file-retry` so the app's existing
     * handler can re-run. Clears `error`, sets `status='pending'`,
     * `progress=0`, patches the row, then emits the event in both modes.
     */
    retryFile(id: string): void {
        const file = this.files.find(f => f.id === id);
        if (!file) return;
        this.pausedIds.delete(id);
        file.status = 'pending';
        file.progress = 0;
        file.error = undefined;
        fileLogger.debug('File retry requested', { id, name: file.name });
        this.patchFileRow(file);
        this.emitRetryEvent(file);
        // Component-driven mode: re-queue via the worker pool. The pool's
        // re-entrancy guard collapses simultaneous calls — retryAll calling
        // retryFile in a loop still triggers one drain pass.
        if (this.config.uploadFileCallback) {
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
        if (!this.config.uploadFileCallback) return;
        if (this.isDrainingQueue) return;

        this.isDrainingQueue = true;
        const concurrency = Math.max(1, this.config.concurrency ?? 1);

        const worker = async (): Promise<void> => {
            while (true) {
                const next = this.files.find(f =>
                    f.status === 'pending' &&
                    !this.pausedIds.has(f.id) &&
                    !this.activeIds.has(f.id)
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
        if (!this.config.uploadFileCallback) return;
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
        } else {
            // Not in flight — mark paused so the worker pool skips it.
            const file = this.files.find(f => f.id === id);
            if (file && (file.status === 'pending' || file.status === 'uploading')) {
                file.status = 'paused';
                this.patchFileRow(file);
            }
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
            file.status = 'pending';
            file.error = undefined;
            this.patchFileRow(file);
        } else if (file.status === 'cancelled') {
            // Cancelled → user-initiated abort, server state is assumed lost.
            file.status = 'pending';
            file.progress = 0;
            file.error = undefined;
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
                file.status = 'cancelled';
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
                f.status = 'pending';
                // Progress preserved — handler sees startBytes > 0.
                f.error = undefined;
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
        const handler = this.config.uploadFileCallback;
        if (!handler) return;
        const file = this.files.find(f => f.id === id);
        if (!file) return;
        if (this.pausedIds.has(id)) return;

        const ctrl = new AbortController();
        this.controllers.set(id, ctrl);

        // Flip to uploading. Progress is NOT reset — the caller controls
        // that. Pause / Resume preserves progress so the handler sees a
        // non-zero startBytes in context; explicit retry (retryFile) and
        // automatic retry-after-error (below) reset it to 0 before invoking
        // runUpload again.
        file.status = 'uploading';
        file.error = undefined;
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
            }
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
            file.status = 'complete';
            file.progress = 100;
            this.patchFileRow(file);
            this.emitUploadedEvent(file);
        } catch (err) {
            if (ctrl.signal.aborted) {
                // The signal fires for pause AND cancel — distinguish by which
                // set holds the id. pause keeps it for resume; cancel doesn't.
                if (this.pausedIds.has(id)) {
                    file.status = 'paused';
                } else {
                    file.status = 'cancelled';
                }
                this.patchFileRow(file);
                return;
            }
            const msg = err instanceof Error ? err.message : 'Upload failed';
            const policy = this.config.retryPolicy ?? {};
            const maxAttempts = Math.max(1, policy.attempts ?? 1);
            if (attempt + 1 < maxAttempts) {
                const delay = (policy.delayMs ?? 1000) * Math.pow(policy.backoff ?? 2, attempt);
                await new Promise(r => setTimeout(r, delay));
                // Bail out cleanly if the file was paused / removed during the
                // backoff window.
                if (this.pausedIds.has(id) || !this.files.find(f => f.id === id)) return;
                // Auto-retry resets progress — server-side state from the
                // failed attempt may be incoherent, so start from 0. Handlers
                // that want smart retry should set retryPolicy.attempts=1 and
                // handle resume in their own code (where they can check
                // server state with HEAD before deciding).
                file.progress = 0;
                this.patchFileRow(file);
                return this.runUpload(id, attempt + 1);
            }
            file.status = 'error';
            file.error = msg;
            this.patchFileRow(file);
        } finally {
            this.controllers.delete(id);
        }
    }

    // ========================================================================
    // FILE PROCESSING
    // ========================================================================

    private processFiles(files: File[]): void {
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
            acceptedFiles.push(this.createFileState(file));
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
        if (
            acceptedFiles.length > 0 &&
            this.config.uploadFileCallback &&
            this.config.isAutoUploadEnabled !== false
        ) {
            void this.uploadAll();
        }
    }

    private createFileState(file: File): FileState {
        return {
            id: generateFileId(),
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'pending',
            progress: 0
        };
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
        this.element.innerHTML = this.renderComponent();
        this.cacheElements();
        const r = resolveDisplayConfig(this.config);
        uiLogger.debug('Component rendered', {
            displayMode: this.config.displayMode,
            selectorAppearance: r.selectorAppearance,
            listAppearance: r.listAppearance,
            cardSize: r.cardSize
        });
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
        // (list/detailed/grid/badges) and only when files-inside is off.
        const needsListArea =
            !filesInside &&
            (listAppearance === 'list' ||
             listAppearance === 'detailed' ||
             listAppearance === 'grid' ||
             listAppearance === 'badges');

        const containerClasses = [
            'dz__container',
            `dz__container--selector-${selectorAppearance}`,
            `dz__container--list-${listAppearance}`,
            selectorAppearance === 'card' ? `dz__container--card-${cardSize}` : '',
            filesInside ? 'dz__container--files-inside' : ''
        ].filter(Boolean).join(' ');

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
        if (this.config.renderPromptCallback) {
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
        return `<div class="dz__file-list dz__file-list--${listAppearance}"></div>`;
    }

    private renderFilesInsideArea(): string {
        const { listAppearance } = resolveDisplayConfig(this.config);
        return `<div class="dz__files-inside dz__files-inside--${listAppearance}"></div>`;
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
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        return template.content.firstElementChild as HTMLElement | null;
    }

    /** Attach the main-list remove-button click handler within a subtree. */
    private bindListRemoveHandlers(root: ParentNode): void {
        root.querySelectorAll('[data-action="remove"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = (btn as HTMLElement).dataset.fileId;
                if (id) this.removeFile(id);
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
                this.removeFile(id);
                if (this.files.length === 0) {
                    this.closePopover();
                } else {
                    this.updatePopoverContent();
                }
            });
        });
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
        const hasCustomRenderer = !!this.config.renderFileItemCallback;
        const index = this.files.indexOf(file);

        const targetEl = this.config.isFilesInsideEnabled ? this.filesInsideEl : this.fileListEl;
        if (targetEl) {
            const existing = targetEl.querySelector(`[data-file-id="${file.id}"]`) as HTMLElement | null;
            if (existing) {
                if (hasCustomRenderer) {
                    const next = this.htmlToElement(this.renderFileItem(file, index, false));
                    if (next) {
                        existing.replaceWith(next);
                        this.bindListRemoveHandlers(next);
                    }
                } else {
                    this.patchInlineRowInPlace(existing, file, listAppearance);
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
        row.classList.toggle('dz__popover__row--uploading', file.status === 'uploading');

        const fill = row.querySelector('.dz__popover__progress-fill') as HTMLElement | null;
        if (fill) fill.style.width = `${file.progress}%`;

        const progressText = row.querySelector('.dz__popover__progress-text');
        if (progressText) progressText.textContent = `${file.progress.toFixed(1)}%`;

        const statusEl = row.querySelector('.dz__popover__status') as HTMLElement | null;
        if (statusEl) {
            statusEl.className = `dz__popover__status dz__popover__status--${file.status}`;
            statusEl.textContent = file.status.charAt(0).toUpperCase() + file.status.slice(1);
        }

        this.syncRemoveButtonHiddenState(
            row.querySelector('.dz__popover__remove'),
            file,
            'dz__popover__remove--hidden'
        );
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
        if (appearance === 'badges') {
            // Badge wrapper carries the status modifier — recolors the
            // border via CSS. Pending status has no modifier class.
            row.className = file.status !== 'pending'
                ? `dz__badge dz__badge--${file.status}`
                : 'dz__badge';
        }

        if (appearance === 'grid' && file.previewUrl) {
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
            targetEl.innerHTML = this.config.isFilesInsideEnabled ? '' : `<div class="dz__empty">${escapeHtml(this.config.emptyMessage || DEFAULT_CONFIG.emptyMessage)}</div>`;
            return;
        }

        const { listAppearance } = resolveDisplayConfig(this.config);
        const visible = this.getVisibleFiles();
        const items = visible.map((file, index) => this.renderFileItem(file, index, false)).join('');
        const toggle = this.renderToggleButton(listAppearance);

        targetEl.innerHTML = items + toggle;

        this.bindListRemoveHandlers(targetEl);
        this.bindToggleHandler(targetEl);

        uiLogger.debug('File list rendered', {
            count: this.files.length,
            visible: visible.length,
            filesInside: this.config.isFilesInsideEnabled
        });
    }

    /**
     * Slice `files` to the visible window. When `maxVisibleFiles` is 0/unset,
     * or `showAllList` is true, the full selection is returned. Otherwise only
     * the first `maxVisibleFiles` files are rendered and the rest are hidden
     * behind the "Show N more" toggle.
     */
    private getVisibleFiles(): FileState[] {
        const cap = this.config.maxVisibleFiles || 0;
        if (cap <= 0 || this.showAllList) return this.files;
        return this.files.slice(0, cap);
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
        if (this.config.renderFileItemCallback) {
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

    /**
     * Render the placeholder slot's inner content — either an `<img>` for
     * image files when thumbnails are enabled, or the file-type icon glyph.
     * The slot's box dimensions (width/height/background) come from CSS — set
     * the relevant `--dz-*-icon-size` variable to 0 to collapse the slot.
     */
    private renderPlaceholderInner(file: FileState, useThumbnail: boolean): string {
        if (useThumbnail && file.previewUrl) {
            return `<img src="${file.previewUrl}" alt="">`;
        }
        return escapeHtml(getFileIcon(file.file));
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

    /** Build the `class=""` / `aria-hidden` / `tabindex` attrs used by every
     *  per-row remove button. Hidden buttons stay in the DOM (layout
     *  reserved) but are inert. */
    private removeButtonAttrs(file: FileState, baseClass: string): string {
        const hidden = !this.isFileUserRemovable(file);
        const cls = hidden ? `${baseClass} ${baseClass}--hidden` : baseClass;
        const inert = hidden ? ' tabindex="-1" aria-hidden="true"' : '';
        return `class="${cls}" data-action="remove" data-file-id="${file.id}" aria-label="Remove ${escapeHtml(file.name)}"${inert}`;
    }

    private renderListItem(file: FileState): string {
        return `
            <div class="dz__file-item dz__file-item--list" data-file-id="${file.id}">
                <span class="dz__file-item__name">${escapeHtml(file.name)}</span>
                <button type="button" ${this.removeButtonAttrs(file, 'dz__file-item__remove')}></button>
            </div>
        `;
    }

    private renderDetailedItem(file: FileState): string {
        const category = getFileTypeCategory(file.file);
        const useThumbnail = this.shouldShowThumbnails('detailed');
        const inner = this.renderPlaceholderInner(file, useThumbnail);

        return `
            <div class="dz__file-item dz__file-item--detailed" data-file-id="${file.id}">
                <div class="dz__file-item__icon dz__file-item__icon--${category}">${inner}</div>
                <div class="dz__file-item__info">
                    <div class="dz__file-item__name">${escapeHtml(file.name)}</div>
                    <div class="dz__file-item__meta">
                        <span class="dz__file-item__size">${formatFileSize(file.size)}</span>
                        <span class="dz__file-item__type">${escapeHtml(file.type || 'Unknown')}</span>
                    </div>
                </div>
                <button type="button" ${this.removeButtonAttrs(file, 'dz__file-item__remove')}></button>
            </div>
        `;
    }

    private renderGridItem(file: FileState): string {
        const isImage = isImageFile(file.file);
        const useThumbnail = this.shouldShowThumbnails('grid');
        // Grid traditionally puts the image directly in the tile while non-image
        // files fall back to a centered placeholder. Honoring show-thumbnails=
        // 'false' here means even image files render as the icon placeholder,
        // which is exactly the "I want a uniform icon grid" use case.
        const inner = useThumbnail && file.previewUrl
            ? `<img src="${file.previewUrl}" alt="${escapeHtml(file.name)}" class="dz__preview-item__image">`
            : `<div class="dz__preview-item__placeholder">${escapeHtml(getFileIcon(file.file))}</div>`;

        return `
            <div class="dz__preview-item ${isImage ? 'dz__preview-item--image' : ''}" data-file-id="${file.id}">
                ${inner}
                <div class="dz__preview-item__overlay">
                    <span class="dz__preview-item__name">${escapeHtml(file.name)}</span>
                </div>
                <button type="button" ${this.removeButtonAttrs(file, 'dz__preview-item__remove')}></button>
            </div>
        `;
    }

    private renderBadgeItem(file: FileState): string {
        const statusClass = file.status !== 'pending' ? `dz__badge--${file.status}` : '';
        const useThumbnail = this.shouldShowThumbnails('badges');
        const inner = this.renderPlaceholderInner(file, useThumbnail);
        return `
            <span class="dz__badge ${statusClass}" data-file-id="${file.id}">
                <span class="dz__badge-text" title="${escapeHtml(file.name)}">
                    <span class="dz__badge-icon">${inner}</span>
                    <span class="dz__badge-name">${escapeHtml(file.name)}</span>
                </span>
                <button type="button" ${this.removeButtonAttrs(file, 'dz__badge-remove')}></button>
            </span>
        `;
    }

    private renderCompactItem(file: FileState): string {
        const useThumbnail = this.shouldShowThumbnails('popover');
        const inner = this.renderPlaceholderInner(file, useThumbnail);
        const statusClass = `dz__popover__status--${file.status}`;
        const statusText = file.status.charAt(0).toUpperCase() + file.status.slice(1);
        const isUploading = file.status === 'uploading';

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
                <td class="dz__popover__cell dz__popover__cell--status">
                    <span class="dz__popover__status ${statusClass}">${statusText}</span>
                </td>
                <td class="dz__popover__cell dz__popover__cell--actions">
                    <button type="button" ${this.removeButtonAttrs(file, 'dz__popover__remove')}></button>
                </td>
            </tr>
        `;
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
        if (this.config.renderSummaryCallback) {
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
                    <span class="dz__summary__icon">📎</span>
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

        for (const [hostClass, badgeClass] of [
            ['dz__minimal', 'dz__minimal__badge'],
            ['dz__button',  'dz__button__badge']
        ] as const) {
            const host = this.dropzoneEl.querySelector(`.${hostClass}`);
            if (!host) continue;

            const count = this.files.length;
            let badge = host.querySelector(`.${badgeClass}`) as HTMLElement | null;

            if (count > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = badgeClass;
                    host.appendChild(badge);
                }
                badge.textContent = String(count);
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
        this.popover.className = 'dz__popover';
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
                        ${this.files.map((f, i) => this.renderCompactItem(f)).join('')}
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
     */
    private getOverallProgress(): {
        uploadedBytes: number;
        totalBytes: number;
        completedCount: number;
        failedCount: number;
        uploadingCount: number;
        pausedCount: number;
        percent: number;
        hasActivity: boolean;
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

        return { uploadedBytes, totalBytes, completedCount, failedCount, uploadingCount, pausedCount, percent, hasActivity };
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
            return;
        }

        const sig = this.overallActionsSignature(overall);
        const fillEl = container.querySelector('.dz__overall-progress__fill') as HTMLElement | null;
        const barEl = container.querySelector('.dz__overall-progress__bar') as HTMLElement | null;
        const countsEl = container.querySelector('.dz__overall-progress__counts') as HTMLElement | null;
        const percentEl = container.querySelector('.dz__overall-progress__percent') as HTMLElement | null;
        const actionsEl = container.querySelector('.dz__overall-progress__actions') as HTMLElement | null;

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

        this.popover.remove();
        this.popover = null;
        this.isPopoverOpen = false;

        document.removeEventListener('click', this.boundHandleDocumentClick);
        document.removeEventListener('keydown', this.boundHandleKeyDown);

        uiLogger.debug('Popover closed');
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
        const btn = this.dropzoneEl?.querySelector('.dz__button, .dz__minimal') as HTMLElement | null;
        return btn ?? this.dropzoneEl;
    }

    private async positionPopover(): Promise<void> {
        if (!this.popover) return;
        const anchor = this.getPopoverAnchor();
        if (!anchor) return;

        const placement = (this.config.popoverPlacement || DEFAULT_CONFIG.popoverPlacement) as Placement;

        const { x, y } = await computePosition(
            anchor,
            this.popover,
            {
                placement,
                middleware: [
                    offset(8),
                    flip(),
                    shift({ padding: 8 })
                ]
            }
        );

        Object.assign(this.popover.style, {
            left: `${x}px`,
            top: `${y}px`
        });
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
                        ${this.files.map((f, i) => this.renderCompactItem(f)).join('')}
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
        // Don't trigger if clicking on remove button
        if ((e.target as HTMLElement).closest('[data-action="remove"]')) return;

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

        if (this.config.removeCallback) {
            this.config.removeCallback(file);
        }
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
