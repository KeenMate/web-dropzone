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

## Package topology — core vs. renderer

The repository is a workspaces monorepo with two published packages:

```
packages/
├── web-dropzone-core/     → @keenmate/web-dropzone-core
│   ├── src/
│   │   ├── dropzone-core.ts   ← the DropzoneCore class
│   │   ├── store-api.ts       ← DropzoneStoreAPI interface (the boundary contract)
│   │   ├── file-pipeline.ts   ← stateless validation helpers
│   │   ├── types.ts           ← all domain types + event-detail types
│   │   ├── icons.ts           ← shared Lucide SVG family + createDropzoneSpinner
│   │   ├── dropzone-shared.ts ← DEFAULT_CONFIG + formatFileSize / getFileIcon / …
│   │   ├── dom-utils.ts       ← dispatchComposedEvent / escapeHtml (zero-dep DOM primitives)
│   │   └── logger.ts          ← runtime-controllable log channels
│   └── dist/                  ← core.js (~53KB min / ~16KB gzip), core.umd.js, *.d.ts
│
└── web-dropzone/          → @keenmate/web-dropzone
    ├── src/
    │   ├── dropzone.ts                ← WebDropzone extends DropzoneCore
    │   ├── web-component.ts           ← <web-dropzone> (store + back-compat picker/list)
    │   ├── web-component-picker.ts    ← <web-dropzone-picker>
    │   ├── web-component-list.ts      ← <web-dropzone-list>
    │   ├── web-component-indicator.ts ← <web-dropzone-indicator>
    │   ├── web-component-progress.ts  ← <web-dropzone-progress>
    │   ├── satellite-base.ts          ← shared satellite plumbing (resolveStoreElement, …)
    │   ├── status-surface.ts          ← three-callback contract impl (uses core types)
    │   ├── row-templates.ts / row-patching.ts
    │   └── css/                       ← all .css partials + main.css entry
    └── dist/                          ← dropzone.js (bundles core in), style.css, *.d.ts
```

### Why split?

1. **Headless consumers don't pay for the renderer.** React / Vue / Lit / Svelte / Solid wrappers that render the file list with the framework's own reactivity import `@keenmate/web-dropzone-core` — no Floating UI, no CSS, no custom elements, no satellites. The core's only "dependency" is its own vendored `loglevel`.
2. **Satellites are replaceable.** A satellite is anything that depends on `DropzoneStoreAPI` + the store's CustomEvents. A custom satellite written in any framework is a peer of the four built-in ones — none of them have any privileged access path into the core.
3. **The boundary is enforceable by construction.** The core package has no DOM imports beyond the bare-bones `dom-utils.ts` (which exports two functions: `dispatchComposedEvent`, `escapeHtml`). It is impossible for renderer concerns to leak across the package wall without showing up as a new import in `packages/web-dropzone-core/src/`.

### The boundary contract

The renderer talks to the core through exactly two surfaces — nothing else.

1. **TypeScript:** the `DropzoneStoreAPI` interface in [`packages/web-dropzone-core/src/store-api.ts`](./packages/web-dropzone-core/src/store-api.ts). Read methods (`getFiles`, `getConfig`, `getOverallProgress`, …) plus mutators (`addFiles`, `removeFile`, `clear`, `pauseFile`, `resumeFile`, `retryFile`, `setFileStatus`, `updateFileProgress`, …). Every satellite stores `store: DropzoneStoreAPI`, never `store: WebDropzone`. Custom satellites do the same.
2. **DOM CustomEvents** dispatched on the store element with `bubbles: true, composed: true`:
   - **Per-file:** `file-added`, `file-removed`, `file-progress`, `file-status-changed`, `file-updated`, `file-retry`, `file-uploaded`, `file-deleted`.
   - **Batch / aggregate:** `change`, `files-changed`, `files-rejected`.
   - **Lifecycle:** `store-ready` (fires at the end of `initializeDropzone`; satellites use it to resolve their `for=` reference race-free).
   - **Drag:** `overlay-enter`, `overlay-leave`.

`WebDropzone` (the renderer's `<web-dropzone>` class) extends `DropzoneCore` purely so the convenience-form back-compat case stays a single element — it then drives its internal picker/list via the same events any external satellite would consume. The split would still hold if `WebDropzone` had `core: DropzoneCore` instead of `extends DropzoneCore`; the inheritance is convenience, not architectural.

### "What do I install?"

| You want… | Install | Entry |
|---|---|---|
| Drop `<web-dropzone>` (or any built-in satellite) into a page | `@keenmate/web-dropzone` | `import '@keenmate/web-dropzone'` registers all custom elements |
| Build a React / Vue / Lit / Svelte / Solid renderer | `@keenmate/web-dropzone-core` | `import { DropzoneCore } from '@keenmate/web-dropzone-core'` then `new DropzoneCore(hostElement, config)` |
| Both: the built-in elements **and** a custom satellite that runs alongside them | `@keenmate/web-dropzone` only | The renderer re-exports core types and helpers — `import { DropzoneStoreAPI, createDropzoneSpinner } from '@keenmate/web-dropzone'` works |

Installing both packages explicitly is fine but redundant — the renderer pins `@keenmate/web-dropzone-core: ^1.0.0` and bundles the core code into its single-file `dist/dropzone.js`, so the runtime is self-contained either way. The hard dep exists so the renderer's `dist/index.d.ts` can re-export core types without npm warning the consumer.

### Headless entry-point

There is no `<web-dropzone-core>` custom element. The core is JS-only:

```ts
import { DropzoneCore, DropzoneStoreAPI } from '@keenmate/web-dropzone-core';

const host = document.createElement('div');           // any HTMLElement works as the event host
document.body.appendChild(host);

const store = new DropzoneCore(host, {
  isMultipleEnabled: true,
  maxFileCount: 10,
  uploadFileCallback: async (file, onProgress, signal, context) => {
    // your upload here
  }
});

// Read via DropzoneStoreAPI
const files = store.getFiles();

// Subscribe via DOM events
host.addEventListener('file-progress', (e) => {
  // e.detail = { id, progress, status, file }
});

host.addEventListener('files-changed', (e) => {
  // e.detail = { changedIds, files }
  rerenderYourFramework(e.detail.files);
});
```

Use `host` as the event target — every event the core dispatches is `bubbles: true, composed: true`, so a single listener anywhere up the tree (or inside any shadow root) catches the lot.

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
| 6 | **Core / renderer package split** | Phase A extracted `DropzoneCore` in-repo (non-breaking), routed renderer updates through events (introducing `file-updated`), and formalised `DropzoneStoreAPI` as the boundary contract. Phase B reorganised the source tree into `packages/web-dropzone-core/` + `packages/web-dropzone/` and published the two as separate npm packages — see the **Package topology** section above. | done |

Each stage gets its own PR / commit batch and a `CHANGELOG.md` entry.
