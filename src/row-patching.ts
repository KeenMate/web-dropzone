/**
 * In-place DOM patchers for row chrome — progress bar fill, percent text,
 * status icon, action button. Used by both the core store's render path
 * (`dropzone.ts`, list / detailed / grid / badges / popover modes) and the
 * standalone `<web-dropzone-list>` satellite. Same DOM shape on both sides,
 * so the patchers don't care which call site invoked them.
 *
 * Each helper takes a row (or button) element plus the CSS class that
 * identifies the slot to patch. The class is passed explicitly rather than
 * derived from the row because callers always know their own row kind
 * up-front (the satellite reads `resolveAppearance()`; the core reads
 * `resolveDisplayConfig(this.config)`). Keeping the class as a parameter
 * means the helpers stay pure functions of `(element, slot, value)` — no
 * branching on row type, easy to unit-test.
 *
 * The status-icon patcher unifies a previously-inconsistent path: the
 * satellite used to set only `title` while the core set both `title` AND
 * `aria-label`. The unified helper always sets both, so satellite-only
 * setups gain the same screen-reader announcement the core had.
 */

import {
    STATUS_ICONS,
    STATUS_LABELS,
    ACTION_ICONS,
    ACTION_LABELS,
    actionForStatus
} from './icons';
import type { FileState, FileStatus } from './types';

/**
 * Set the progress-bar fill's width. Idempotent — assigning the same
 * percent twice is cheap (the browser short-circuits a no-op style write).
 */
export function patchProgressFill(
    row: HTMLElement,
    fillClass: string,
    percent: number
): void {
    const el = row.querySelector<HTMLElement>(`.${fillClass}`);
    if (el) el.style.width = `${percent}%`;
}

/**
 * Set the progress-text node's content to the rounded percent. Used by
 * list / detailed / popover where a numeric label sits next to the bar;
 * grid omits the text and only patches the fill.
 */
export function patchProgressText(
    row: HTMLElement,
    textClass: string,
    percent: number
): void {
    const el = row.querySelector(`.${textClass}`);
    if (el) el.textContent = `${percent.toFixed(1)}%`;
}

/**
 * Swap the status-icon slot's class modifier, glyph, and a11y labels when
 * the file's status changes. Gated on `dataset.status` so a 50 ms upload
 * tick with no status change is a no-op (avoids re-injecting SVG strings
 * each frame).
 */
export function patchStatusIcon(
    row: HTMLElement,
    statusClass: string,
    status: FileStatus
): void {
    const el = row.querySelector<HTMLElement>(`.${statusClass}`);
    if (!el || el.dataset.status === status) return;
    el.dataset.status = status;
    el.className = `${statusClass} ${statusClass}--${status}`;
    el.title = STATUS_LABELS[status];
    el.setAttribute('aria-label', `Status: ${STATUS_LABELS[status]}`);
    el.innerHTML = STATUS_ICONS[status];
}

/**
 * In-place patch the per-row action button (pause / resume / retry) as the
 * file's status transitions. Slot stays in the DOM at all times so column
 * widths don't shift across status changes; this function toggles the
 * `--hidden` modifier and swaps the glyph + a11y attributes when the
 * applicable action changes. Gated on `dataset.rowAction` so the live
 * button isn't disrupted while a user click is in flight between ticks.
 */
export function patchActionButton(
    btn: HTMLElement | null,
    file: FileState,
    baseClass: string
): void {
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
