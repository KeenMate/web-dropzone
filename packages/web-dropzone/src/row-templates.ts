/**
 * Shared row templates for the file list — used by both the satellite
 * `<web-dropzone-list>` and the convenience-form renderer inside
 * `<web-dropzone>`. Both surfaces emit identical DOM so the styles in
 * `_file-item.css` (icon box, info column, progress bar wrapper, slot-
 * reserving action button, status icon, remove button) light up in either.
 *
 * Why this module exists: the satellite originally hand-rolled its own
 * row HTML with subtly different class names (`__main` vs `__info`, no
 * `__progress-bar` wrapper, no slot reservation for the action button),
 * which silently dropped most of the styling. Keeping the templates here
 * means future tweaks land in one place and the compiler enforces the
 * shape for both callers.
 *
 * The popover/compact row (`<tr>` with `<td>` cells) is NOT shared — it
 * has a completely different DOM shape and only the convenience form
 * uses it. See `WebDropzone.renderCompactItem`.
 */

import {
    formatFileSize,
    getFileTypeCategory,
    getFileIcon,
    isImageFile,
    escapeHtml,
    STATUS_ICONS,
    STATUS_LABELS,
    ACTION_ICONS,
    ACTION_LABELS,
    actionForStatus
} from '@keenmate/web-dropzone-core';
import type { FileState } from '@keenmate/web-dropzone-core';

export { escapeHtml };

/**
 * Per-row knobs that vary between the convenience form and the satellite.
 * All optional — sensible defaults make the satellite (which doesn't need
 * the reorder / non-removable concepts yet) a one-argument call.
 */
export interface RowTemplateOptions {
    /**
     * Stamp `data-reorder-bucket="complete"` on the row so the flexbox
     * `order` rule can slide completed rows to the end of the list. Only
     * the convenience form uses this today (config-driven feature); the
     * satellite leaves it false.
     */
    reorderEligible?: boolean;
    /**
     * Whether the user can interactively remove this file. When false the
     * remove button is still rendered (column width stays reserved) but
     * stamped with the `--hidden` modifier (visibility: hidden + inert).
     * Defaults to true — the satellite doesn't expose the
     * `isUploadedFileDeletable` config yet, so removal is always allowed.
     */
    removable?: boolean;
    /**
     * Render an `<img>` of `file.previewUrl` when present (and the file is
     * an image), else fall back to the file-type emoji. Defaults to false
     * for list / detailed / badges (icon-only by convention) and true for
     * grid (image grid wants thumbnails by default).
     */
    useThumbnail?: boolean;
}

/**
 * Inner content for the icon slot — `<img>` when thumbnail mode is on and
 * the file already has a preview URL, else the file-type emoji.
 */
export function renderPlaceholderInner(file: FileState, useThumbnail: boolean): string {
    if (useThumbnail && file.previewUrl) {
        return `<img src="${file.previewUrl}" alt="">`;
    }
    return getFileIcon(file.file);
}

/**
 * Per-row action button (pause / resume / retry). The slot is ALWAYS in
 * the DOM so column widths stay reserved as state transitions. When
 * there's no applicable action (pending / complete / cancelled) the
 * `--hidden` modifier hides the button visually and drops it from the
 * tab order.
 */
export function renderRowActionButton(file: FileState, baseClass: string): string {
    const action = actionForStatus(file.status);
    const hidden = !action;
    const cls = hidden ? `${baseClass} ${baseClass}--hidden` : baseClass;
    const inert = hidden ? ' tabindex="-1" aria-hidden="true"' : '';
    const label = action ? `${ACTION_LABELS[action]} ${escapeHtml(file.name)}` : '';
    const title = action ? ACTION_LABELS[action] : '';
    const dataAction = action ?? '';
    const icon = action ? ACTION_ICONS[action] : '';
    return `<button type="button" class="${cls}" data-action="row-action" data-row-action="${dataAction}" data-file-id="${file.id}" aria-label="${label}" title="${title}"${inert}>${icon}</button>`;
}

/**
 * Attribute block for the always-rendered remove button. Hidden buttons
 * stay in the DOM (layout reserved) but are inert.
 */
export function removeButtonAttrs(file: FileState, baseClass: string, removable = true): string {
    const cls = removable ? baseClass : `${baseClass} ${baseClass}--hidden`;
    const inert = removable ? '' : ' tabindex="-1" aria-hidden="true"';
    return `class="${cls}" data-action="remove" data-file-id="${file.id}" aria-label="Remove ${escapeHtml(file.name)}"${inert}`;
}

export function renderListItem(file: FileState, opts: RowTemplateOptions = {}): string {
    const reorderAttr = opts.reorderEligible ? ' data-reorder-bucket="complete"' : '';
    const removable = opts.removable !== false;
    return `
        <div class="dz__file-item dz__file-item--list" data-file-id="${file.id}" data-status="${file.status}"${reorderAttr}>
            <span class="dz__file-item__name">${escapeHtml(file.name)}</span>
            ${renderRowActionButton(file, 'dz__file-item__action')}
            <div class="dz__file-item__progress">
                <div class="dz__file-item__progress-bar">
                    <div class="dz__file-item__progress-fill" style="width: ${file.progress}%"></div>
                </div>
                <span class="dz__file-item__progress-text">${file.progress.toFixed(1)}%</span>
            </div>
            <span class="dz__file-item__status dz__file-item__status--${file.status}" title="${STATUS_LABELS[file.status]}" aria-label="Status: ${STATUS_LABELS[file.status]}" data-status="${file.status}">${STATUS_ICONS[file.status]}</span>
            <button type="button" ${removeButtonAttrs(file, 'dz__file-item__remove', removable)}></button>
        </div>
    `;
}

