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

| Feature                                                       | Status | Spec | Fixture |
| ------------------------------------------------------------- | :----: | ---- | ------- |
| `list-appearance="list"` (default)                            | ✗      |      |         |
| `list-appearance="detailed"`                                  | ✗      |      |         |
| `list-appearance="grid"` (image thumbnails)                   | ✗      |      |         |
| `list-appearance="badges"`                                    | ✗      |      |         |
| `list-appearance="badges"` + `show-thumbnails`                | ✗      |      |         |
| `list-appearance="popover"` summary + popover                 | ✗      |      |         |
| `list-appearance="rolling"`                                   | ✗      |      |         |
| `list-appearance="none"`                                      | ✗      |      |         |
| `max-visible-files` "Show N more" toggle                      | ✗      |      |         |
| `--dz-file-list-max-height` internal scroll                   | ✗      |      |         |
| `files-inside` layout                                         | ✗      |      |         |
| Legacy `display-mode` shorthand → orthogonal axes             | ✗      |      |         |

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
| Public methods: `addFiles`, `removeFile`, `clear`             | ✓      | `events.spec.ts` | `events.html` |
| Public methods: `pauseFile`, `resumeFile`, `retryFile`, `cancelFile` | ✗ |                  |                |
| Public methods: `pauseAll`, `resumeAll`, `retryAll`           | ✗      |                  |                |
| `getOverallProgress()` aggregate                              | ✗      |                  |                |
| `getStore()` returns DropzoneStoreAPI                         | ✗      |                  |                |

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

| Feature                                                       | Status | Spec | Fixture |
| ------------------------------------------------------------- | :----: | ---- | ------- |
| `name` attribute submits real `File` blobs in FormData        | ✗      |      |         |
| `form.reset()` clears selection (formResetCallback)           | ✗      |      |         |
| `min-file-count` blocks form submit via setValidity           | ✗      |      |         |

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
