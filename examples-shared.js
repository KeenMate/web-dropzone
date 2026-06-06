/**
 * Shared helpers for the example pages.
 *
 * `simulateUpload({ bucket, durationMs, failRate })` returns an
 * `uploadFileCallback` you can assign to a <web-dropzone> (or a
 * <web-dropzone-picker> for Mode B). It animates progress via rAF over
 * `durationMs`, honours pause/cancel through `signal`, resumes from
 * `context.startPercent` after a retry, and randomly fails with the
 * configured `failRate` to exercise the error path.
 *
 * Failures throw with a realistic-looking message AFTER reaching a random
 * intermediate progress (so the UI shows the bar partially fill before
 * flipping to the error state). Retries (resuming from startPercent) are
 * NOT subject to a fresh failRate roll — once a file gets past its random
 * dice on the initial attempt, the retry path is deterministic-success so
 * a user can recover with one click rather than fighting RNG.
 */

const FAILURE_MESSAGES = [
    'Network timeout (504)',
    'Connection reset',
    'Quota exceeded',
    'Upstream 500',
    'Signature mismatch',
    'Temporary 503',
];

export function simulateUpload({
    bucket = 'default',
    durationMs = 3500,
    failRate = 0,
} = {}) {
    return (file, onProgress, signal, context) => new Promise((resolve, reject) => {
        // The store hands us `context.startPercent` on every (re)entry — non-zero
        // whenever we're resuming after pause/retry. Scale the remaining duration
        // proportionally so resume-from-50% finishes in ~half the original time.
        const startPct = context?.startPercent ?? 0;
        if (startPct >= 100) {
            resolve({ metadata: { bucket, uploadedAt: new Date().toISOString() } });
            return;
        }
        const isRetry = startPct > 0;
        // Roll once per fresh start. Retries always succeed so the user has a
        // single-click recovery path instead of needing to win RNG.
        const willFail = !isRetry && failRate > 0 && Math.random() < failRate;
        const failAtPct = willFail
            // Fail somewhere between 20% and 80% so the bar shows real motion
            // before the error flips in — instant failures feel like a no-op.
            ? 20 + Math.random() * 60
            : 100;
        const remainingPct = 100 - startPct;
        const remainingMs = durationMs * (remainingPct / 100);
        const start = performance.now();
        let aborted = false;
        signal?.addEventListener('abort', () => {
            aborted = true;
            reject(new DOMException('Aborted', 'AbortError'));
        });
        const tick = () => {
            if (aborted) return;
            const elapsed = performance.now() - start;
            const pctOfRemaining = Math.min(1, elapsed / remainingMs);
            const pct = Math.min(100, startPct + remainingPct * pctOfRemaining);
            onProgress(pct);
            if (willFail && pct >= failAtPct) {
                const msg = FAILURE_MESSAGES[Math.floor(Math.random() * FAILURE_MESSAGES.length)];
                reject(new Error(msg));
                return;
            }
            if (pct >= 100) {
                resolve({ metadata: { bucket, uploadedAt: new Date().toISOString() } });
                return;
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
}

/**
 * Wire a plain <button> as a queue-state-aware control. The button's label
 * and action morph based on aggregate file state:
 *
 *   any uploading  → "Pause all"  → store.pauseAll()
 *   any paused     → "Resume all" → store.resumeAll()
 *   any error      → "Retry all"  → store.retryAll()   (also kicks pending)
 *   any pending    → "Upload all" → store.uploadAll()
 *   nothing        → disabled, reads "Upload all"
 *
 * Priority is fixed (uploading > paused > error > pending) — only ONE action
 * shows at a time even when statuses coexist. Retry-all already drains
 * pending as a side effect, so error + pending collapses to a single click.
 */
const DEFAULT_QUEUE_LABELS = {
    upload: 'Upload all',
    pause:  'Pause all',
    resume: 'Resume all',
    retry:  'Retry all',
};

export function wireQueueControlButton(storeEl, buttonEl, labels = {}) {
    if (!storeEl || !buttonEl) return;
    const L = { ...DEFAULT_QUEUE_LABELS, ...labels };
    let action = null;
    buttonEl.addEventListener('click', () => {
        // Snapshot before invoking — the action call dispatches
        // file-status-changed events synchronously, which re-run sync() and
        // mutate `action` mid-handler. Without the snapshot, a click on
        // "Pause all" would (1) call pauseAll, (2) sync flips action to
        // 'resume', (3) the next `if` matched 'resume' and immediately
        // un-paused everything, looking like the queue ignored Pause.
        const a = action;
        if (a === 'pause')       storeEl.pauseAll();
        else if (a === 'resume') storeEl.resumeAll();
        else if (a === 'retry')  storeEl.retryAll();
        else if (a === 'upload') storeEl.uploadAll();
    });
    const sync = () => {
        const files = storeEl.files ?? [];
        let uploading = false, paused = false, error = false, pending = false;
        for (const f of files) {
            if (f.status === 'uploading') uploading = true;
            else if (f.status === 'paused') paused = true;
            else if (f.status === 'error' || f.status === 'cancelled') error = true;
            else if (f.status === 'pending') pending = true;
        }
        if (uploading)    { action = 'pause';  buttonEl.textContent = L.pause;  buttonEl.disabled = false; }
        else if (paused)  { action = 'resume'; buttonEl.textContent = L.resume; buttonEl.disabled = false; }
        else if (error)   { action = 'retry';  buttonEl.textContent = L.retry;  buttonEl.disabled = false; }
        else if (pending) { action = 'upload'; buttonEl.textContent = L.upload; buttonEl.disabled = false; }
        else              { action = null;     buttonEl.textContent = L.upload; buttonEl.disabled = true;  }
    };
    storeEl.addEventListener('files-changed', sync);
    storeEl.addEventListener('file-status-changed', sync);
    sync();
}
