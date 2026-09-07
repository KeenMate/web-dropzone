/**
 * Shared module-level helpers + the default config object — referenced by
 * BOTH `core/dropzone-core.ts` (validation + add pipeline) and
 * `dropzone.ts` (renderer methods). Extracted into its own module so the
 * core and the renderer can import them without circular dependencies.
 *
 * Phase A · Step 1 of the core/renderer split (see ARCHITECTURE.md). The
 * pure helpers don't depend on any class state — they're purely
 * `(File) → result` transforms — so moving them out of the class file is
 * an entirely structural change.
 */

import type {
    DropzoneConfig,
    FileTypeCategory,
    FileIconOverrides
} from './types';
import { FILE_TYPE_ICONS, UI_ICONS } from './icons';

/**
 * Default configuration values. The `Required<Omit<…>>` shape lists every
 * config key that has a sensible static default — anything excluded here
 * is either a callback (no default) or a runtime-resolved reference
 * (`container`, `hostElement`, `overlayTarget`).
 */
export const DEFAULT_CONFIG: Required<Omit<DropzoneConfig, 'fileIcons' | 'fileIconCallback' | 'validateCallback' | 'beforeFilesAddedCallback' | 'beforeFilesRemovedCallback' | 'uploadFileCallback' | 'renderFileItemCallback' | 'renderListWrapperCallback' | 'renderPromptCallback' | 'renderSummaryCallback' | 'customStylesCallback' | 'persistStateCallback' | 'loadStateCallback' | 'storageKey' | 'container' | 'hostElement' | 'overlayTarget' | 'selectorAppearance' | 'listAppearance' | 'gridLayout' | 'gridStatus' | 'controls' | 'itemControls' | 'cardSize' | 'isShowThumbnailsEnabled' | 'retryPolicy' | 'rollingRotation' | 'isHeadless' | 'renderRollingBodyCallback' | 'renderRollingFileInfoCallback' | 'renderRollingProgressCallback'>> = {
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
    icon: UI_ICONS.cloudUpload,
    promptText: 'Drop files here or click to browse',
    selectFilesText: 'Select files',
    noFileChosenText: 'No file chosen',
    hintText: '',
    dragActiveText: 'Drop files here',
    emptyMessage: 'No files selected',
    summaryTemplate: '{count} file(s), {size}',
    popoverPlacement: 'bottom-start',
    overlayText: 'Drop files here',
    overlayIcon: UI_ICONS.upload,
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
 * File-type icons used by `getFileIcon` to render a glyph based on the file's
 * MIME type / extension; the renderer reaches for this directly inside its row
 * templates. Aliases the canonical Lucide set in `icons.ts` — kept exported
 * under this historical name so existing `FILE_ICONS` imports keep resolving.
 */
export const FILE_ICONS: Record<FileTypeCategory, string> = FILE_TYPE_ICONS;

/**
 * Generate a unique ID for a file
 */
export function generateFileId(): string {
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

/** Lowercased extension without the dot (`photo.PNG` → `png`); '' if none. */
function fileExtension(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/**
 * Case- and leading-dot-insensitive lookup in a user icon map. Maps are tiny
 * (a handful of keys), so the linear scan is cheaper than pre-normalizing.
 */
function lookupIconMap(map: Record<string, string>, probe: string): string | undefined {
    if (!probe) return undefined;
    for (const key in map) {
        if (key.replace(/^\./, '').toLowerCase() === probe) return map[key];
    }
    return undefined;
}

/**
 * Resolve the icon markup for a file. Resolution order, first hit wins:
 *   1. `overrides.fileIconCallback(file)` (non-null return)
 *   2. `overrides.fileIcons[<extension>]`  (e.g. `psd`)
 *   3. `overrides.fileIcons[<category>]`   (e.g. `archive`)
 *   4. built-in Lucide category icon
 *
 * `overrides` is any object exposing `fileIcons` / `fileIconCallback` — a full
 * `DropzoneConfig` qualifies, so renderers pass `this.config` directly. Returns
 * a raw HTML string (see the XSS caveat on `DropzoneConfig.fileIcons`).
 */
export function getFileIcon(file: File, overrides?: FileIconOverrides): string {
    const fromCallback = overrides?.fileIconCallback?.(file);
    if (fromCallback != null) return fromCallback;

    const map = overrides?.fileIcons;
    if (map) {
        const byExt = lookupIconMap(map, fileExtension(file.name));
        if (byExt !== undefined) return byExt;
        const byCategory = lookupIconMap(map, getFileTypeCategory(file));
        if (byCategory !== undefined) return byCategory;
    }

    return FILE_ICONS[getFileTypeCategory(file)];
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
