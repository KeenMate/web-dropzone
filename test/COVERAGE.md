# E2E Test Coverage Checklist

Tracks which features of `@keenmate/web-dropzone` have end-to-end test coverage
in `e2e/`. Each row is one user-observable feature. Status legend:

- `✗` — no coverage
- `△` — partial coverage (some paths)
- `✓` — covered

When a row is marked `✓`/`△`, the **Spec** column points at the file under
`e2e/` that exercises it, and **Fixture** at the dedicated HTML page under
`test/` (specs hit no example pages, only fixtures).

---

## 1. Selector appearance

| Feature                                                       | Status | Spec             | Fixture       |
| ------------------------------------------------------------- | :----: | ---------------- | ------------- |
| `selector-appearance="card"` (default)                        | ✓      | `display.spec.ts` | `display.html` |
| `selector-appearance="button"`                                | ✓      | `display.spec.ts` | `display.html` |
| `selector-appearance="minimal"`                               | ✓      | `display.spec.ts` | `display.html` |
| `selector-appearance="native"`                                | ✓      | `display.spec.ts` | `display.html` |
| `no-file-chosen-text` empty-state label                       | ✓      | `display.spec.ts` | `display.html` |
| `select-files-text` button label across variants              | △      | `display.spec.ts` | `display.html` |
| `card-size="minimal" \| "compact" \| "big"`                   | ✗      |                  |                |
| `icon` attribute on minimal selector                          | ✓      | `display.spec.ts` | `display.html` |
| Count badge on button/minimal when files exist                | ✗      |                  |                |

## 2. List appearance

| Feature                                                       | Status | Spec           | Fixture     |
| ------------------------------------------------------------- | :----: | -------------- | ----------- |
| `list-appearance="list"` (default)                            | ✓      | `list.spec.ts` | `list.html` |
| `list-appearance="detailed"`                                  | ✓      | `list.spec.ts` | `list.html` |
| `list-appearance="grid"` (image thumbnails)                   | ✓      | `list.spec.ts` | `list.html` |
| `list-appearance="badges"`                                    | ✓      | `list.spec.ts` | `list.html` |
| `list-appearance="badges"` + `show-thumbnails`                | ✗      |                |             |
| `list-appearance="popover"` summary + popover                 | △      | `list.spec.ts` | `list.html` |
| `list-appearance="rolling"`                                   | ✗      |                |             |
| `list-appearance="none"`                                      | ✓      | `list.spec.ts` | `list.html` |
| `max-visible-files` "Show N more" toggle (in-class renderer)  | △      | `list.spec.ts` | `list.html` |
| `max-visible-files` cap **in satellite renderer** — GAP       | ✗      |                |             |
| `--dz-file-list-max-height` internal scroll                   | ✗      |                |             |
| `files-inside` layout                                         | ✓      | `list.spec.ts` | `list.html` |
| Legacy `display-mode` shorthand → orthogonal axes             | ✗      |                |             |

> **Known gap:** `<web-dropzone-list>` (satellite) doesn't honor `max-visible-files`.
> The cap is implemented in `dropzone.ts` (in-class renderer); the satellite
> renders the full list regardless. Two tests in `list.spec.ts` are marked
> `.fixme()` until the satellite reads the cap from store config.

## 3. Validation

| Feature                                                       | Status | Spec                 | Fixture            |
| ------------------------------------------------------------- | :----: | -------------------- | ------------------ |
| `max-file-size` rejects with code="size"                      | ✓      | `validation.spec.ts` | `validation.html`  |
| `min-file-size` rejects sub-threshold files                   | ✗      |                      |                    |
| `max-total-size` aggregate cap                                | ✗      |                      |                    |
| `max-file-count` rejects with code="count"                    | ✓      | `validation.spec.ts` | `validation.html`  |
| `min-file-count` form-validity gate                           | ✗      |                      |                    |
| `accept` MIME / extension filter (code="type")                | ✓      | `validation.spec.ts` | `validation.html`  |
| `validateCallback` (custom sync rule)                         | ✓      | `validation.spec.ts` | `validation.html`  |
| Duplicate detection (`dedupe-mode`)                           | ✗      |                      |                    |
| `beforeFilesAddedCallback` async gate (accept)                | ✗      |                      |                    |
| `beforeFilesAddedCallback` async gate (cancel, code='cancelled') | ✗   |                      |                    |
| `beforeFilesRemovedCallback` async gate (X click)             | ✗      |                      |                    |

## 4. Events & API

