/**
 * Public contract types that cross the core ↔ renderer boundary.
 *
 * `DropzoneStoreAPI` is the formal interface every renderer / satellite /
 * status-surface callback talks to. The status-surface "args" / "result" /
 * "callback" / "aggregate" types are part of the same public contract:
 * `StatusSurfaceArgs.store` is typed `DropzoneStoreAPI`, and consumer-facing
 * render callbacks (`renderRollingBodyCallback` and friends in
 * `DropzoneConfig`) are typed `StatusSurfaceCallback`. They all live here
 * so `core/types.ts` can reference them without a back-reference into the
 * renderer package.
 *
 * The implementation helpers that act on these types (computeStatusAggregate,
 * computeOverallPercent, pickCurrentFile, buildStatusSurfaceArgs,
 * applyStatusSurfaceResult, StatusSurface class) stay in
 * `renderer/status-surface.ts` — they're renderer-only utilities.
 */

import type {
    FileState,
    FileStatus,
    DropzoneConfig,
    AddFilesOptions,
    OverallProgress
} from './types';

/**
 * Public store interface — the contract between `DropzoneCore` and everything
 * that talks to it (renderer overrides, satellites, status-surface render
 * callbacks). The canonical reference type used by:
 *
 *   - **Satellites** (`<web-dropzone-picker>`, `<web-dropzone-list>`,
 *     `<web-dropzone-indicator>`, `<web-dropzone-progress>`) — type their
 *     `store` field as `DropzoneStoreAPI` so they don't depend on the
 *     concrete `WebDropzone` / `DropzoneCore` class.
 *   - **Status-surface render callbacks** — receive `args.store: DropzoneStoreAPI`
 *     so they can dispatch actions (`store.pauseAll()`, `store.removeFile(id)`)
 *     from within the rendering context.
 *   - **`<web-dropzone>.getStore()`** returns this type so consumers stay
 *     decoupled from the underlying implementation.
 *
 * Both `DropzoneCore` and the renderer subclass `WebDropzone` implement this
 * interface structurally. After the package split (Phase B Step 6), this is
 * the single import that crosses the package boundary at runtime.
 */
export interface DropzoneStoreAPI {
    // ---- Programmatic add -------------------------------------------------
    addFiles(fileList: FileList | File[], opts?: AddFilesOptions): Promise<void>;

    // ---- Per-file actions -------------------------------------------------
    pauseFile(id: string): void;
    resumeFile(id: string): Promise<void>;
    retryFile(id: string): void;
    cancelFile(id: string): void;
    /** Pass `{ confirm: true }` to run `beforeFilesRemovedCallback` first. */
    removeFile(id: string, opts?: { confirm?: boolean }): Promise<void>;

    // ---- Bulk actions -----------------------------------------------------
    pauseAll(): void;
    resumeAll(): Promise<void>;
    retryAll(): void;
    /** Nuke the queue — aborts active uploads, drops every FileState.
     *  Pass `{ confirm: true }` to run `beforeFilesRemovedCallback` first. */
    clear(opts?: { confirm?: boolean }): Promise<void>;

    // ---- Reads ------------------------------------------------------------
    /** Returns a mutable copy of the file list. Mutating it does NOT mutate
     *  the store — re-add via `addFiles` if you want the change reflected. */
    getFiles(): FileState[];
    getFile(id: string): FileState | undefined;
    /** Read-only view of the merged config (includes DEFAULT_CONFIG fallback). */
    getConfig(): Readonly<DropzoneConfig>;
    /** Byte-weighted aggregate progress + per-status counts. */
    getOverallProgress(): OverallProgress;
}

/**
 * Aggregate view of a store's file list, recomputed once per refresh cycle.
 * Exposed via every `StatusSurfaceArgs` so consumers can read counts and
 * derive their own labels.
 */
export interface StatusAggregate {
    /** Total number of files in the store's queue. */
    total: number;
    uploading: number;
    paused: number;
    pending: number;
    complete: number;
    error: number;
    cancelled: number;
    /**
     * Worst-case status for surface color. Priority:
     * error > uploading > paused > pending > complete > idle.
     * `idle` only when `total === 0`.
     */
    overallStatus: FileStatus | 'idle';
}

/**
 * Arguments handed to every render callback. Holds both the per-current-file
 * slice (undefined when nothing's uploading) and the queue-wide aggregate
 * (always present), so any callback can pick the slice it needs.
 */
export interface StatusSurfaceArgs {
    // ---- Per-current-file slice -------------------------------------------
    /** The "focal" file — the first uploading file, or the most recent. */
    currentFile: FileState | undefined;
    /** Convenience: `currentFile?.progress`, omitted when there's none. */
    currentFilePercent: number | undefined;
    /** Convenience: `currentFile?.status`, omitted when there's none. */
    currentFileStatus: FileStatus | undefined;

    // ---- Aggregate slice --------------------------------------------------
    aggregate: StatusAggregate;
    /** Byte-weighted overall progress across the entire queue, 0–100. */
    overallPercent: number;
    /** Worst-case status across the queue (same as `aggregate.overallStatus`). */
    overallStatus: FileStatus | 'idle';

    // ---- Escape hatch -----------------------------------------------------
    /** Full file list, read-only. Rarely needed once aggregate is available. */
    files: ReadonlyArray<FileState>;
    /**
     * The store this surface is bound to. Callbacks use it to dispatch
     * actions (`store.pauseAll()`, `store.removeFile(id)`, etc.) without
     * needing to look up the host element separately. See `DropzoneStoreAPI`
     * above for the available surface.
     */
    store: DropzoneStoreAPI;
}

/**
 * Universal render-part return type. See `renderer/status-surface.ts` for
 * the memoization semantics:
 *   - `null` / `undefined` → library default
 *   - `false`              → hide this part (or, for body, the whole surface)
 *   - `string`             → set as `innerHTML` (memoized: skipped when
 *                            equal to the previous string)
 *   - `HTMLElement`        → replace children (identity-checked: skipped
 *                            when the returned node is already mounted)
 */
export type StatusSurfaceResult = string | HTMLElement | false | null | undefined;

/**
 * One render callback. Three of these (body / fileInfo / progress) are
 * exposed on every status surface.
 */
export type StatusSurfaceCallback = (args: StatusSurfaceArgs) => StatusSurfaceResult;