export function renderDetailedItem(file: FileState, opts: RowTemplateOptions = {}): string {
    const category = getFileTypeCategory(file.file);
    const useThumbnail = opts.useThumbnail ?? false;
    const inner = renderPlaceholderInner(file, useThumbnail);
    const reorderAttr = opts.reorderEligible ? ' data-reorder-bucket="complete"' : '';
    const removable = opts.removable !== false;
    return `
        <div class="dz__file-item dz__file-item--detailed" data-file-id="${file.id}" data-status="${file.status}"${reorderAttr}>
            <div class="dz__file-item__icon dz__file-item__icon--${category}">${inner}</div>
            <div class="dz__file-item__info">
                <div class="dz__file-item__name">${escapeHtml(file.name)}</div>
                <div class="dz__file-item__meta">
                    <span class="dz__file-item__size">${formatFileSize(file.size)}</span>
                    <span class="dz__file-item__type">${escapeHtml(file.type || 'Unknown')}</span>
                </div>
                <div class="dz__file-item__progress">
                    <div class="dz__file-item__progress-bar">
                        <div class="dz__file-item__progress-fill" style="width: ${file.progress}%"></div>
                    </div>
                    <span class="dz__file-item__progress-text">${file.progress.toFixed(1)}%</span>
                </div>
            </div>
            ${renderRowActionButton(file, 'dz__file-item__action')}
            <span class="dz__file-item__status dz__file-item__status--${file.status}" title="${STATUS_LABELS[file.status]}" aria-label="Status: ${STATUS_LABELS[file.status]}" data-status="${file.status}">${STATUS_ICONS[file.status]}</span>
            <button type="button" ${removeButtonAttrs(file, 'dz__file-item__remove', removable)}></button>
        </div>
    `;
}

export function renderGridItem(file: FileState, opts: RowTemplateOptions = {}): string {
    const isImage = isImageFile(file.file);
    const useThumbnail = opts.useThumbnail ?? true;
    const reorderAttr = opts.reorderEligible ? ' data-reorder-bucket="complete"' : '';
    const removable = opts.removable !== false;
    const inner = isImage && useThumbnail && file.previewUrl
        ? `<img src="${file.previewUrl}" alt="${escapeHtml(file.name)}" class="dz__preview-item__image">`
        : `<div class="dz__preview-item__placeholder">${getFileIcon(file.file)}</div>`;
    return `
        <div class="dz__preview-item ${isImage ? 'dz__preview-item--image' : ''}" data-file-id="${file.id}" data-status="${file.status}"${reorderAttr}>
            ${inner}
            <div class="dz__preview-item__scrim" aria-hidden="true"></div>
            <div class="dz__preview-item__overlay">
                <span class="dz__preview-item__name">${escapeHtml(file.name)}</span>
            </div>
            <span class="dz__preview-item__status dz__preview-item__status--${file.status}" title="${STATUS_LABELS[file.status]}" aria-label="Status: ${STATUS_LABELS[file.status]}" data-status="${file.status}">${STATUS_ICONS[file.status]}</span>
            <div class="dz__preview-item__progress-bar">
                <div class="dz__preview-item__progress-fill" style="width: ${file.progress}%"></div>
            </div>
            <div class="dz__preview-item__hover-actions">
                ${renderRowActionButton(file, 'dz__preview-item__action')}
                <button type="button" ${removeButtonAttrs(file, 'dz__preview-item__remove', removable)}></button>
            </div>
        </div>
    `;
}

export function renderBadgeItem(file: FileState, opts: RowTemplateOptions = {}): string {
    const statusClass = file.status !== 'pending' ? `dz__badge--${file.status}` : '';
    const useThumbnail = opts.useThumbnail ?? false;
    const inner = renderPlaceholderInner(file, useThumbnail);
    const reorderAttr = opts.reorderEligible ? ' data-reorder-bucket="complete"' : '';
    const removable = opts.removable !== false;
    return `
        <span class="dz__badge ${statusClass}" data-file-id="${file.id}" data-status="${file.status}"${reorderAttr}>
            <span class="dz__badge-text" title="${escapeHtml(file.name)}">
                <span class="dz__badge-icon">${inner}</span>
                <span class="dz__badge-name">${escapeHtml(file.name)}</span>
                ${renderRowActionButton(file, 'dz__badge-action')}
                <span class="dz__badge-status dz__badge-status--${file.status}" title="${STATUS_LABELS[file.status]}" aria-label="Status: ${STATUS_LABELS[file.status]}" data-status="${file.status}">${STATUS_ICONS[file.status]}</span>
            </span>
            <button type="button" ${removeButtonAttrs(file, 'dz__badge-remove', removable)}></button>
        </span>
    `;
}
