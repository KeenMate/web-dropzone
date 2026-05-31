# Architecture

This document is the source of truth for **where the `<web-dropzone>` family is heading** and **how we're getting there**. Read this before working on cross-cutting changes.

> Status: pre-1.x. No production users. We can change anything.

## Vision

The package serves a spectrum of upload use cases that share state but differ in layout:

1. **Simple single-file input** — one element, classic styled `<input type="file">`, upload animation.
2. **Multi-upload** — button or drop area, list rendered in several appearances.
3. **Decoupled selector + list** — picker lives in a form; list lives somewhere else on the page (sticky panel, side drawer, footer strip) and stays in sync.
4. **Multiple independent contexts on the same page** — e.g. an avatar uploader and a documents uploader, fully separated.
5. **Floating status indicator** — a small chip stuck to a screen edge that shows "N uploading", and opens a slide-out drawer with the full list when clicked.

Backing all of these from a single monolithic element is the wrong direction; we split.

## Topology — store + satellite renderers

`<web-dropzone>` **is the store.** It owns `FileState[]`, config, validation, the upload loop, and persistence. By default it renders nothing — it is the headless source of truth.

Renderers are **satellite elements**, each with its own shadow root, each binding to a store via exactly one `for="<store-id>"` attribute:

- `<web-dropzone-picker for=…>` — drag/click target. Card / button / minimal variants.
- `<web-dropzone-list for=…>` — list view. `list / detailed / grid / badges / rolling / popover` appearances.
- `<web-dropzone-indicator for=…>` — floating status chip + slide-out drawer.

```html
<!-- Headless store -->
<web-dropzone id="uploads" name="files" max-file-count="20"></web-dropzone>

<!-- Renderers bind by id. Never reference each other. -->
<web-dropzone-picker    for="uploads" selector-appearance="button"></web-dropzone-picker>
<web-dropzone-list      for="uploads" list-appearance="rolling"></web-dropzone-list>
<web-dropzone-indicator for="uploads" position="right"></web-dropzone-indicator>
```

**Wiring rule:** every renderer has exactly one `for=`. Multiple `for`s is a smell — the store boundary is wrong. The topology is always star-shaped around the store; renderers never reference each other.

**Back-compat shortcut:** if renderer attributes (`selector-appearance`, `list-appearance`, …) are set directly on `<web-dropzone>`, it also mounts its own internal picker / list. This keeps the one-element convenience form working unchanged.

**Change propagation:** the store dispatches `CustomEvent`s with `bubbles: true, composed: true` so they cross shadow boundaries. Satellites resolve their `for=` on `connectedCallback`, read initial state, `addEventListener` for diffs, and unsubscribe on `disconnectedCallback`. The store does not push to renderers — it emits, renderers consume.

## Status surfaces — shared three-callback contract

Any "status surface" (the indicator chip, the rolling list appearance, future ones) consumes a uniform render contract from `src/status-surface.ts`:

| Callback | Owns | Memoization unit |
|---|---|---|
| `renderBodyCallback`     | The outer wrapper. Returning `false` hides the surface; `null` yields to the library default. | `bodyPrev` per surface |
| `renderFileInfoCallback` | "What is the focal file" — name / icon / status. No-op when there's no `currentFile`. | `fileInfoPrev` per surface |
| `renderProgressCallback` | Per-file + overall progress. `args` carries both slices so combined templates ("xyz.zip 47% — 3 / 10 done") are one callback. | `progressPrev` per surface |

All three share the `StatusSurfaceCallback` shape: `(args: StatusSurfaceArgs) => string | HTMLElement | false | null`. String returns are skipped when equal to the previous string; element returns are skipped when the returned node is already the slot's only child — cache your spinner or element outside the callback and you get a true no-op across ticks (WAAPI animations don't restart, focus / transitions in flight survive).

Polished OOB rendering uses the same callbacks internally with library defaults — every part is replaceable independently. The `createDropzoneSpinner()` factory gives custom callbacks a library-grade WAAPI spinner to drop in.