| Feature                                                       | Status | Spec             | Fixture       |
| ------------------------------------------------------------- | :----: | ---------------- | ------------- |
| `file-added` fires with `{ file }`-only detail                | ✓      | `events.spec.ts` | `events.html` |
| `file-removed` fires with `{ file }`-only detail              | ✓      | `events.spec.ts` | `events.html` |
| `change` fires with empty detail (native input convention)    | ✓      | `events.spec.ts` | `events.html` |
| `files-changed` rAF-coalesces a multi-file batch              | ✓      | `events.spec.ts` | `events.html` |
| `files-rejected` carries grouped rejections                   | △      | `validation.spec.ts` | `validation.html` |
| `file-progress` / `file-status-changed` during upload         | ✗      |                  |                |
| `file-updated` after `previewUrl` / metadata write            | ✗      |                  |                |
| `file-row-update` on element-returning row callbacks          | ✗      |                  |                |
| `overlay-enter` / `overlay-leave` during drag                 | ✗      |                  |                |
| `el.target.files` snapshot in sync at dispatch                | ✓      | `events.spec.ts` | `events.html` |
| Public methods: `addFiles`, `removeFile`, `clear`             | ✓      | `api.spec.ts`    | `api.html`    |
| Public method: `getFile(id)` / `getFile(missing)`             | ✓      | `api.spec.ts`    | `api.html`    |
| Public methods: `pauseFile` / `cancelFile`                    | ✓      | `api.spec.ts`    | `api.html`    |
| Public methods: `resumeFile`, `retryFile`, `pauseAll`, `resumeAll`, `retryAll` | ✗ |                  |                |
| `uploadAll` returns + drives worker pool                      | ✓      | `api.spec.ts`    | `api.html`    |
| `getStore().getFiles()` returns mutable copy                  | ✓      | `api.spec.ts`    | `api.html`    |
| `getStore().getConfig()` returns merged config                | ✓      | `api.spec.ts`    | `api.html`    |
| `getStore().getOverallProgress()` aggregate                   | ✓      | `api.spec.ts`    | `api.html`    |
| `getStore()` returns DropzoneStoreAPI (method signatures)     | ✓      | `api.spec.ts`    | `api.html`    |
| `.files` getter on host element                               | ✓      | `api.spec.ts`    | `api.html`    |

## 5. Upload pipeline

| Feature                                                       | Status | Spec | Fixture |
| ------------------------------------------------------------- | :----: | ---- | ------- |
| `uploadFileCallback` runs on auto-upload                      | ✗      |      |         |
| `auto-upload="false"` keeps files pending                     | ✗      |      |         |
| `concurrency` cap holds N workers active                      | ✗      |      |         |
| Resume from `context.startBytes` after pause                  | ✗      |      |         |
| Retry from error preserves progress                           | ✗      |      |         |
| Per-file pause / resume / cancel via X button                 | ✗      |      |         |
| `progress-throttle` caps emission rate                        | ✗      |      |         |
| `reorder-completed` reflows completed rows                    | ✗      |      |         |
| `progress-mode="pessimistic"` keeps bar from snapping back    | ✗      |      |         |
| Resume-aware progress on `file-progress`                      | ✗      |      |         |

## 6. Structural mode (`mode="structural"`)

| Feature                                                       | Status | Spec | Fixture |
| ------------------------------------------------------------- | :----: | ---- | ------- |
| `renderPromptCallback` overrides card content                 | ✗      |      |         |
| `renderFileItemCallback` (string return)                      | ✗      |      |         |
| `renderFileItemCallback` (HTMLElement return + file-row-update) | ✗    |      |         |
| `renderListWrapperCallback` (table layout)                    | ✗      |      |         |
| `renderSummaryCallback` (popover summary)                     | ✗      |      |         |
| Callbacks ignored when `mode!="structural"`                   | ✗      |      |         |

## 7. Architecture (satellites + headless)

| Feature                                                       | Status | Spec | Fixture |
| ------------------------------------------------------------- | :----: | ---- | ------- |
| `<web-dropzone-picker for=>` binds to store                   | ✗      |      |         |
| `<web-dropzone-list for=>` binds to store                     | ✗      |      |         |
| `<web-dropzone-indicator for=>` binds to store                | ✗      |      |         |
| `<web-dropzone-progress for=>` binds to store                 | ✗      |      |         |
| `mode="headless"` skips internal rendering                    | ✗      |      |         |
| `mode="headless"` still fires every event                     | ✗      |      |         |
| Multiple pickers contribute to one store (Mode B routing)     | ✗      |      |         |
| Multiple independent stores on one page (Mode A)              | ✗      |      |         |

## 8. Drag overlay

| Feature                                                       | Status | Spec | Fixture |
| ------------------------------------------------------------- | :----: | ---- | ------- |
| `overlay-target` activates whole-area overlay                 | ✗      |      |         |
| Two overlays don't steal each other's drags                   | ✗      |      |         |
| Overlay enter / leave events                                  | ✗      |      |         |

## 9. Form integration

| Feature                                                       | Status | Spec           | Fixture     |
| ------------------------------------------------------------- | :----: | -------------- | ----------- |
| `name` attribute submits real `File` blobs in FormData        | ✓      | `form.spec.ts` | `form.html` |
| Zero-files → no FormData entry under the configured name      | ✓      | `form.spec.ts` | `form.html` |
| `form.reset()` clears selection (formResetCallback)           | ✓      | `form.spec.ts` | `form.html` |
| Unnamed dropzone → no FormData entry at all                   | ✓      | `form.spec.ts` | `form.html` |
| `min-file-count` blocks form submit via setValidity           | ✗      |                |             |

## 10. Theming

| Feature                                                       | Status | Spec | Fixture |
| ------------------------------------------------------------- | :----: | ---- | ------- |
| `--dz-rem` scales every dimension                             | ✗      |      |         |
| Individual `--dz-*` override                                  | ✗      |      |         |
| `--base-*` integration with sibling KM components             | ✗      |      |         |
| Disabled state styling + pointer-events block                 | ✗      |      |         |
| RTL (`dir="rtl"`) flips layout                                | ✗      |      |         |

## 11. Logging

| Feature                                                       | Status | Spec | Fixture |
| ------------------------------------------------------------- | :----: | ---- | ------- |
| Global API `window.components['web-dropzone']` exists         | ✗      |      |         |
| `setLogLevel` switches category output                        | ✗      |      |         |
| Core + renderer version exposed on `.config.core`             | ✗      |      |         |
