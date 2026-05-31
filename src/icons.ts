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

import type { FileStatus } from './types';

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