**Surface implementations today:**
- `<web-dropzone-indicator>` — exposes the three callbacks directly on the element.
- `<web-dropzone>` rolling list appearance — exposes `renderRollingBodyCallback` / `renderRollingFileInfoCallback` / `renderRollingProgressCallback` on `DropzoneConfig` (callbacks-only, no HTML attr equivalent since the value is a function).

## Multi-selector modes

When a page has more than one picker, two distinct topologies must both work — and they constrain where the upload contract lives.

### Mode A — Independent contexts
Each selector is its own world: own picker, own list, own queue, own progress, own endpoint. Maps to **N stores, N×renderers**. No coordination.

```html
<web-dropzone id="avatar"></web-dropzone>
<web-dropzone-picker for="avatar" max-file-count="1"></web-dropzone-picker>
<web-dropzone-list   for="avatar"></web-dropzone-list>

<web-dropzone id="documents"></web-dropzone>
<web-dropzone-picker for="documents"></web-dropzone-picker>
<web-dropzone-list   for="documents"></web-dropzone-list>
```

### Mode B — Shared queue, per-selector upload semantics
One global queue + one global list + one global progress, but each **picker** decides how its contributed files are uploaded (its own endpoint, or its own metadata appended to a shared endpoint).

```html
<web-dropzone id="cloud"></web-dropzone>

<web-dropzone-picker for="cloud" selector-appearance="button" label="Add public files"></web-dropzone-picker>
<web-dropzone-picker for="cloud" selector-appearance="button" label="Add private files"></web-dropzone-picker>

<web-dropzone-list      for="cloud" list-appearance="rolling"></web-dropzone-list>
<web-dropzone-indicator for="cloud" position="right"></web-dropzone-indicator>
```

**Data-model consequence:** the upload contract lives on the picker, not the store. `FileState` carries optional `uploadCallback?` and `uploadMetadata?`, stamped by the picker that added the file. The store's upload loop calls `file.uploadCallback ?? store.uploadFileCallback`. Mode A files just inherit the store-level callback; Mode B files each carry their own.

## Naming caveat

The `web-dropzone` name may not survive to 1.0 — "dropzone" undersells a package that also covers single-file inputs and floating indicators. Code organisation should make a future global find/replace trivial: avoid baking "dropzone" into things that aren't the package name (internal class names, event names, etc. — prefer `dz-` / `upload-` prefixes already in use).

## Implementation plan

We ship the architecture in stages. Each stage compiles, each leaves the existing playground working.

| # | Stage | What it delivers | Status |
|---|---|---|---|
| 1 | **Granular store events** | `file-progress` (per-tick: id, progress, status) and `file-status-changed` (id, prevStatus, nextStatus) dispatched with `bubbles+composed`. Substrate for satellites. No rendering changes. | done |
| 2 | **Picker satellite** | Introduce `<web-dropzone-picker for=>` — card / button / minimal appearances, drag-drop + click-to-browse, contributes to a store via `addFiles`. The existing `<web-dropzone selector-appearance=…>` convenience form continues to render its own internal picker (separate code path, kept for back-compat). | done |
| 3 | **List satellite** | Introduce `<web-dropzone-list for=>` — list / detailed / grid / badges appearances, in-place row patching on `file-progress` / `file-status-changed` ticks, pause/resume/cancel/retry/remove actions wired through to the store. Rolling/popover appearances deferred (the existing convenience form still covers them inside `<web-dropzone>`). | done |
| 4 | **Indicator + drawer** | New satellite `<web-dropzone-indicator for=>`. Floating chip showing "N uploading / N% / N failed" with state-coloured styling, anchored to a screen edge (`position="right\|left\|top\|bottom"`). Click → slide-out drawer that embeds a `<web-dropzone-list>` for the full queue view — no list rendering is duplicated. | done |
| 5 | **Mode B per-file upload** | Added `uploadCallback?` / `uploadMetadata?` to `FileState`. `addFiles(files, opts)` stamps both onto every new file; the upload loop picks `file.uploadCallback ?? store.uploadFileCallback` and threads `uploadMetadata` into `FileUploadContext`. Mode A unchanged; Mode B works without ever exposing routing concerns to the store. | done |

Each stage gets its own PR / commit batch and a `CHANGELOG.md` entry.
