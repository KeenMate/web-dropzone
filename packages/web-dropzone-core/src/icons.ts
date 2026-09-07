/**
 * Shared SVG icon set used across `<web-dropzone>`, the satellite renderers,
 * and any user-provided render callbacks that want to match the library's
 * visual language. Lucide outline icons (24/24, currentColor stroke) rendered
 * as inline SVG strings — they size with `width: 1em` so they scale with
 * `--dz-rem` automatically.
 *
 * All exports are stable strings or pure factories. Callers can safely cache
 * the strings or reuse the elements returned by the factories across ticks.
 */

import type { FileStatus, FileTypeCategory } from './types';

/**
 * Wraps Lucide inner paths in the shared outline-SVG shell: 24/24 viewBox,
 * `currentColor` stroke at width 2, round caps/joins. Every icon in this file
 * goes through here so the whole family stays visually consistent and scales
 * to the surrounding `1em` font-size.
 */
function svgIcon(inner: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

/**
 * Per-category file-type glyphs (Lucide). Keyed by `FileTypeCategory` — the
 * renderer reaches for these via `getFileIcon` inside its row / grid / minimal
 * templates. Replaces the previous emoji set so file icons match the rest of
 * the Lucide family and inherit `currentColor` + `--dz-rem` sizing.
 */
export const FILE_TYPE_ICONS: Record<FileTypeCategory, string> = {
    image:       svgIcon('<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'),
    video:       svgIcon('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>'),
    audio:       svgIcon('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
    pdf:         svgIcon('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'),
    doc:         svgIcon('<path d="M12.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v9.5"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M13.378 15.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>'),
    spreadsheet: svgIcon('<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>'),
    archive:     svgIcon('<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>'),
    code:        svgIcon('<path d="M10 12.5 8 15l2 2.5"/><path d="m14 12.5 2 2.5-2 2.5"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>'),
    text:        svgIcon('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'),
    default:     svgIcon('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>')
};

/**
 * Chrome glyphs (Lucide) used by the shell rather than per-file rows: the
 * drop-zone prompt, the drag overlay, and the popover summary's idle state.
 * Consumers can still override via the `icon` / `overlayIcon` config with any
 * markup or emoji; these are just the defaults.
 */
export const UI_ICONS = {
    /** cloud-upload — drop-zone prompt + minimal-mode button. */
    cloudUpload: svgIcon('<path d="M12 13v8"/><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="m8 17 4-4 4 4"/>'),
    /** upload — full-element drag overlay ("drop to upload"). */
    upload: svgIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>'),
    /** paperclip — popover summary while idle (no active uploads). */
    paperclip: svgIcon('<path d="M13.234 20.252 21 12.3"/><path d="m16 6-8.414 8.586a2 2 0 0 0 0 2.828 2 2 0 0 0 2.828 0l8.414-8.586a4 4 0 0 0 0-5.656 4 4 0 0 0-5.656 0l-8.415 8.585a6 6 0 1 0 8.486 8.486l6.906-6.907"/>')
} as const;

/**
 * Per-status glyph used wherever the queue shows a single file's state —
 * inline list rows, the popover, the indicator chip, and the rolling block.
 * The `uploading` glyph is a partial arc designed to be rotated via WAAPI
 * (see `createDropzoneSpinner`) or CSS animation; the rest are static.
 */
export const STATUS_ICONS: Record<FileStatus, string> = {
    pending:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    uploading: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
    paused:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="10" x2="10" y1="15" y2="9"/><line x1="14" x2="14" y1="15" y2="9"/></svg>',
    complete:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
    error:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>',
    cancelled: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>'
};

export const STATUS_LABELS: Record<FileStatus, string> = {
    pending:   'Pending',
    uploading: 'Uploading',
    paused:    'Paused',
    complete:  'Complete',
    error:     'Error',
    cancelled: 'Cancelled'
};

/**
 * Per-row action button — pause / resume / retry. The Y-axis of pause and
 * resume align with each other so the swap on status transition feels like
 * a single icon morphing instead of a fresh glyph appearing.
 */
export type RowAction = 'pause' | 'resume' | 'retry';

export const ACTION_ICONS: Record<RowAction, string> = {
    pause:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/></svg>',
    resume: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>',
    retry:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>'
};

export const ACTION_LABELS: Record<RowAction, string> = {
    pause:  'Pause',
    resume: 'Resume',
    retry:  'Retry'
};

export function actionForStatus(status: FileStatus): RowAction | null {
    if (status === 'uploading') return 'pause';
    if (status === 'paused')    return 'resume';
    if (status === 'error')     return 'retry';
    return null;
}

/**
 * Polished activity spinner — the OOB animation for "something is happening"
 * states. Returns an HTMLElement with a Web Animations API rotation already
 * attached, so the spinner survives shadow-DOM boundaries without depending
 * on any host-page CSS keyframes. The element is safe to cache and re-mount
 * many times; WAAPI animations persist across detach/attach and the indicator
 * uses identity-based memoization to avoid restarting.
 *
 * The glyph itself is the Lucide loader-circle (24/24, currentColor stroke),
 * sized to `1em` so it inherits the surrounding font-size — drop it inside a
 * chip / row / button at whatever scale and it fits.
 */
export function createDropzoneSpinner(opts: {
    /** Duration of one full rotation, ms. Default 1100. */
    durationMs?: number;
    /** Optional class added to the wrapper span (useful for ad-hoc theming). */
    className?: string;
    /** Optional aria-label for assistive tech. Default "Loading". */
    ariaLabel?: string;
} = {}): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.setAttribute('role', 'img');
    wrapper.setAttribute('aria-label', opts.ariaLabel ?? 'Loading');
    wrapper.className = `dz__spinner${opts.className ? ` ${opts.className}` : ''}`;
    wrapper.style.display = 'inline-flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.width = '1em';
    wrapper.style.height = '1em';
    wrapper.style.lineHeight = '1';
    wrapper.innerHTML = STATUS_ICONS.uploading;
    const svg = wrapper.querySelector('svg');
    if (svg) {
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.transformOrigin = '50% 50%';
        svg.animate(
            [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
            { duration: opts.durationMs ?? 1100, iterations: Infinity }
        );
    }
    return wrapper;
}
