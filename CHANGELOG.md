# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking Changes

- **Internal config keys renamed to KM house-style `is*` prefix** — `multiple` → `isMultipleEnabled`, `disabled` → `isDisabled`, `filesInside` → `isFilesInsideEnabled`. HTML attributes (`multiple`, `disabled`, `files-inside`) are unchanged, so declarative usage continues to work. JavaScript property setters on the element (`.multiple`, `.disabled`, `.filesInside`) also continue to work — only the internal `DropzoneConfig` keys passed to the core `WebDropzone` class changed.

- **`updateConfig(partial)` signature** — now returns `boolean` (matches the KM family convention where `false` would signal a structural change needing reinit; dropzone applies every change in-place so it always returns `true`).

- **Filename-string hidden inputs removed** — the previous form integration appended hidden `<input type="hidden">` elements carrying filename strings (controlled by `valueFormat="json"|"csv"|"array"`). These conflicted with the new `FormData` mechanism described below. Forms now submit real `File` blobs under the configured `name` attribute. The `value-format` attribute is preserved for future use but no longer drives hidden inputs.

- **`.dz__dropzone` no longer carries card-specific visual styling** — padding, border, background, hover, active and `:focus-within` states moved to `.dz__dropzone--card`. The base `.dz__dropzone` class is now just a positioning context for the hidden `<input>` and a bubble-up event target. This was needed so the new `button` and `minimal` selectors don't inherit drop-zone chrome (border, hover bg, focus ring) they have no business showing.

- **`list-appearance="chips"` renamed to `list-appearance="badges"`** — class names and CSS variables follow web-multiselect's badge surface so themes carry across the two components:
  - `.dz__chip` → `.dz__badge`, `.dz__chip__text` → `.dz__badge-text`, `.dz__chip__icon` → `.dz__badge-icon`, `.dz__chip__name` → `.dz__badge-name`, `.dz__chip__remove` → `.dz__badge-remove`
  - Status modifiers `.dz__chip--{complete,error,uploading}` → `.dz__badge--{…}`
  - Container class `.dz__file-list--chips` → `.dz__file-list--badges`
  - All `--dz-chip-*` and `--dz-chips-gap` variables renamed to `--dz-badge-*` / `--dz-badges-gap`. The badge surface uses multiselect's hyphen sub-element convention (`badge-text` not `badge__text`) for theme portability — this differs from the rest of web-dropzone's BEM `__` style.

- **Size / count attributes renamed for parallelism** — to make the size and count clusters read consistently with their `min-*` / `max-*` / `max-total-*` siblings:
  - `max-size` → `max-file-size` (config key `maxSize` → `maxFileSize`)
  - `max-files` → `max-file-count` (config key `maxFiles` → `maxFileCount`)
  - JS reflection getters / setters renamed to match (`.maxFileSize`, `.maxFileCount`)
  - All example pages and README references updated

### Added

- **Orthogonal display-axis attributes** — file selection UI is now split into three independent axes:
  - `selector-appearance` — `card` (default, drop-zone) | `button` | `minimal` (icon)
  - `list-appearance` — `list` (default) | `detailed` | `grid` | `badges` | `popover` | `none`
  - `card-size` — `minimal` | `compact` (default) | `big`
  - The legacy `display-mode` attribute is still supported as a single-axis shorthand. When both are set, the explicit orthogonal attribute wins.

- **Button selector family** — `selector-appearance="button"` renders an accent-styled "Select files" button instead of a drop zone. No drag-and-drop on the button itself (file picker only).
  - New attribute `select-files-text` (default: "Select files") for the button label.

- **Minimal selector family** — `selector-appearance="minimal"` renders an icon-only button with an optional file-count badge. Click opens the picker; when paired with `list-appearance="popover"` and files exist, click toggles the popover.

- **Badges list appearance** — `list-appearance="badges"` displays picked files as composite removable badges. Class names (`.dz__badge`, `.dz__badge-text`, `.dz__badge-remove`) and CSS variables (`--dz-badge-*`) mirror web-multiselect's badge surface so a theme written against multiselect carries over. Useful for inline attachment UIs (Slack/Gmail patterns).

- **`show-thumbnails` attribute** — three-state image-preview flag for the file-list placeholder slot:
  - omitted → "auto" (on for `list-appearance="grid"`, off elsewhere — preserves prior grid behavior)
  - present / `="true"` → image files render their data-URL thumbnail in the slot, non-images fall back to the file-type icon
  - `="false"` → always icon, never thumbnail (even in grid)
  - Each list appearance has a single fixed-size placeholder slot driven by one CSS variable (`--dz-badge-icon-size`, `--dz-item-icon-size`, `--dz-popover-icon-size`). Setting the size to `0` collapses the slot entirely — no icon, no thumbnail.

- **`none` list appearance** — `list-appearance="none"` renders only the selector; the caller is responsible for displaying picked files (via the `.files` getter and `change` event).

- **Card density variants** — `card-size="minimal"` (single thin row), `card-size="compact"` (default), `card-size="big"` (tall showcase with explicit Browse button). Big card exposes a dedicated Browse button styled with the accent color.

- **Form-associated custom element** — `static formAssociated = true` + `ElementInternals.setFormValue()`. The element now participates in standard form lifecycle:
  - Submitting the surrounding `<form>` sends each selected file as a real `File` blob under the configured `name` attribute (same wire format as a native `<input type="file" multiple>`)
  - `formResetCallback()` calls `clear()` so `form.reset()` empties the selection
  - The element is visible in `form.elements` for programmatic access

- **`ATTRIBUTE_TABLE` pattern** — single source of truth for HTML attribute → config option mapping. Drives `observedAttributes`, initial parse, and `attributeChangedCallback`. Matches web-multiselect / web-daterangepicker conventions, so adding a new attribute is a one-line change to the table.

- **In-place attribute updates** — `attributeChangedCallback` now calls `updateConfig(partial)` to apply changes without destroying and recreating the underlying dropzone instance. Selection, drag state, and popover state survive attribute mutations.

- **DOM-row patching for progress / status updates** — `updateFileProgress(id, n)` and `setFileStatus(id, status, error?)` now patch only the affected file's row (in both the inline list and the open popover, if any) instead of rebuilding the entire list. Critical for upload pipelines that emit progress events at sub-100ms intervals across many files.

- **`customStylesCallback` injection at the top of the shadow root** — previously appended at the bottom, which broke `@import` and `@font-face` (both must appear at the top of a stylesheet). Now prepended, replacing any previously injected sheet on update.

- **`--dz-overlay-*` CSS variables** — drag-overlay colors / borders / sizes are now themed via:
  - `--dz-overlay-bg` (defaults to `color-mix(in srgb, var(--dz-accent-color) 92%, transparent)`)
  - `--dz-overlay-border`, `--dz-overlay-border-radius`, `--dz-overlay-color`
  - `--dz-overlay-icon-size`, `--dz-overlay-text-font-size`, `--dz-overlay-text-font-weight`
  - `--dz-overlay-gap`, `--dz-overlay-z-index`

- **New CSS variables for orthogonal display axes** — `--dz-button-padding`, `--dz-button-font-size`, `--dz-minimal-size`, `--dz-minimal-icon-size`, `--dz-badge-*` (height, border-radius, text/remove half splits, icon-size — mirrors `--ms-badge-*`), card-size variants (`--dz-dropzone-card-{minimal,big}-{min-height,padding,icon-size,text-font-size}`).

- **Size / count validation cluster aligned with FluentUI's `InputFile`**:
  - **`min-file-size` / `minFileSize`** — reject files below N bytes (e.g. empty / corrupt zero-byte uploads). `code: 'size'`.
  - **`max-total-size` / `maxTotalSize`** — aggregate cap across the entire selection. processFiles() seeds a running total from existing files and increments per accepted file, so two files that each fit individually can't both squeak in past a cap that only one satisfies. `code: 'size'`. Mirrors svelte-fluentui's `InputFile.totalMaxSize`.
  - **`min-file-count` / `minFileCount`** — form-validity floor (not an add-time rejection). When `files.length < N`, the custom element calls `ElementInternals.setValidity({ valueMissing: true }, 'At least N files required')` so the surrounding form refuses to submit until met. Mirrors svelte-fluentui's `InputFile.minFiles`. Validity is re-synced on every files change and on `min-file-count` attribute change.
  - Limits hint in the popover now composes all caps + **dynamic "X left"** for `max-total-size` (e.g. `up to 5 MB total · 2.3 MB left`) and `max-file-count` (e.g. `up to 10 files · 7 left`) once files exist. The hint surface also picks up `min-file-size` (`min 1 KB each`) and `min-file-count` (`at least 3 files`).

- **`max-visible-files` attribute + "Show N more" toggle** — caps the rendered file rows and reveals the rest behind an end-of-list toggle. Mirrors svelte-fluentui's `InputFile.maxVisible`.
  - Attribute `max-visible-files` / config key `maxVisibleFiles` (int, default `7`; set to `0` to disable the cap and render every file)
  - Applies to inline list appearances (list/detailed/grid) — full-width "Show 5 more" / "Show less" button at the bottom (`.dz__show-more`); badges mode renders a compact "+5" / "−" counter pill (`.dz__badge--more`) that flows with the badge row
  - The popover is intentionally exempt — it already has an internal scroll container (`overflow-y: auto` on `.dz__popover__body` between fixed header + footer), so capping rows there would just add a redundant click. The popover renders every file.
  - Toggle state (`showAllList`) persists across add/remove and resets on `clear()`
  - New CSS vars: `--dz-show-more-{padding,margin-top,font-size,font-weight,color,bg,bg-hover,border,border-radius}`, `--dz-badge-more-{bg,color,bg-hover}`

