/**
 * Shared structural callback contract for any "status surface" in the
 * package — the floating indicator chip, the rolling list appearance, and
 * any future surface that shows "what's the current file doing + what's the
 * overall queue doing".
 *
 * Three callbacks per surface, all sharing this signature:
 *
 *   - **body**     — outer wrapper / shell. Decides whether the surface is
 *                    visible at all (return `false` to hide), and either
 *                    composes its own DOM around the other parts or yields
 *                    to the library's polished default (return `null`).
 *   - **fileInfo** — the part that identifies the focal file: name, icon,
 *                    size, status. Useful for "Uploading xyz.zip" templates.
 *                    No-op when there's no current file.
 *   - **progress** — per-file progress + overall progress + state.
 *                    The args carry both slices because some templates
 *                    want to show them side-by-side
 *                    ("xyz.zip 47% — 3 / 10 done").
 *
 * Each surface exposes the three as JS-only properties (no HTML attribute
 * equivalent — they're functions). Polished out-of-the-box rendering is the
 * library calling its own defaults through the same hooks — every part is
 * replaceable piecemeal without rebuilding the whole surface.
 *
 * Return-value semantics (consistent across all three):
 *   - `null`  / `undefined`   → library default
 *   - `false`                 → hide this part (or, for body, the whole surface)
 *   - `string`                → set as `innerHTML` (memoized: skipped when
 *                               equal to the previous string)
 *   - `HTMLElement`           → replace children (identity-checked: skipped
 *                               when the returned node is already mounted)
 *
 * The memoization is what makes this safe to call at progress-tick frequency.
 * Cache your spinner / element outside the callback and return the same
 * instance each tick — the surface will skip the DOM swap.
 */

import type { FileState, FileStatus } from './types';

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
}

/**
 * Universal render-part return type. See module docstring for semantics.
 */
export type StatusSurfaceResult = string | HTMLElement | false | null | undefined;

/**
 * One render callback. Three of these (body / fileInfo / progress) are
 * exposed on every status surface.
 */
export type StatusSurfaceCallback = (args: StatusSurfaceArgs) => StatusSurfaceResult;

/**
 * Computes a `StatusAggregate` from a file list. The aggregate is cheap
 * (O(N)) but every status surface uses the same shape, so it lives here as
 * a shared helper.
 */
export function computeStatusAggregate(files: ReadonlyArray<FileState>): StatusAggregate {
    const agg: StatusAggregate = {
        total: files.length,
        uploading: 0,
        paused: 0,
        pending: 0,
        complete: 0,
        error: 0,
        cancelled: 0,
        overallStatus: 'idle'
    };
    if (files.length === 0) return agg;
    for (const f of files) {
        if (f.status === 'uploading') agg.uploading++;
        else if (f.status === 'paused') agg.paused++;
        else if (f.status === 'pending') agg.pending++;
        else if (f.status === 'complete') agg.complete++;
        else if (f.status === 'error') agg.error++;
        else if (f.status === 'cancelled') agg.cancelled++;
    }
    if (agg.error > 0) agg.overallStatus = 'error';
    else if (agg.uploading > 0) agg.overallStatus = 'uploading';
    else if (agg.paused > 0) agg.overallStatus = 'paused';
    else if (agg.pending > 0) agg.overallStatus = 'pending';
    else if (agg.complete > 0) agg.overallStatus = 'complete';
    return agg;
}

/**
 * Computes byte-weighted overall percent across the queue. Kept separate
 * from `computeStatusAggregate` so surfaces that don't need it (badges,
 * grid) can skip the pass over file.size.
 */
export function computeOverallPercent(files: ReadonlyArray<FileState>): number {
    if (files.length === 0) return 0;
    let totalBytes = 0;
    let doneBytes = 0;
    for (const f of files) {
        totalBytes += f.size;
        doneBytes += f.size * (f.progress / 100);
    }
    return totalBytes > 0
        ? Math.min(100, Math.round((doneBytes / totalBytes) * 100))
        : 0;
}

/**
 * Picks the focal file for a status surface. Priority: first uploading file
 * (the one actively transferring), else last pending (next up), else last
 * non-complete (paused/error), else last complete. Returns undefined for
 * an empty queue.
 */
export function pickCurrentFile(files: ReadonlyArray<FileState>): FileState | undefined {
    if (files.length === 0) return undefined;
    const uploading = files.find(f => f.status === 'uploading');
    if (uploading) return uploading;
    const pending = files.find(f => f.status === 'pending');
    if (pending) return pending;
    const stuck = files.find(f =>
        f.status === 'paused' || f.status === 'error' || f.status === 'cancelled'
    );
    if (stuck) return stuck;
    return files[files.length - 1];
}

/**
 * Builds a fully-populated `StatusSurfaceArgs` from a file list. Used by
 * every surface to standardize the data passed to callbacks.
 */
export function buildStatusSurfaceArgs(
    files: ReadonlyArray<FileState>
): StatusSurfaceArgs {
    const aggregate = computeStatusAggregate(files);
    const overallPercent = computeOverallPercent(files);
    const currentFile = pickCurrentFile(files);
    return {
        currentFile,
        currentFilePercent: currentFile?.progress,
        currentFileStatus: currentFile?.status,
        aggregate,
        overallPercent,
        overallStatus: aggregate.overallStatus,
        files
    };
}

/**
 * Apply a `StatusSurfaceResult` into `target`, honoring the memoization
 * semantics. Tracks state via `prev` so a caller can decide on subsequent
 * ticks whether to skip the DOM write. Returns the new `prev` snapshot.
 *
 * `prev` shape:
 *   - `{ kind: 'string', value }` — last applied as innerHTML
 *   - `{ kind: 'element', value }` — last applied as a single child node
 *   - `{ kind: 'hidden' }` — last call returned `false` (target hidden)
 *   - `{ kind: 'default' }` — last call returned `null` (defer to caller)
 *   - `undefined` — never applied
 */
export type StatusSurfacePrev =
    | { kind: 'string'; value: string }
    | { kind: 'element'; value: HTMLElement }
    | { kind: 'hidden' }
    | { kind: 'default' }
    | undefined;

export function applyStatusSurfaceResult(
    target: HTMLElement,
    result: StatusSurfaceResult,
    prev: StatusSurfacePrev
): StatusSurfacePrev {
    if (result === false) {
        if (prev?.kind === 'hidden') return prev;
        target.hidden = true;
        return { kind: 'hidden' };
    }
    if (result == null) {
        // 'default' is a signal — caller handles its own default rendering.
        // We don't unhide here because the caller will write its content.
        return { kind: 'default' };
    }
    if (target.hidden) target.hidden = false;
    if (typeof result === 'string') {
        if (prev?.kind === 'string' && prev.value === result) return prev;
        target.innerHTML = result;
        return { kind: 'string', value: result };
    }
    // HTMLElement — identity-checked to allow callers to cache their element
    // and have the indicator skip the DOM swap (preserves WAAPI animations,
    // focus, transitions in flight, etc.).
    if (prev?.kind === 'element' && prev.value === result
        && target.firstChild === result
        && target.childNodes.length === 1) {
        return prev;
    }
    target.replaceChildren(result);
    return { kind: 'element', value: result };
}
