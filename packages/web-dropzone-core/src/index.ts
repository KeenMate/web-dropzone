/**
 * Barrel export for the core public surface — the non-rendering substrate.
 *
 * Phase B · Step 5 of the core/renderer split (see ARCHITECTURE.md).
 * Everything re-exported from here is what survives the eventual package
 * split into `@keenmate/dropzone-core` (Step 6) — no DOM, no CSS, no
 * web-component / satellite element classes.
 *
 * The top-level `src/index.ts` re-exports `*` from here plus the renderer
 * surface, so consumers of the published package keep their existing
 * import paths.
 */

// ---- Class --------------------------------------------------------------
export { DropzoneCore } from './dropzone-core';

// ---- Pure helpers + default config -------------------------------------
export {
    DEFAULT_CONFIG,
    formatFileSize,
    getFileTypeCategory,
    getFileIcon,
    isImageFile,
    createImagePreview,
    generateFileId,
    FILE_ICONS
} from './dropzone-shared';

// ---- File-pipeline helpers (stateless validators) ----------------------
export {
    validateFile,
    isFileTypeAccepted,
    dedupeKeyFor,
    createFileState
} from './file-pipeline';
export type { ValidationConfig } from './file-pipeline';

// ---- Icons (shared SVG family + spinner factory) -----------------------
export {
    STATUS_ICONS,
    STATUS_LABELS,
    ACTION_ICONS,
    ACTION_LABELS,
    actionForStatus,
    createDropzoneSpinner
} from './icons';
export type { RowAction } from './icons';

// ---- Public store contract + status-surface types ----------------------
export type {
    DropzoneStoreAPI,
    StatusAggregate,
    StatusSurfaceArgs,
    StatusSurfaceCallback,
    StatusSurfaceResult
} from './store-api';

// ---- Domain types ------------------------------------------------------
export type {
    DropzoneConfig,
    DropzoneMode,
    DropzoneState,
    DisplayMode,
    FileStatus,
    ValueFormat,
    FileState,
    FileUploadHandler,
    FileUploadContext,
    FileUploadResult,
    ValidationResult,
    RejectedFile,
    FileItemRenderContext,
    FileAddedEventDetail,
    FileRemovedEventDetail,
    FilesRejectedEventDetail,
    ChangeEventDetail,
    FileRetryEventDetail,
    FileUploadedEventDetail,
    FileDeletedEventDetail,
    DropzoneEventDetail,
    FileTypeCategory,
    AddFilesOptions,
    OverallProgress,
    DedupeMode,
    ProgressMode,
    RetryPolicy,
    FileProgressEventDetail,
    FileStatusChangedEventDetail,
    FileUpdatedEventDetail,
    FileRowUpdateEventDetail,
    FilesChangedEventDetail,
    SelectorAppearance,
    ListAppearance,
    DropzoneControl,
    FileItemPart,
    RollingRotation,
    CardSize,
    GridLayout
} from './types';
export { FILE_TYPE_ICONS } from './types';

// ---- Logging utilities (runtime control) -------------------------------
export {
    setLogLevel,
    enableLogging,
    disableLogging,
    setCategoryLevel,
    LOGGING_CATEGORIES,
    initLogger,
    fileLogger,
    uiLogger,
    interactionLogger
} from './logger';

// ---- DOM helpers shared with renderers ---------------------------------
// Tiny + zero-project-dependency, so they live in core to avoid a renderer
// → core cycle. Pure DOM primitives — safe to use from either side.
export { dispatchComposedEvent, escapeHtml } from './dom-utils';