- **`--dz-file-list-max-height` CSS variable** — caps the inline file-list container height with internal scroll. Default `none` (grow with content). Set to a length (e.g. `30rem`) to enable. Intentionally CSS-only (no companion HTML attribute) so there's a single mechanism for sizing. The popover keeps its own `--dz-popover-max-height` knob.

- **Filename dedupe on add** — `processFiles()` now rejects files whose name already exists in the selection (or appears twice within the same incoming batch). Without this, a repeat drop or "Add more" pick of `report.pdf` would queue two copies and upload it twice. Controlled by:
  - New attribute `dedupe-mode` / config key `dedupeMode`:
    - `'name'` (default) — reject if filename matches an existing file
    - `'name-size'` — reject only if both name AND size match (safer for distinct files that happen to share a name)
    - `'none'` — opt out, matches native `<input type="file">` behavior
  - Duplicates surface through the existing `files-rejected` event with `code: 'duplicate'` so existing rejection-handling UI still works
  - `ValidationResult.code` union extended with `'duplicate'`

- **Unified × remove-button glyph** — `.dz__file-item__remove`, `.dz__preview-item__remove`, and `.dz__popover__remove` now paint their × via the same `--dz-icon-remove` SVG mask used by `.dz__badge-remove` (and `.ms__badge-remove` in web-multiselect). The literal `×` text character is gone — the glyph is a CSS-mask `::before` that inherits the button's current color, so theming a single SVG re-skins every remove icon across the component family. New per-context size vars: `--dz-item-remove-icon-size`, `--dz-preview-remove-icon-size`, `--dz-popover-remove-size`/`-icon-size`/`-bg`/`-bg-hover`/`-color`/`-color-hover`. The old `--dz-item-remove-font-size` was renamed to `--dz-item-remove-icon-size`.

- **FluentUI-aligned popover shell** — `list-appearance="popover"` now matches the structure of svelte-fluentui's `InputFile` popover:
  - Header shows a live file-count label (`3 files`) instead of the static `Selected Files` title
  - `Add more` text button in the header opens the picker without dismissing the popover (the outside-click handler now also excludes the hidden `<input type="file">` so the synthesised click from `inputEl.click()` doesn't race the dismiss)
  - `Clear all` no longer rendered in destructive red — both header buttons share a flat text-button style (`--dz-popover-action-*`)
  - One-line limits hint under the header restates `accept` / `max-size` / `max-files` (falls back to `hintText` if set). Auto-hidden when there's nothing to show
  - Sticky-style overall-totals footer at the bottom: file count + total bytes. Auto-hidden when empty
  - Popover layout is a flex column with `header (auto) | body (flex:1, overflow:auto) | footer (auto)` — short lists size to content, long lists scroll between fixed header and footer
  - `updatePopoverContent()` now refreshes the count label and totals footer alongside the rows, and `processFiles()` calls it when the popover is open so adding files via "Add more" updates immediately

- **New popover CSS variables** — `--dz-popover-header-gap`, `--dz-popover-limits-padding/font-size/color/line-height`, `--dz-popover-action-padding/font-size/font-weight/color/bg-hover/border-radius`, `--dz-popover-actions-gap`, `--dz-popover-footer-padding/bg/border-top/font-size/color`.

- **Hub-style example pages** — restructured the demo site to match the web-multiselect family layout:
  - `index.html` rebuilt as a landing hub with a topic-card registry
  - `examples-shared.css` provides the shared visual shell (gradient header, `.card` panels, form groups, code blocks, notes, responsive grids)
  - Ten dedicated topic pages: `examples-{classic,validation,form-integration,templating,drag-overlay,compact,sizes,base-variables,theming,logging}.html`

### Changed

- **Popover arrow removed** — `.dz__popover__arrow` element, Floating UI `arrow` middleware wiring, and `--dz-popover-arrow-{size,bg}` CSS vars all gone. The popover now sits as a clean floating panel with no pointer back at the trigger; the trigger's own hover/active states are sufficient for the relationship to read.

- **`examples-shared-toast.js` — minimal in-page toast service for the demo pages** — vanilla JS, no deps, one file. `toast.info / success / warn / error (message, { title?, timeout? })`. Wired into `examples-classic.html` so every dropzone's `files-rejected` event surfaces as a grouped toast (one per rejection code, with "+N more" when several files share a reason). Useful for seeing `max-file-count` overflow, dedupe, and per-file validation in action.

- **Badge typography + dimensions aligned with web-multiselect** — the badge surface now reads as part of the same component family rather than a heavier dropzone-specific variant:
  - `--dz-badge-font-size`: `base-font-size-sm` (1.4) → `base-font-size-xs` (1.2) — tighter, control-style glyphs
  - `--dz-badge-font-weight`: `medium` (500) → `semibold` (600) — matches `--ms-badge-font-weight`
  - `--dz-badge-remove-width`: `2.4 × rem` → `2.7 × rem` — square pill end equal to badge height (matches `--ms-badge-remove-width`)
  - `--dz-badge-icon-size`: `1.8 × rem` → `1.4 × rem`, `--dz-badge-icon-font-size`: `1.4 × rem` → `1.2 × rem` — proportionate to the new font
  - `--dz-badge-text-bg-hover`: `--dz-primary-bg-hover` (grey) → `--dz-accent-color-light-hover` (on-brand tint)

- **Badge default radius now tracks the dropzone card** — `--dz-badge-border-radius` defaulted to `999px` (pill); now defaults to `var(--dz-dropzone-border-radius)` so the badge and card surfaces share one rounded language. Override `--dz-badge-border-radius: 999px;` to restore the pill shape, or set `0` for square. Multiselect parity is preserved on the variable surface — only the default value differs (multiselect uses `--ms-border-radius-sm`).

- **Drag-overlay positioning uses CSS variables** — `_modifiers.css` owns the overlay layout (`position: fixed`, `z-index`, colors, padding, gap); only the rect-derived inline positions (`top`, `left`, `width`, `height`) are set inline from `getBoundingClientRect`.

- **CLAUDE.md rewritten** — reflects actual current state (no dead `<T>` generic claims, no references to deleted `multiselect.ts` / `virtual-scroll.ts`, no stale `previewCache` mention, accurate CSS file list, ATTRIBUTE_TABLE flow documented).

### Fixed

- **CSS specificity leaks onto button / minimal selectors**:
  - `.dz__host button` base reset (`background: none; border: none; padding: 0`) had specificity (0,1,1), beating the new `.dz__button` / `.dz__minimal` class rules (0,1,0) — leaving the accent button invisible and the minimal selector borderless. Wrapped the reset in `:where()` so its specificity drops to (0,0,0) and any class-targeted rule trivially wins.
  - `.dz__dropzone:hover:not(.dz__dropzone--disabled)` from the card base painted a hover background on the button / minimal wrappers. Moved to `.dz__dropzone--card:hover:not(...)` so it only applies to the card family.
  - `.dz__dropzone:focus-within` outlined the entire button / minimal wrapper on keyboard focus, doubling up with the button's own `:focus-visible` ring. Scoped to `.dz__dropzone--card:focus-within`.

- **Button / minimal wrapper full-width stretching** — the wrapper is `display: inline-block` but was being stretched to the full width of the parent `.dz__container` because flex containers default to `align-items: stretch`. Added `align-self: start` to both `.dz__dropzone--button` and `.dz__dropzone--minimal` so they take their natural content width.

- **Popover "Add more" picked files but didn't add them** — the popover's `Add more` handler called `inputEl.click()` to open the native picker. The resulting synthetic click bubbled back through the dropzone (where the input is mounted) and hit `handleClick`, which called `inputEl.click()` *again*. The second call within the same user-activation tick replaced the in-flight file dialog, so when the user finished picking files the `change` event arrived with an empty FileList. Added a `e.target === this.inputEl` short-circuit at the top of `handleClick` so the synthetic click is acknowledged once and not re-fired. Also fixes the same latent recursion on the standard card-click → browse flow.

- **`max-file-count` overflow rejected the entire batch instead of just the overflow** — `validateFile()` returned `code: 'count'` as soon as `files.length >= maxFiles`, so dropping 5 files into a zone with 3 free slots rejected ALL 5 instead of accepting the first 3 and rejecting the 2 overflow files. The count check moved into `processFiles()` and now tracks a `runningCount` that accepts what fits and rejects only the remainder. Matches FluentUI's `addFiles()` semantics.

- **`accept="*/*"` rejected every file** — `isFileTypeAccepted()` matched `*/*` against the generic MIME-wildcard branch (`endsWith('/*')`), stripping the suffix to produce the bogus prefix `*/` and then comparing it against `file.type.startsWith('*/')` — always false. Every file was silently rejected via `files-rejected`, leaving the file list permanently on the "No files selected" empty state. Added a universal-wildcard short-circuit so `*` and `*/*` both mean "accept anything", and a no-op early return when the trimmed accept list is empty.

- **Grid mode thumbnails never refreshed** — `generatePreview()` only re-rendered the list when the legacy `displayMode === 'grid'`, so setting only the new `list-appearance="grid"` (without `display-mode="grid"`) left each tile permanently on the placeholder icon. Switched to `patchFileRow(file)` — single-row patch via the existing diff path that works for any axis configuration and any list appearance.

- **Popover closed itself on the opening click** — `handleDocumentClick` checked `summaryEl.contains(e.target)`, but the document-level event is re-targeted to the shadow host so `target` is `<web-dropzone>`, never the summary line inside the shadow root. The check always failed and the very click that opened the popover closed it on the same tick. Switched to `e.composedPath()` (walks through the shadow tree) and used the resolved popover anchor as the trigger element, so the same fix works for `card+popover`, `button+popover`, and `minimal+popover`.

### Removed

- **Hidden-input form-integration mechanism** — `updateHiddenInputs()` and the `hiddenInputs: HTMLInputElement[]` field are gone (~45 lines). Filename strings were never a valid replacement for File blobs — the new form-associated `setFormValue(formData)` carries the actual files. The `value-format` attribute / `valueFormat` config key are preserved for future use but no longer wire up any hidden inputs.

- **`isInitialized` field on `DropzoneElement`** — `this.dropzone` is the canonical "initialized" check; the parallel boolean drifted out of sync in edge cases (re-init from a property setter, etc.).

- **Per-attribute manual `attributeChangedCallback` branches** — replaced by the table-driven flow. Adding or removing an attribute is now a single-line change to `ATTRIBUTE_TABLE`.

## [1.6.1] - 2025-12-13

### Fixed

- **Complete Theming Variable Cascade** - All hardcoded colors now respect `--base-*` variables
  - Setting `--base-*` variables from theme-designer properly cascades throughout the component
  - Dark themes, custom accent colors, and other theming scenarios now work correctly

- **Accent Color Theming** - Fixed hardcoded accent colors (`#3b82f6`, `#2563eb`)
  - Checkboxes, badges, counters, focus rings, hover states now use `var(--ms-accent-color)`
  - RGBA values converted to `color-mix(in srgb, var(--ms-accent-color) X%, transparent)`

- **Badge Hover Theming** - Badge hover backgrounds now respect themes
  - Was hardcoded to `#ffffff`, now uses `var(--base-badge-background-hover, var(--ms-input-background))`

- **Checkbox Theming** - Checkboxes now inherit theme colors
  - Background uses `var(--ms-input-background)` instead of `#ffffff`
  - Border uses `var(--ms-border-color)` instead of `#d1d5db`
  - Disabled state uses `var(--ms-primary-bg)` instead of `#e5e7eb`

- **Badge Counter Theming** - Badge counter variant now uses semantic variables
  - Text background, remove button colors now flow from `--ms-text-color-*` and `--ms-primary-bg`

- **Scrollbar Theming** - Scrollbar thumb now uses `var(--ms-border-color)`

- **Checkbox Checkmark Position** - Adjusted checkmark position from `top: 45%` to `top: 40%` for better visual alignment

### Removed

- **Redundant `-bg` Alias Variables** - Cleaned up duplicate variables for simpler architecture
  - Removed: `--ms-input-bg`, `--ms-hint-bg`, `--ms-dropdown-bg`, `--ms-actions-bg`, `--ms-tooltip-bg`, `--ms-selected-popover-bg`
  - Use the `-background` semantic variables directly (e.g., `--ms-dropdown-background`)

### Added

- **Accent Color Light Variants** - New CSS variables for light accent backgrounds
  - `--ms-accent-color-light: var(--base-accent-color-light, #eff6ff);`
  - `--ms-accent-color-light-hover: var(--base-accent-color-light-hover, #e0f2fe);`

### Changed

- **Theming Examples Updated** - `examples-theming.html` now demonstrates proper `--base-*` variable usage
  - All 7 themes (Dark, Neon, Audi, Rounded, Sharp, Material, Glass) use `--base-*` variables
  - Shows how themes can be defined with minimal component-specific overrides

## [1.6.0] - 2025-12-10

### Added

- **Preserve Search on Close** - New `shouldKeepSearchOnClose` option (default: `true`)
  - Search text and filtered results are preserved when dropdown closes
  - Re-opening dropdown shows the same filtered view
  - Set `should-keep-search-on-close="false"` or `shouldKeepSearchOnClose: false` for old behavior

- **Border Radius Theme Integration** - Integrated `--base-border-radius-*` variables from theme-designer
  - `--ms-border-radius-sm`: 4px - checkboxes, badges, counters, tags
  - `--ms-border-radius-md`: 6px - inputs, buttons (default)
  - `--ms-border-radius-lg`: 8px - dropdowns, popovers, hints
  - `--ms-border-radius`: backward compat alias → md
  - Pattern: `calc(var(--base-border-radius-sm, 0.4) * var(--ms-rem))`

- **Input Border Color Theme Integration** - Integrated `--base-input-border-color-*` variables from theme-designer
  - `--ms-input-border-color`: normal state → `var(--base-input-border-color, var(--ms-border-color))`
  - `--ms-input-border-color-hover`: hover state → `var(--base-input-border-color-hover, var(--ms-accent-color))`
  - `--ms-input-border-color-focus`: focus state → `var(--base-input-border-color-focus, var(--ms-accent-color))`

- **Remove Button Tooltip Customization** - New options to customize remove button tooltip text
  - `getRemoveButtonTooltipCallback`: Callback to generate custom tooltip text per item
  - `removeButtonTooltipText`: Format string with `{0}` placeholder (e.g., "Delete {0}")
  - `remove-button-tooltip-text` HTML attribute
  - Default remains "Remove {itemName}"

- **Input Size Variants** - Added five input size variants (xs, sm, md, lg, xl) with theme-designer integration
  - `--ms-input-size-xs-height`: `calc(var(--base-input-size-xs-height, 3.1) * var(--ms-rem))` (31px)
  - `--ms-input-size-sm-height`: `calc(var(--base-input-size-sm-height, 3.3) * var(--ms-rem))` (33px)
  - `--ms-input-size-md-height`: `calc(var(--base-input-size-md-height, 3.5) * var(--ms-rem))` (35px)
  - `--ms-input-size-lg-height`: `calc(var(--base-input-size-lg-height, 3.8) * var(--ms-rem))` (38px)
  - `--ms-input-size-xl-height`: `calc(var(--base-input-size-xl-height, 4.1) * var(--ms-rem))` (41px)
  - Each size also includes `-font`, `-padding-v`, `-padding-h` variables
  - Heights reference `--base-input-size-*-height` from theme-designer for consistent sizing across all KeenMate components

### Changed

- **Default Input Height** - `--ms-input-height` now references `--base-input-size-md-height` for theme-designer consistency

- **BREAKING: Migrated from SCSS to Pure CSS** - Complete removal of SCSS dependency
  - All 11 SCSS files converted to pure CSS in `src/css/` folder
  - Removed `sass-embedded` from devDependencies
  - Removed SCSS preprocessor configuration from `vite.config.ts`
  - Package exports changed: `./scss` → `./css`, `./src/scss/*` → `./src/css/*`
  - Files included: `src/css/` folder instead of `src/scss/`
  - **Migration**: If importing SCSS directly, update paths from `./scss/` to `./css/`

- **Simplified Variable Architecture** - Single source of truth for all styling
  - All SCSS `$variables` replaced with CSS custom property fallbacks
  - Pre-computed `color.mix()` values to static hex: `--ms-text-color-2: #353b47`, `--ms-text-color-4: #a0a3a9`
  - No more build-time vs runtime variable confusion
  - Theme-designer integration works correctly without SCSS interpolation overrides

- **Arrow Key Navigation** - Disabled wrap-around behavior on ArrowUp at first item
  - Previously: ArrowUp at first item jumped to last item
  - Now: ArrowUp at first item stays at first item (use Home/End to jump)

### Fixed

- **Tooltip Remains After Badge Removal** - Fixed tooltip staying visible when clicking remove button
  - Root cause: `showTimeout` and `hideTimeout` were local closure variables not cleared on cleanup
  - Added `badgeTooltipShowTimeouts` and `badgeTooltipHideTimeouts` Maps to track pending timeouts
  - `destroyAllBadgeTooltips()` now clears all pending timeouts before removing elements
  - `cleanupBadgeTooltip()` now clears specific timeouts for the tooltip being cleaned up

- **Badge Text Border Clipping** - Fixed top/bottom borders being hidden on `.ms__badge-text`
  - Root cause: `height: 100%` + border caused total height to exceed parent's fixed height with `overflow: hidden`
  - Added `box-sizing: border-box` to `.ms__badge-text` and `.ms__badge-remove`
  - Full border now visible on badge text and remove button

- **Text Color Levels Not Applying** - Fixed `--ms-text-color-1` through `--ms-text-color-4` not cascading to option titles/subtitles
  - Root cause: SCSS interpolation was overriding CSS variable fallback chains
  - Solution: Pure CSS removes the conflict entirely

- **Virtual Scroll Search Bug** - Fixed issue where searching for non-existent term broke subsequent searches
  - Root cause: When `filteredOptions.length === 0`, normal rendering was used (not virtual scroll), but `virtualScroll` instance wasn't destroyed
  - Clearing search caused virtual scroll to render to orphaned DOM elements
  - Added cleanup in `renderDropdown()` when transitioning from virtual scroll to normal rendering

- **Virtual Scroll Keyboard Navigation** - Fixed arrow key navigation not scrolling beyond visible area
  - `setItems()` no longer resets scroll position when items haven't changed (e.g., focus change)
  - `scrollToIndex()` now implements `scrollIntoView({ block: 'nearest' })` behavior - only scrolls if item is outside viewport

- **Checkbox Alignment Default** - Fixed `--ms-checkbox-align` fallback incorrectly set to `flex-start` instead of `center`
- **Options Padding Default** - Changed `--ms-options-padding` default from `calc(0.4 * var(--ms-rem)) 0` to `0`
- **Dropdown Border Cascading** - Fixed `--ms-dropdown-border` now uses `var(--base-dropdown-border, ...)` to respect theme-designer settings
- **Selected Option Title Color** - Added `--ms-option-title-color-selected` and `--ms-option-title-color-selected-hover` CSS rules so title text properly uses contrasted color (e.g., white) on selected accent background

### Removed

- **SCSS Files** - Deleted entire `src/scss/` folder (11 files, ~2,600 lines)
  - `_variables.scss`, `_css-variables.scss`, `_base.scss`, `_input-dropdown.scss`
  - `_options.scss`, `_badges-display.scss`, `_tooltips-popover.scss`
  - `_modifiers.scss`, `_rtl.scss`, `_debug.scss`, `main.scss`

- **Redundant Option Color Variables** - Removed container-level selected color variables in favor of element-specific ones
  - Removed: `--ms-option-color-selected`, `--ms-option-color-selected-hover`, `--ms-option-color-selected-focused`, `--ms-option-color-selected-matched`, `--ms-option-color-disabled-selected`
  - Color inheritance for selected options now handled by `--ms-option-title-color-selected` and `--ms-option-subtitle-color-selected`

### Performance

- **Faster Builds** - 375ms vs 851ms (no SCSS compilation)
- **Smaller Bundle** - 165KB vs 171KB JS bundle

## [1.5.1] - 2025-12-08

### Fixed

- **Option Content Alignment** - Fixed `.ms__option-content` not centering icon and text vertically
  - Changed `align-items` from `flex-start` to `center`
  - This was accidentally reverted in 1.5.0 during debugging

## [1.5.0] - PUBLISHED - 2025-12-08

### Changed

- **BREAKING: Default Option Alignment Changed to Center** - Options now vertically center by default
  - Changed `--ms-checkbox-align` default from `flex-start` to `center`
  - Checkbox, icon, and text now align vertically centered by default
  - For top alignment (tall custom templates), use `checkbox-align="top"`
  - CSS variant `[data-checkbox-align="center"]` replaced with `[data-checkbox-align="top"]`

- **Faster Badge Tooltips** - Default tooltip delay reduced from 300ms to 100ms
  - Applies to both badge tooltips and "+X more" badge tooltips
  - Configurable via `badge-tooltip-delay` attribute

### Fixed

- **Virtual Scroll Option Height** - Fixed `option-height` attribute not applying in virtual scroll mode
  - CSS variable was using old prefix `--ml-option-height` instead of `--ms-option-height`
  - Custom `option-height` values now correctly apply to virtual scroll items

- **Badge Tooltips in Selected Popover** - Fixed tooltips not appearing on badges in the selected items popover
  - Tooltips now work in both standard popover (< 100 items) and virtual scroll popover (100+ items)
  - `attachBadgeTooltips()` now accepts optional container parameter

## [1.5.0-rc01] - RELEASED - 2025-12-08

### Changed

- **BREAKING: Simplified Sizing System** - Removed `input-size` attribute and `--ms-input-size-*` CSS variables
  - Removed `input-size` attribute (`xs`, `sm`, `md`, `lg`, `xl`)
  - Removed `--ms-input-size-{size}-font`, `--ms-input-size-{size}-padding-v`, `--ms-input-size-{size}-padding-h`, `--ms-input-size-{size}-height` variables
  - Removed `.ms--size-xs`, `.ms--size-sm`, `.ms--size-lg`, `.ms--size-xl` modifier classes
  - **Migration**: Use `--ms-rem` for global scaling instead (e.g., `--ms-rem: 8px` for compact, `--ms-rem: 12px` for large)

- **Typography Integration** - Font sizes now use unitless multipliers with `--base-*` fallbacks
  - Pattern: `calc(var(--base-font-size-sm, 1.4) * var(--ms-rem))`
  - Enables integration with theme-designer's typography variables
  - Affected variables: `--ms-input-font-size`, `--ms-option-title-font-size`, `--ms-badge-font-size`, etc.

- **SCSS Variable Prefix** - All SCSS variables now use `$ms-*` prefix (previously some used `$ml-*`)

### Added

- **`--ms-input-height`** - New CSS variable for input field height (previously only available via size variants)

### Fixed

- **Windows Build** - Fixed `npm run clean` failing on Windows due to rimraf glob pattern handling
  - Added `--glob` flag for `*.tgz` pattern

## [1.4.0] - 2025-11-30

### Added

- **Input Hover State** - New `--ms-input-border-color-hover` CSS variable for input border on hover
  - Hover state only applies when input is not focused and not disabled
  - Defaults to `--ms-text-secondary` (darker border on hover)

- **Badge Hover State** - New CSS variables for badge text styling on hover
  - `--ms-badge-text-background-hover` - Badge text background on hover
  - `--ms-badge-text-color-hover` - Badge text color on hover
  - Hover applies to `.ms__badge:hover .ms__badge-text`

- **Separate Badge Borders** - Badge text and remove button now have independent borders
  - `--ms-badge-text-border` - Border for the text/label part of the badge
  - `--ms-badge-remove-border` - Border for the remove (X) button part
  - Allows matching border color to each part's background for themed badges
  - Example: Light pink border on text part, dark red border on button part

### Fixed

- **CRITICAL: State-Specific Colors Not Applying** - Fixed `inherit` fallback bug causing state colors to be ignored
  - Root cause: Using `inherit` as CSS variable fallback causes element to inherit from parent's computed value, not the fallback chain
  - Affected 8 color variables: `--ms-option-color-focused-hover`, `--ms-option-color-matched-hover`, `--ms-option-color-selected-focused`, `--ms-option-color-selected-matched`, `--ms-option-color-disabled-selected`, `--ms-option-subtitle-color-hover`, `--ms-option-subtitle-color-selected`, `--ms-option-subtitle-color-selected-hover`
  - Solution: Changed to nested `var()` fallbacks (e.g., `var(--ms-option-color-selected, var(--ms-option-text-color, $ml-option-color))`)
  - State-specific colors now properly cascade: state color → parent state color → base color
  - Example: Setting `--ms-option-color-selected: #ffffff` now correctly applies to selected items

### Changed

- **BREAKING: Unified Theming Variable Rename** - Renamed `--ms-text-white` to `--ms-text-on-accent` for consistency with unified theming system across KeenMate components
  - This variable represents text color on accent-colored backgrounds (e.g., white text on blue buttons)
  - The new name better describes its purpose and matches the naming convention used in other KeenMate components (web-daterangepicker, etc.)
  - **Migration**: Find and replace `--ms-text-white` with `--ms-text-on-accent` in your stylesheets

- **Removed Redundant CSS Variables** - Removed 8 CSS custom properties that used `inherit` fallbacks
  - These variables are now optional overrides - if not set, they fall back through the CSS variable chain
  - Simplifies theming: set base color once, all states inherit automatically
  - Users can still override individual states when needed

- **Badge Border Structure** - Moved border from badge container to individual children
  - Removed `--ms-badge-border` (was on `.ms__badge` container)
  - Added `--ms-badge-text-border` (on `.ms__badge-text`)
  - `--ms-badge-remove-border` already existed (on `.ms__badge-remove`)
  - **Breaking**: If you were using `--ms-badge-border`, migrate to `--ms-badge-text-border` and `--ms-badge-remove-border`

## [1.3.0] - PUBLISHED - 2025-11-29

### Added

- **Custom Checkbox Styling** - Full control over checkbox appearance via CSS custom properties
  - `--ms-checkbox-bg` - Background color (default: `#ffffff`)
  - `--ms-checkbox-border` - Border style (default: `1px solid #d1d5db`)
  - `--ms-checkbox-border-radius` - Border radius
  - `--ms-checkbox-checked-bg` - Background when checked (default: accent color)
  - `--ms-checkbox-checked-border` - Border when checked
  - `--ms-checkbox-checkmark-color` - Checkmark color (default: `#ffffff`)
  - `--ms-checkbox-hover-border-color` - Border color on hover
  - `--ms-checkbox-disabled-bg` - Background when disabled
  - `--ms-checkbox-disabled-border` - Border when disabled
  - Custom checkbox implementation using CSS pseudo-elements for full styling control

- **Badge Border Styling** - New `--ms-badge-border` CSS variable for badge border customization
  - Default: `none` (no border)
  - Example: `--ms-badge-border: 1px solid #3b82f6;`

- **Scrollbar Theming** - Custom scrollbar styling for dropdown and popovers
  - `--ms-scrollbar-width` - Scrollbar width (default: `8px`)
  - `--ms-scrollbar-track-bg` - Track background color
  - `--ms-scrollbar-thumb-bg` - Thumb color
  - `--ms-scrollbar-thumb-bg-hover` - Thumb hover color
  - `--ms-scrollbar-thumb-border-radius` - Thumb border radius
  - Applied to `.ms__dropdown` and `.ms__selected-popover-body`

- **Option State Text Colors** - Complete color control for all option states
  - `--ms-option-color-hover` - Text color on hover
  - `--ms-option-color-focused` - Text color when focused (keyboard navigation)
  - `--ms-option-color-selected` - Text color when selected
  - `--ms-option-color-selected-hover` - Text color when hovering over selected option
  - `--ms-option-color-matched` - Text color for search matches (navigate mode)
  - Ensures proper contrast when background colors change (e.g., dark bg + white text)

- **Input Border Theming** - `--ms-input-border-style` now fully themeable
  - Full shorthand property: `1px solid #color`
  - Can be set per-theme for consistent styling

- **Toggle Icon Theming** - `--ms-toggle-icon-color` for dropdown arrow customization

- **10px-Based Sizing System** - Migrated to `--ms-rem` variable system for scalable sizing
  - New base variable `--ms-rem: 10px` enables proportional scaling across the component
  - All sizing values now use `calc(X * var(--ms-rem))` format internally
  - Input heights updated to Pure Admin standard: xs=31px, sm=33px, md=35px, lg=38px, xl=41px
  - Set `--ms-rem: 1rem` for Pure Admin integration (inherits from `html { font-size: 10px }`)
  - Set `--ms-rem: 12px` to scale all sizes up 20%
  - Maintains backward compatibility - default output unchanged (10px base = same pixel values)
  - Converted: padding, border-radius, font sizes, typography scale, input size variants, layout dimensions, checkbox sizing

### Fixed

- **Theme Examples** - Fixed all CSS variable prefixes from `--ml-*` to `--ms-*`
- **Badge Background Variable** - Fixed themes using wrong variable (`--ms-badge-bg` → `--ms-badge-text-bg`)
- **Selected Option Hover** - Fixed text becoming unreadable when hovering over selected options in themed modes (black-on-black in Sharp theme)
- **CSS Build Warning** - Fixed missing semicolon causing SCSS comments to leak into compiled CSS

### Changed

- **Default Checkbox Appearance** - More visible default styling with white background and darker border for better visibility
- **Theme Examples** - All 7 themes updated with comprehensive styling:
  - Dark Mode, Neon, Audi, Rounded, Sharp/Minimal, Material, Glass
  - Each theme now includes: input, dropdown, options, badges, checkboxes, scrollbar styling

## [1.2.0] - PUBLISHED - 2025-01-27

### Changed

- **10px-Based Sizing System** - Migrated to `--ms-rem` variable system for scalable sizing
  - New base variable `--ms-rem: 10px` enables proportional scaling across the component
  - All sizing values now use `calc(X * var(--ms-rem))` format internally
  - Input heights updated to Pure Admin standard: xs=31px, sm=33px, md=35px, lg=38px, xl=41px
  - Set `--ms-rem: 1rem` for Pure Admin integration (inherits from `html { font-size: 10px }`)
  - Set `--ms-rem: 12px` to scale all sizes up 20%
  - Maintains backward compatibility - default output unchanged (10px base = same pixel values)
  - Converted: padding, border-radius, font sizes, typography scale, input size variants, layout dimensions, checkbox sizing

## [1.2.0] - PUBLISHED - 2025-01-27

### Added

- **Input Size Attribute**: New `input-size` attribute for controlling input field dimensions
  - Supports 5-level scale: `xs`, `sm`, `md` (default), `lg`, `xl`
  - Consistent with web-daterangepicker sizing attributes
  - CSS classes: `.ms__input--xs`, `.ms__input--sm`, `.ms__input--lg`, `.ms__input--xl`
  - CSS variables for each size: `--ms-input-size-{size}-font`, `--ms-input-size-{size}-padding-v`, `--ms-input-size-{size}-padding-h`, `--ms-input-size-{size}-height`
  - JavaScript API: `element.inputSize = 'lg'`
  - Attribute change doesn't re-initialize picker (performance optimization)

## [1.1.0] - PUBLISHED - 2025-01-26

### Added
- **Standardized Checkbox Margins** - All 4 checkbox margins now controllable via CSS variables
  - Added `--ms-checkbox-margin-right`, `--ms-checkbox-margin-bottom`, `--ms-checkbox-margin-left` CSS variables
  - Complements existing `--ms-checkbox-margin-top` for complete margin control
  - Overrides browser default checkbox margins for consistent cross-browser appearance
  - All new margins default to `0` (horizontal/bottom spacing handled by flexbox gap)
  - Allows fine-tuned checkbox positioning for custom layouts
  - Defined in `src/scss/_variables.scss`, `src/scss/_css-variables.scss`, and `src/scss/_options.scss`
- **Custom Group Label Rendering** - New `renderGroupLabelContentCallback` for customizing group headers
  - Signature: `renderGroupLabelContentCallback(groupName: string) => string | HTMLElement`
  - Keeps standard `.ms__group-label` wrapper, replaces content inside
  - Supports HTML strings and HTMLElement returns
  - Use cases: capitalize group names, add icons/emojis, HTML formatting, i18n translation
  - Example in `examples-classic.html` showing uppercase + emoji formatting
  - Follows same naming convention as web-daterangepicker (`render*ContentCallback` = content only)
- **Initial Options + Async Search Example** - Added comprehensive example in `examples-classic.html`
  - Demonstrates "favorites + full search" pattern (show 5 most used items initially, search all on typing)
  - Security Groups example with 20 total items, showing 5 most used by default
  - Uses `keep-options-on-search="true"` + `min-search-length="2"` configuration
  - Simulated 400ms API delay for realistic async behavior
  - Perfect for enterprise scenarios: popular/recent items first, full database search on demand

### Fixed
- **Examples - Style Tag Rendering** - Fixed CSS appearing as plain text in `examples-templating.html`
  - Root cause: Premature `</style>` closing tag on line 14 left CSS rules (lines 15-156) outside style block
  - All page-specific CSS now properly enclosed in `<style>` tag
- **Examples - Priority Badge Styling** - Fixed priority-based badge colors not displaying in examples 2 and 11
  - Root cause: Using SCSS variable names (`--ml-badge-text-bg`) instead of CSS custom properties (`--ms-badge-text-background`)
  - SCSS variables compile to static values and cannot be overridden at runtime via `customStylesCallback`
  - Fixed in example 2 (Products): Budget/Mid-Range/Premium badges now show correct colors
  - Fixed in example 11 (Priority Badges): Urgent/Important/Normal/Low badges now show correct colors
  - Updated CSS variable names: `--ml-badge-text-bg` → `--ms-badge-text-background`, `--ml-badge-remove-bg` → `--ms-badge-remove-background`
- **Examples - Debug Logging** - Removed console.log statements from example 11 in `examples-templating.html`
  - Removed debug logging from `getBadgeClassCallback` and `getSelectionBadgeClassCallback`
  - Clean console output in production examples

- **CRITICAL: Single-Select Mode Event Values** - Fixed `selectedValues` splitting string values into individual characters
  - Root cause: `Array.from()` was being used on `getValue()` which returns a string in single-select mode
  - When selecting value `"acme"` in single-select, `selectedValues` was `["a", "c", "m", "e"]` instead of `["acme"]`
  - Impact: All single-select mode implementations (cascading selects, dropdowns with `multiple="false"`)
  - Fixed in: `src/web-component.ts` - All 3 event dispatches (`select`, `deselect`, `change`)
  - Solution: Properly wrap single values in array instead of treating string as iterable
  - Multi-select mode was not affected (already returns arrays)
- **Cascading Selects Example** - Fixed cascading dropdowns not working in `examples-new-api.html`
  - Root cause: Initialization code was outside `customElements.whenDefined()` block, running before components were ready
  - Moved all cascade initialization logic inside `whenDefined()` callback
  - HTML attributes now properly set: `value-member="value"` and `display-value-member="label"`
  - Organization → Business Unit → Department cascade now works correctly
- **Form Integration - Array Format** - Fixed array format only capturing last selected item in `examples-new-api.html`
  - Root cause: `Object.fromEntries(formData)` loses duplicate keys when multiple inputs share same name
  - Solution: Manual FormData iteration to properly handle array values (e.g., `tags[]`, `tags[]`, `tags[]`)
  - Array format now correctly captures all selected items, not just the last one
- **Debug Logging** - Removed all development console.log statements flooding browser console
  - Removed 24 debug statements from `src/multiselect.ts` (action button rendering logs)
  - Removed debug statements from `examples-new-api.html` (cascade debugging)
  - Production builds now have clean console output

### Changed
- **Examples - Improved Layouts** - Enhanced visual alignment in `examples-templating.html` custom rendering examples
  - Example 1 (Frameworks): Converted to CSS Grid layout with 3 columns (icon | content | stars)
    - Icon and star count span 2 rows and are vertically centered
    - Star counts always aligned in same column regardless of content length
  - Example 2 (Products): Changed `align-items: start` to `align-items: center` for vertically centered product icons
  - Example 3 (Articles): Converted to CSS Grid with 2 columns (icon | content), icon spans 3 rows and is vertically centered
  - Example 4 (Jobs): Converted to CSS Grid with 2 columns (icon | content), icon spans 3 rows and is vertically centered
  - Result: All option icons now properly centered in the middle of multi-line content
- **Showcase Property Names** - Corrected all property names in showcase examples to match actual API
  - **Display Modes page** (`display-modes/+page.svelte`):
    - `pills-display-mode` → `badges-display-mode` (all instances)
    - `pills-position` → `badges-position` (all instances)
    - `pills-threshold` → `badges-threshold` (all instances)
    - Updated documentation table to reflect correct property names
  - **Advanced Features page** (`advanced-features/+page.svelte`):
    - `pills-threshold` → `badges-threshold` (6 instances)
    - `pills-threshold-mode` → `badges-threshold-mode` (6 instances)
    - `pills-max-visible` → `badges-max-visible` (4 instances)
    - `enable-pill-tooltips` → `enable-badge-tooltips` (5 instances)
    - `pill-tooltip-placement` → `badge-tooltip-placement` (4 instances)
    - `getPillTooltipCallback` → `getBadgeTooltipCallback` (4 instances)
    - Updated all user-facing documentation text from "pill/pills" to "badge/badges" for consistency
  - Fixed duplicate variable binding in Compare section causing first example to have no data
  - Improved Compare section threshold: reduced from 4 to 2 items for easier demonstration
  - Impact: All previously broken examples (Count Mode Only, Compact Mode, None Mode) now work correctly

## [1.0.0] - PUBLISHED - 2025-11-20

### Changed
- **Window API Migration** - Switched to standard `window.components` pattern
  - Changed from `window.keenmate.multiselect` to `window.components['web-multiselect']`
  - Added `logging` object with all logging methods (enableLogging, disableLogging, setLogLevel, setCategoryLevel)
  - Added `getCategories()` method to list available logging categories
  - Migration: Replace `window.keenmate.multiselect` with `window.components['web-multiselect']`
  - This is a **breaking change** for code using the global window API

- **Logging System Refactored** - Simplified to match standard pattern from svelte-spa-router
  - Category names now hierarchical: `MULTISELECT:INIT`, `MULTISELECT:DATA`, `MULTISELECT:UI`, `MULTISELECT:INTERACTION`
  - `setCategoryLevel()` now accepts any string (not hardcoded enum) for dynamic category control
  - Simplified internal implementation - removed unnecessary complexity
  - Migration: Update category names: `'UI'` → `'MULTISELECT:UI'`, `'DATA'` → `'MULTISELECT:DATA'`, etc.
  - This is a **breaking change** - existing `setCategoryLevel()` calls must use new category names

- **Class Renaming** - Renamed base class for better branding alignment
  - Renamed `PureMultiSelect` to `WebMultiSelect` to align with package name `@keenmate/web-multiselect`
  - Updated all imports, exports, and documentation
  - Migration: Replace `import { PureMultiSelect }` with `import { WebMultiSelect }`
  - This is a **breaking change** - existing code using `PureMultiSelect` must be updated

### Added
- **Custom Rendering Callbacks** - Full control over how options, badges, and selected items are displayed
  - `renderOptionContentCallback(item, context)` - Customize dropdown option content with HTML or HTMLElement
    - Context provides: `{ index, isSelected, isFocused, isMatched, isDisabled }`
    - Replaces default icon + title + subtitle rendering while keeping wrapper structure
    - Virtual scroll compatible (content must fit within `optionHeight`)
  - `renderBadgeContentCallback(item, context)` - Customize badge (selected item) content with HTML or HTMLElement
    - Context provides: `{ displayMode, isInPopover }`
    - Can render different content based on where badge appears (main area vs popover)
    - Works across all display modes (pills, partial, compact) and popover
  - `renderSelectedContentCallback(item)` - Customize selected value text in single-select mode (plain text)
    - Determines what text shows in input field when closed
    - Separate from dropdown display text for maximum flexibility
  - All callbacks can return HTML strings (for performance) or HTMLElement objects (for convenience)
  - Maintains component structure and functionality (event handling, tooltips, remove buttons)
  - Falls back to existing callbacks (`getBadgeDisplayCallback`, `getDisplayValueCallback`) when not provided
  - Full TypeScript support with `OptionContentRenderContext` and `BadgeContentRenderContext` interfaces
- **Checkbox Control and Advanced Layouts** - Fine-grained control over checkbox appearance and positioning
  - `checkbox-align` attribute - Control checkbox vertical alignment: `'top'` (default), `'center'`, or `'bottom'`
    - Useful when custom content varies in height or uses multi-line layouts
    - CSS custom property: `--ml-checkbox-align` (flex-start, center, flex-end)
  - `--ml-checkbox-size` CSS variable - Control checkbox width/height (default: 16px)
  - `--ml-checkbox-scale` CSS variable - Scale checkbox larger/smaller while maintaining proportions (default: 1)
    - Example: `--ml-checkbox-scale: 1.5` for 50% larger checkbox
    - Scaled from top-left origin to prevent layout shifts
  - SCSS variables: `$ml-checkbox-size` and `$ml-checkbox-scale` for build-time customization
  - Works seamlessly with custom rendering callbacks for advanced layouts
  - Full support for CSS Grid and Flexbox layouts in custom option content
  - Added 3 advanced layout examples in `examples-templating.html`:
    - CSS Grid layout with center-aligned checkboxes
    - Flexbox multi-column layout with top-aligned checkboxes
    - Large checkbox scale (1.5×) demonstration
- **Custom Badge CSS Classes** - Add semantic styling to badges based on item data
  - `getBadgeClassCallback(item)` - Return custom CSS class(es) to apply to badges
    - Returns string (single class) or array of strings (multiple classes)
    - Classes added to badge's base `.ml__badge` element
    - Enables semantic color-coding (priority levels, status, categories, etc.)
  - Works across all badge rendering locations (main area, partial mode, popover)
  - Style badges using CSS variables (e.g., `--ml-badge-text-bg`, `--ml-badge-text-color`, `--ml-badge-remove-bg`)
  - Example use case: Color-code tasks by priority (red for urgent, yellow for important, green for low)
  - Added priority-based badge styling example in `examples-templating.html`
- **Shadow DOM CSS Injection** - Solve Shadow DOM CSS isolation for custom styling
  - `customStylesCallback()` - Inject custom CSS directly into Shadow DOM
    - Returns CSS string (not HTML) with style rules
    - Styles injected on component initialization
    - Can be updated dynamically - new styles replace old ones
    - Required for styling custom classes from `getBadgeClassCallback` or custom rendering callbacks
  - Solves Shadow DOM barrier: page CSS cannot reach shadow elements
  - Pattern follows `web-daterangepicker` implementation for consistency across Keenmate components
  - Works with all custom classes (pills, options, any shadow DOM elements)
  - Example: Inject `.badge-urgent { --ml-badge-text-bg: #fee2e2; }` to style priority-based badges
- **Separate Callbacks for Badges vs. Selected Items Popover** - Dedicated callbacks for different rendering contexts
  - `renderSelectedItemContentCallback(item)` - Custom renderer for selected items in the popover
    - Separate from `renderBadgeContentCallback` which renders badges in main area
    - Enables different rendering: compact badges in main area, detailed content in popover
    - Falls back to `renderBadgeContentCallback` if not defined
  - `getSelectedItemClassCallback(item)` - Add custom CSS classes to selected items in popover
    - Separate from `getBadgeClassCallback` which adds classes to badges in main area
    - Returns string (single class) or array of strings (multiple classes)
    - Falls back to `getBadgeClassCallback` if not defined
  - Design rationale: Selection box popover has more space for grandiose/detailed styling
  - Users can assign the same function to both callbacks if identical rendering is desired
  - Updated Example #11 to demonstrate separate callbacks for compact badges vs. detailed popover items

## [1.0.0-rc11] - 2025-11-13

### Added
- **Unified BadgeCounter Styling** - Created `.ml__badge--indicator` modifier class for consistent gray styling across all informational badges
  - Applies to "+ X more" badges (partial mode), "X selected" badges (count mode), and compact mode display badges
  - Deep gray appearance (`$ml-color-neutral-base` background, `$ml-color-neutral-dark` remove button) to distinguish from blue data badges
  - New SCSS variables: `$ml-badge-counter-bg`, `$ml-badge-counter-text-bg`, `$ml-badge-counter-text-color`, `$ml-badge-counter-remove-bg`, `$ml-badge-counter-remove-color`, `$ml-badge-counter-remove-bg-hover`
  - New CSS custom properties for runtime customization: `--ml-badge-indicator-*`
  - Consistent badge structure (`.ml__badge > .ml__badge-text + .ml__badge-remove`) across all display modes

### Changed
- **Refactored Compact/Count Mode HTML Structure** - Migrated from custom `.ml__count-badge-wrapper` to standard `.ml__badge--indicator` structure
  - Compact mode now uses `.ml__badge.ml__badge--indicator` instead of `.ml__count-badge-wrapper > .ml__count-text + .ml__count-clear`
  - Count mode now uses `.ml__badge.ml__badge--indicator` instead of `.ml__count-badge-wrapper > .ml__count-text + .ml__count-clear`
  - Updated event handlers to use `data-action` attributes (`show-selected`, `clear-count`) instead of old CSS class selectors
  - Container class changed from `.ml__count-display` to `.ml__badges` for consistency
- **Simplified `.ml__badge--more` Styling** - Removed duplicate background/hover styles, now inherits from `.ml__badge--indicator`
  - `.ml__badge--more` now only adds `cursor: pointer`, all visual styling comes from `.ml__badge--indicator`

### Fixed
- **Visual Inconsistency Between Display Modes** - Indicator badges ("+3 more", "5 selected", etc.) now have consistent gray styling across all modes instead of varying appearances

## [1.0.0-rc10] - 2025-11-13

### Fixed
- **Build/Publish Scripts** - Fixed circular dependency causing infinite loop during npm publish
  - Removed `publish` and `publish:dry` scripts from package.json that conflicted with npm lifecycle hooks
  - Makefile now handles full build and publish workflow directly
  - `make publish-dry` and `make publish` now work correctly without looping

## [1.0.0-rc09] - 2025-11-13

### Added
- **Virtual Scrolling for Selected Items Popover** - Handle massive selections (15,000+ items) with instant performance
  - Automatically activates when 100+ items are selected
  - Requires count badge setup: `badges-threshold="4"` + `badges-threshold-mode="count"` + `show-count-badge="true"`
  - Click the count badge to open popover with virtual scrolling
  - New `badge-height` attribute (default: 36px) - configurable height for badges in virtual scroll mode
  - Consistent 4px gap between badges (matches standard mode)
  - Same VirtualScroll implementation as dropdown for consistency
  - Performance: Renders only ~20-30 visible badges instead of all 15,000
- **`badges-display-mode="none"`** - New minimal display mode showing no badges/count in input area
  - Perfect for extremely space-constrained layouts
  - Typically combined with `show-count-badge="true"` to show only `[X]` indicator
  - No callbacks invoked (no display to render)
  - Badges container is empty and hidden via CSS
- **Proper `badges-display-mode="compact"` Implementation** - Shows first selected item + count in a single removable badge
  - Format: `[JavaScript (+2 more) | x]`
  - Uses `getBadgeDisplayCallback` for first item text (respects badge callback)
  - Uses `getCounterCallback(count, remainingCount)` for count text
  - Single X button clears ALL selections
  - Entire badge clickable to show selected items popover
  - Automatically shows next item when selections change
- **Comprehensive Callback Behavior Documentation** - Added detailed showcase documentation
  - When `getBadgeDisplayCallback` is invoked for each display mode
  - When `getCounterCallback` is invoked with `moreCount` parameter vs without
  - Clarified that count badge `[X]` is independent and works with all modes
  - Added quick reference tables showing what's displayed and which callbacks are used

### Fixed
- **Popover Virtual Scroll Display Issues** - Fixed multiple CSS and layout problems
  - Fixed parent container using `display: flex` which constrained child scrolling
  - Fixed body container `display: flex` and `max-height` preventing wrapper expansion
  - Solution: Apply `display: block` and `max-height: none` on both parent and body in virtual mode
  - Removed `max-height` from inline styles to allow 540,000px wrapper height
  - Now matches dropdown pattern exactly: parent doesn't constrain, child handles scrolling
- **Consistent Badge Heights** - Badges now have same height (36px) and spacing (4px) in virtual mode
  - Initially had mismatch: standard mode 24px, virtual mode was inconsistent
  - Now uses configurable `badge-height` attribute with 36px default
  - Gap properly included in itemHeight calculation (36px badge + 4px gap = 40px total)
- **`badges-display-mode="compact"` Implementation** - Was previously identical to 'count' mode (now properly implemented)
  - Previously fell through to count mode rendering
  - Now shows first item + count in a single badge as intended

### Changed
- **Count Badge Independence** - Clarified that `show-count-badge="true"` works independently with ALL display modes
  - Can be combined with any mode: badges, count, compact, partial, or none
  - Not affected by any callbacks - always shows just the number `[X]`
- **Classic Examples Reorganization** - Reorganized "Display Modes" section in `examples-classic.html`
  - Split into 4 clear categories: Basic Modes, Mode + Badge Combinations, Threshold Auto-Switching, and i18n
  - Each mode shown exactly once with clear labels and descriptions
  - Added all 5 basic modes including new 'none' mode
  - Better organization for understanding display mode options

## [1.0.0-rc08] - 2025-11-12

### Added
- **Virtual Scrolling** - Efficient rendering for large datasets (1,000+ items)
  - Renders only visible items (~30) instead of entire dataset for instant performance
  - Auto-activates at 100+ items (configurable via `virtual-scroll-threshold`)
  - Opt-in feature via `enable-virtual-scroll="true"` attribute
  - Fixed item height (50px default, configurable via `option-height`)
  - Configurable buffer size for smooth scrolling (default: 10 items above/below viewport)
  - Performance improvements: 25× faster dropdown opening (750ms → 30ms), 13-33× faster search (200-500ms → 15ms)
  - Memory reduction: 99.8% less DOM (7.5 MB → 15 KB for 15,000 items)
  - Full keyboard navigation support (arrows, Page Up/Down, Home/End)
  - Full mouse wheel scrolling support
  - New dedicated VirtualScroll class in `src/virtual-scroll.ts`
  - New performance demo: `examples-performance.html` with 15,000 random options
  - Limitation: Groups disabled in virtual scroll mode (falls back to standard rendering)

### Fixed
- **Mouse Wheel Scrolling in Virtual Scroll** - Fixed wheel events not triggering scroll
  - Root cause: Dropdown's wheel event handler was calling `stopPropagation()` on all wheel events
  - Solution: Skip dropdown's wheel handler when virtual scroll is active
  - Mouse wheel now works smoothly alongside drag scrollbar and keyboard navigation

## [1.0.0-rc07] - 2025-11-12

### Documentation
- Updated README with hybrid search documentation and API reference
- Added `beforeSearchCallback` to Properties section
- Added `keep-options-on-search` to Attributes table
- Fixed import path for logging utilities - import from main package instead of `/logger` subpath

## [1.0.0-rc06] - 2025-11-11

### Added
- **Hybrid Static + Dynamic Search** - Display initial "popular" items while supporting async database search
  - New `isKeepOptionsOnSearch` option (default: `true`) - Keeps initial options visible when searchCallback is active
  - Shows initial options when dropdown opens, below min search length, or search is cleared
  - Perfect for showing top 10 popular items, then switching to full database search
  - Works seamlessly with existing `searchCallback` - no breaking changes
- **Search Pre-Processing** - New `beforeSearchCallback` to transform or block search requests
  - Transform search terms (e.g., accent removal: "café" → "cafe")
  - Validate/sanitize user input before calling API
  - Block search by returning `null` (useful for preventing searches below certain criteria)
  - Use cases: accent removal, trimming whitespace, blocking profanity, custom validation
- **Categorized Logging System** - Professional logging infrastructure using loglevel library
  - 4 log categories: INIT (initialization), DATA (async loading), UI (rendering), INTERACTION (user events)
  - Color-coded console output with millisecond-precision timestamps
  - Runtime enable/disable controls - silent by default for production
  - Category-specific filtering (e.g., debug only UI operations)
  - Exported utilities: `enableLogging()`, `setLogLevel()`, `setCategoryLevel()`, `disableLogging()`
  - New examples page: `examples-logging.html` with interactive logging demos
- **CSS Custom Properties at :host** - All 150+ SCSS variables now exposed as CSS custom properties
  - Inspectable in browser DevTools at the `:host` level
  - Easy runtime customization via JavaScript or CSS
  - Full Shadow DOM compatibility with proper inheritance
  - New file: `src/scss/_css-variables.scss` (360 lines)
  - Added "Inspecting Variables in DevTools" section to README

### Fixed
- **Badge Close Button Icon** - Fixed missing "×" symbol in badge remove buttons
  - Root cause: CSS `content` property requires quoted strings, SCSS interpolation was stripping quotes
  - Fixed `--ml-icon-remove` and `--ml-icon-clear` to preserve quotes: `"#{$variable}"`
  - Close buttons now display properly with visible "×" symbol

### Changed
- **Logging Implementation** - Migrated from inline custom logger to loglevel library (~1KB)
  - Vendored loglevel and loglevel-plugin-prefix for bundler compatibility
  - Converted UMD modules to pure ESM to work with Vite/Rollup tree-shaking
  - All ~45 log calls categorized and updated with structured logging
  - Backward compatible - logging is silent by default

### Documentation
- Added `LOGGING_MIGRATION.md` documenting the logging system migration
- Updated `README.md` with CSS variables inspection guide
- Added comprehensive examples in `examples-logging.html` demonstrating all logging features
- Added Example 3: Hybrid Search with accent removal demonstration

## [1.0.0-rc05] - 2025-11-10

### Added
- **Badge Display Customization** - New `getBadgeDisplayCallback` property to customize badge text independently from dropdown display
  - Allows showing different text in badges vs dropdown (e.g., "John Doe" in badge, "John Doe (john@example.com)" in dropdown)
  - Falls back to standard display value if not provided
  - Useful for showing concise text in badges while keeping detailed information in dropdown
  - Applied to all badge rendering locations: badges mode, partial mode, selected popover, and tooltips

### Fixed
- **RTL Detection in Shadow DOM** - Fixed RTL mode not being detected when using web components
  - Root cause: Shadow DOM prevents direct access to host element's `dir` attribute
  - Solution: Check `shadowRoot.host` element for `dir="rtl"` attribute
  - RTL styles now properly apply when `dir="rtl"` is set on `<multi-select>` element
- **Input Toggle Behavior** - Fixed dropdown not properly toggling when clicking input field
  - Added proper open/close toggle logic on mousedown event
  - Fixed issue where dropdown couldn't be reopened after first close (focus event conflict)
  - Dropdown now properly toggles: open → close → open → close indefinitely
- **Input Cursor** - Added `cursor: pointer` to input field for better UX indication
- **Left Badges Alignment** - Fixed left-positioned badges appearing at far left edge instead of close to input
  - Changed from `justify-content: flex-start` to `flex-end` so badges appear immediately before input

## [1.0.0-rc04] - 2025-11-09

### Added
- **RTL (Right-to-Left) Language Support** - Full support for Arabic, Hebrew, Persian, Urdu, and other RTL languages
  - Auto-detection from `dir="rtl"` attribute on component or any ancestor element
  - Complete UI mirroring: toggle icon, text alignment, badges, dropdown, badges
  - Logical position mirroring: `badges-position="left"` becomes physically right in RTL (and vice versa)
  - Badges remove buttons flip to left side in RTL mode
  - All text content properly right-aligned with correct text direction
  - New RTL showcase page in `/examples/rtl` with Arabic and Hebrew examples
  - New SCSS file `_rtl.scss` with comprehensive RTL styles

### Fixed
- **Badges Positioning** - Fixed `badges-position` attribute not working (pills were always below input)
  - Root cause: Missing `ml-wrapper` flex container in DOM structure
  - Added wrapper div with `ml-wrapper` class and `--inline` modifier for left/right positioning
  - Badges now correctly position based on `badges-position` attribute (top, bottom, left, right)
  - Fixed right-positioned badges alignment: changed from `flex-end` to `flex-start` so badges appear immediately after input instead of at far right edge
- **Badges Spacing** - Reduced left/right badges margin from 0.5rem to 0.25rem for better spacing next to input

## [1.0.0-rc03] - 2025-11-09

### Fixed
- **SSR Compatibility** - Fixed "HTMLElement is not defined" error in Server-Side Rendering environments
  - Added HTMLElement stub for safe module imports in Node.js SSR contexts (SvelteKit, Next.js, Nuxt, etc.)
  - Component remains client-side only but module can now be safely imported during SSR
  - Added browser environment checks around all `customElements` API calls
  - No special client-side wrappers or dynamic imports required

## [1.0.0-rc02] - Previous Release

### Added

#### Badge Tooltips
- **`enable-badge-tooltips` attribute** - Enable tooltips on selected item badges
- **`badge-tooltip-placement` attribute** - Control tooltip position ('top', 'bottom', 'left', 'right')
- **`badge-tooltip-delay` attribute** - Customize tooltip show delay (default: 300ms, previously 500ms)
- **`badge-tooltip-offset` attribute** - Control distance between badge and tooltip (default: 8px)
- **`getBadgeTooltipCallback` property** - Custom callback for tooltip content
- **Separate tooltips** for badge text vs remove button to prevent overlap
- **Floating UI integration** with `strategy: 'fixed'` for proper Shadow DOM positioning
- Tooltips automatically clean up on component updates

#### Display Mode Enhancements
- **Enhanced `getCounterCallback`** - Now supports optional `moreCount` parameter for i18n/pluralization
  - When `moreCount` is provided: Used for "+X more" badge in partial mode
  - When `moreCount` is undefined: Used for total count display in count mode
  - Enables unified i18n handling: `(count: number, moreCount?: number) => string`

#### Flexible Data Handling (Major Feature)
- **Generic Type Support**: Component now supports `WebMultiSelect<T>` and `MultiSelectElement<T>` for any data structure
- **Member/Callback Pattern** (following svelte-treeview):
  - `valueMember` / `getValueCallback` - Extract unique ID from items
  - `displayValueMember` / `getDisplayValueCallback` - Extract display text
  - `searchValueMember` / `getSearchValueCallback` - Extract searchable text
  - `iconMember` / `getIconCallback` - Extract icon/emoji
  - `subtitleMember` / `getSubtitleCallback` - Extract subtitle/description
  - `groupMember` / `getGroupCallback` - Extract group name
  - `disabledMember` / `getDisabledCallback` - Determine if item is disabled
- **Auto-detection** for `[key, value]` tuple arrays
- **7 extraction methods** in core class for data abstraction

#### Form Integration
- **`name` attribute** - HTML form field name/ID for hidden input generation
- **`formValueFormat` property** - Choose format: `'json'` (default), `'csv'`, or `'array'`
  - `json`: `["val1","val2","val3"]`
  - `csv`: `val1,val2,val3`
  - `array`: Multiple `<input name="field[]">` elements
- **`getFormValueCallback`** - Custom callback for form value formatting
- **Automatic hidden input management** - Updates on selection changes

#### New Public API
- **`selectedValue` property** - Get selected value(s) (mode-dependent: single value or array)
- **`selectedItem` property** - Get first selected item object
- **`getValue()` method** - Get form-ready value (mode-dependent return type)
- **Enhanced `setSelected()`** - Now accepts `(string | number)[]` for flexibility

#### SCSS Improvements
- **MIT License**: Added formal LICENSE file with copyright notice and terms
- **Component-Specific Semantic Variables**: Added 125+ SCSS semantic variables
  - Input component, toggle icon, count badge, hint, dropdown
  - Actions, buttons, options, groups, empty states
  - Badges, count display, badge elements, selected popover
- Comprehensive API documentation for all semantic variables

### Changed

#### Tooltip Improvements
- **Default tooltip delay reduced** from 500ms to 300ms for faster response
- **Tooltip attachment** now targets badge text element instead of entire badge to prevent overlap with remove button

#### Breaking Changes - Data Handling
- **Internal property names** now use `is` prefix for booleans:
  - `multiple` → `isMultipleEnabled`
  - `allowGroups` → `isGroupsAllowed`
  - `allowSelectAll` → `isSelectAllAllowed`
  - `showCheckboxes` → `isCheckboxesShown`
  - `closeOnSelect` → `isCloseOnSelect`
  - `lockPlacement` → `isPlacementLocked`
  - `enableSearch` → `isSearchEnabled`
  - `allowAddNew` → `isAddNewAllowed`
  - `showCountBadge` → `isCountBadgeShown`
  - `stickyActions` → `isActionsSticky`
  - `allowClearAll` → `isClearAllAllowed`
- **External API** (HTML attributes) still uses familiar names (`multiple`, `allow-groups`, etc.)
- **Event detail structure** updated:
  - `selectedValues` now returns `(string | number)[]` instead of `string[]`
  - Generic type `MultiSelectEventDetail<T>` for type safety

#### Breaking Changes - SCSS
- Refactored all component styles to use semantic variables
- All SCSS variables now consistently use `$ml-` prefix

### Fixed

#### Critical Bug Fixes
- **Selection with numeric values** - Fixed type mismatch bug where options with numeric IDs couldn't be selected
  - Root cause: HTML data attributes are strings, but Map keys were using original types (numbers)
  - Solution: Normalized all internal Map/Set keys to strings while preserving original types in public API
  - Affected: `selectOption()`, `deselectOption()`, `toggleOption()`, `renderOption()`, and all selection tracking
- **Form integration with Shadow DOM** - Fixed hidden inputs not being accessible to FormData
  - Root cause: Hidden inputs were created inside Shadow DOM where FormData cannot access them
  - Solution: Added `hostElement` config option to append hidden inputs to light DOM (web component host)
  - All form formats (json, csv, array) now work correctly with standard HTML forms
- **Option lookup in async search** - Fixed `opt.value` direct property access on generic type `T`
  - Changed to use `getItemValue(opt)` for proper value extraction

#### Example Files
- **New API Examples** (`examples-new-api.html`) - Created comprehensive examples showcasing:
  - Custom object structures with member properties
  - [key, value] tuple arrays with auto-detection
  - Callback patterns for complex logic
  - Form integration with all 3 formats (JSON, CSV, array)
  - Mode-dependent getValue() API
  - Async search with GitHub API (with graceful fallback to mock data)
  - Simulated product search with 300ms delay
  - Country search with flag emojis
- **Classic Examples** (`examples-classic.html`) - Fixed all examples showing `[N/A]`
  - Added missing `value-member`, `display-value-member`, `icon-member`, `subtitle-member` attributes
  - Added async search examples (GitHub users, products)
- **Landing Page** (`index.html`) - Created navigation page with cards linking to example sets
- **Error Display** - Async search examples now show user-friendly error messages in dropdown:
  - ⚠️ GitHub API Rate Limit - Showing Mock Data
  - ⚠️ Invalid API Response - Showing Mock Data
  - ⚠️ Network Error - Showing Mock Data
  - Error messages appear as disabled options at top of results

### Benefits
- **Framework Consistency**: Matches svelte-treeview patterns across Keenmate components
- **Maximum Flexibility**: Works with any data structure (custom objects, tuples, existing APIs)
- **Form Integration**: Seamless HTML form submission support
- **Type Safety**: Full TypeScript support with generics
- **No Conflicts**: All variables prefixed with `$ml-` to prevent framework collisions
- **Easy Customization**: Semantic variables like `$ml-action-btn-border: none;`
- **Mode-Aware API**: `getValue()` returns appropriate type based on single/multi-select mode

## [1.0.0-rc01] - Previous Release

Initial release candidate with core multiselect functionality.
