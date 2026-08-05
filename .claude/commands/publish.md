---
description: Prepare @keenmate/web-dropzone (+ -core) for npm publish — bump both packages in lockstep, finalize CHANGELOG/README, build, test, commit
argument-hint: rc|release|patch|minor|major
---

# /publish — prepare an npm release of @keenmate/web-dropzone (+ @keenmate/web-dropzone-core)

You are preparing this package family for `npm publish`. **Do not run `npm publish`** — the user logs in and publishes manually.

This command follows the canonical `/publish` structure defined in the BlissFramework component guidelines at
`web-components/publish-command.md`. Sections marked **[canonical]** are byte-identical across every
component's `/publish`; sections marked **[per-repo]** are customized for this repo's layout, build, and tests.

**This repo is a two-package workspaces monorepo.** Unlike the single-package siblings (web-multiselect,
web-daterangepicker), `/publish` here operates on **two** packages that ship together and move in lockstep:

- `@keenmate/web-dropzone-core` — headless store. Published first (the renderer depends on it).
- `@keenmate/web-dropzone` — the custom element + satellites + CSS. Depends on `-core` by exact pinned version.

Both packages carry the **same version** and are bumped together. The renderer's `dependencies["@keenmate/web-dropzone-core"]`
pin is bumped in lockstep so a published renderer always resolves the matching published core.

## Argument [canonical]

The release type: **$ARGUMENTS**

Must be one of:

- `rc` — ship the WIP rc as-is. The `## [Unreleased]` CHANGELOG section is finalized to the current rc version.
- `release` — promote a WIP rc to a final release. `X.Y.Z-rcN` → `X.Y.Z`.
- `patch` — SemVer patch bump. Drops any `-rc` suffix.
- `minor` — SemVer minor bump. Drops `-rc`. Resets patch.
- `major` — SemVer major bump. Drops `-rc`. Resets minor and patch.

If missing or invalid, stop and ask the user which one to use (don't guess).

## Repo layout [per-repo]

Two-package monorepo; the root is private and not published:

- **`./package.json`** — root, `"private": true`, `"version"` tracks the family version for convenience but is **not** published. Its `version` should still be kept in sync with the packages.
- **`./packages/web-dropzone-core/package.json`** — `version` is the source of truth for **core**. Has a `file:` dep on `@keenmate/web-components-core` (see the publish-blocker check below).
- **`./packages/web-dropzone/package.json`** — `version` is the source of truth for the **renderer**. Carries two deps that matter here: `@keenmate/web-dropzone-core` (exact pin, bump in lockstep) and `@keenmate/web-components-core` (`file:` — see below).
- **`./CHANGELOG.md`** — single CHANGELOG at the root, covering both packages. WIP work lives under `## [Unreleased]`.
- **`./README.md`** — single README at the root. Carries `## What's New in vX.Y.Z` sections near the top (one per release, the **two most recent** retained).
- **`./packages/*/dist/`** — gitignored. Produced by `npm run build` (Vite + `tsc -b`). Never staged.
- **`./packages/web-dropzone/component-variables.manifest.json`** — published with the **renderer**. Edit if the variable surface changes.
- **`./packages/*/LICENSE`** — each package has its own LICENSE (published); there's also a root LICENSE.

## CHANGELOG convention in this repo [per-repo]

This repo **keeps a `## [Unreleased]` section** (Keep a Changelog style — the CHANGELOG header cites it). WIP work
accumulates under `## [Unreleased]`; releasing means renaming that heading to a dated, published version heading.

```
## [Unreleased]                               ← WIP, the one you're shipping
### Changed
- ...

## [1.6.1] - 2025-12-13
### Fixed
- ...

## [1.5.0] - PUBLISHED - 2025-12-08
### Added
- ...
```

Publishing the WIP section means renaming `## [Unreleased]` to `## [NEW_VERSION] - YYYY-MM-DD [PUBLISHED]`.

**Historical drift in this repo:** older sections use mixed markers — `## [X.Y.Z] - PUBLISHED - YYYY-MM-DD`,
`## [X.Y.Z] - RELEASED - YYYY-MM-DD`, and bare `## [X.Y.Z] - YYYY-MM-DD`. Don't retro-fix them. Finalize the
section you're shipping using the **canonical** format `## [NEW_VERSION] - YYYY-MM-DD [PUBLISHED]` (trailing tag,
matching the house style going forward). Substring searches for `PUBLISHED` still work across every format.

**After finalizing, re-open a fresh empty `## [Unreleased]` heading at the top** — this repo's established pattern
keeps an Unreleased section between releases. (This is the one place the dropzone flow differs from the single-package
siblings, which intentionally omit `[Unreleased]`.)

## Resolve versions [per-repo]

Read `./packages/web-dropzone-core/package.json` `version` as `CURRENT_VERSION` (core and renderer should already
match — if they don't, stop and ask the user to reconcile before continuing).

There is no version embedded in the `## [Unreleased]` heading, so `WIP_VERSION` is derived from `CURRENT_VERSION` per
the argument below.

Compute `NEW_VERSION`:

| Argument | Logic |
|---|---|
| `rc` | If `CURRENT_VERSION` matches `X.Y.Z-rcN`, `NEW_VERSION = CURRENT_VERSION` (no bump — we're shipping what's already in package.json). If `CURRENT_VERSION` is not an rc, stop and ask the user (they probably wanted `release`/`patch`/etc.). |
| `release` | If `CURRENT_VERSION` matches `X.Y.Z-rcN`, `NEW_VERSION = X.Y.Z`. Otherwise stop. |
| `patch` | Strip any `-rcN`, then bump patch. |
| `minor` | Strip any `-rcN`, then bump minor, reset patch. |
| `major` | Strip any `-rcN`, then bump major, reset minor and patch. |

`NEW_VERSION` applies to **both** packages and to the renderer's `@keenmate/web-dropzone-core` dependency pin.

## Steps (in order)

### 1. Sanity checks [per-repo]

- Run `git status`. The repo intentionally keeps `.claude/`, `test-results/`, `playwright-report/`, and `nul` untracked — those are fine. If there are **other** uncommitted changes that aren't `CHANGELOG.md`, `README.md`, or a `package.json`, list them and ask the user before continuing. (Typical case: substantive source changes belonging in this release that haven't been committed yet — confirm they're intended for this version before bumping.)
- **Publish-blocker: `file:` dependency on `@keenmate/web-components-core`.** Both packages currently declare `"@keenmate/web-components-core": "file:../../../web-components-core"`. A `file:` specifier **cannot be published** — npm will publish the literal `file:` string and consumers' installs will break. Before proceeding, check both `packages/*/package.json`: if either still has a `file:` (or `link:`/`workspace:`) specifier for `@keenmate/web-components-core`, **stop and ask the user** what published semver range to substitute (e.g. `^1.0.0-rc03`, per the CHANGELOG's stated `≥ 1.0.0-rc03` requirement). Do not guess the range.
- **Verify the new version isn't already on npm — for BOTH packages.** Run `npm view @keenmate/web-dropzone-core@<NEW_VERSION> version 2>/dev/null` and `npm view @keenmate/web-dropzone@<NEW_VERSION> version 2>/dev/null`. If either returns the version string, that version is already published and **stop**: bumping over it would fail at publish time and pollute the commit.
- **Verify the registry hasn't drifted past you.** Run `npm view @keenmate/web-dropzone-core version` and `npm view @keenmate/web-dropzone version` to fetch the latest published versions on the `latest` tag; if either is higher than `NEW_VERSION` (e.g. someone shipped from another machine), warn the user and ask before continuing.
- Confirm the `## [Unreleased]` CHANGELOG section has at least one bullet of substantive content under `### Added`, `### Changed`, `### Removed`, `### Fixed`, `### Breaking Changes`, or `### Internal`. If empty, stop — there's nothing meaningful to release.
- Confirm `./README.md` has a `## What's New in vNEW_VERSION` section. If it's missing, draft one from the CHANGELOG and present it to the user for approval before continuing:
  - Read the WIP CHANGELOG section, distill it to 5–8 scannable bullets covering the Added/Changed themes (paraphrase, don't copy CHANGELOG bullets verbatim — those are exhaustive; What's New is the highlight reel). Pure internal refactors and Fixed-only entries don't need coverage, though headline bug fixes worth advertising are worth a bullet.
  - **Follow the canonical "What's New" format** defined in the BlissFramework component guidelines (`web-components/readme-structure.md` → "`## What's New in vX.Y.Z` — canonical format"). Concretely:
    - **Heading:** `## What's New in vNEW_VERSION` — lowercase `v`, no backticks around the version, no date.
    - **Each bullet:** `- **<area or component> — <one-line headline>** — <engineer-level prose, 3–8 sentences>`. Bold-wrapped lead phrase, then a true em-dash (` — `, U+2014 with surrounding spaces), then a prose body explaining *what changed*, *why* (regression history / motivation), *what surface is affected* (concrete component / prop / file names listed inline), and *the mechanism* (the technique used). Plain hyphens or en-dashes fail the check.
    - **No `### ` sub-headings** inside a What's New section — it's a flat bullet list.
    - **Reference implementation:** the existing `## What's New in v1.0.0-rc01` section at the top of this repo's `README.md` is the canonical shape — mirror that voice and structure.
  - Show the user the proposed draft as plain markdown in your reply. Ask whether to (a) insert as-is, (b) edit, or (c) abort so they can write it themselves.
  - Only proceed past step 1 once the user approves the draft (or supplies their own). On approval, insert the section directly above the current top `## What's New in vX.Y.Z` heading in `./README.md`, then continue.
  - Do not silently insert the draft without confirmation — release highlights are a writing call and the user owns the voice.

### 2. Bump versions (if needed) [per-repo]

If `NEW_VERSION` ≠ `CURRENT_VERSION`, edit **all three** package.json files:

- `./packages/web-dropzone-core/package.json` — `"version": "NEW_VERSION"`.
- `./packages/web-dropzone/package.json` — `"version": "NEW_VERSION"` **and** `dependencies["@keenmate/web-dropzone-core"]` → `"NEW_VERSION"` (exact pin, in lockstep).
- `./package.json` (root) — `"version": "NEW_VERSION"` (kept in sync even though the root isn't published).

For `rc` arg this is normally a no-op — versions were bumped earlier in the development cycle. Still confirm the renderer's core-dep pin already matches `CURRENT_VERSION`.

### 3. Finalize CHANGELOG [per-repo]

In `./CHANGELOG.md`:

- Rename the `## [Unreleased]` heading to `## [NEW_VERSION] - <today> [PUBLISHED]` (today's date from system context), reading exactly: `## [NEW_VERSION] - YYYY-MM-DD [PUBLISHED]`.
- Leave all bullet content untouched.
- **Insert a fresh empty `## [Unreleased]` heading** directly above the just-finalized heading (this repo keeps an Unreleased section between releases). Leave it with no bullets — the next dev cycle fills it in.

### 4. Update README "What's New" — only if version changed [canonical]

In `./README.md`:

- If the existing `## What's New in v<WIP>` section's version differs from `NEW_VERSION` (e.g. promoting `X.Y.Z-rcN` → `X.Y.Z`), rename its heading to `## What's New in vNEW_VERSION`. (No content rewrites — the text was already curated for this release.)
- Then count the `## What's New in vX.Y.Z` headings. If there are more than **two**, delete the oldest ones so only the **two most recent** remain (the just-finalized one plus the one before it).

For `rc` arg this is normally a no-op on the heading itself — only trims if someone left an extra-old section behind.

### 5. Validate README reflects the release [canonical]

Read both the finalized CHANGELOG section and the matching `What's New in vNEW_VERSION` section. Every **Added** or **Changed** bullet in the CHANGELOG that represents a user-facing feature or behavior change should have a corresponding hit in the What's New section (paraphrased, not verbatim). Pure internal refactors and `Fixed`-only entries don't need coverage, though headline bug fixes worth advertising (e.g. "X used to silently fail; now works") are worth a bullet.

If you find a significant CHANGELOG entry that isn't reflected in What's New, add a bullet for it. If the section ends up with more than ~8 bullets after this pass, condense — What's New should be scannable, not exhaustive.

### 6. Validate CHANGELOG entries match recent work [per-repo]

Find the previous published version in CHANGELOG (the version just before NEW_VERSION) and locate the commit that bumped to it — usually a commit whose subject starts with `v<previous-version>`, `chore(release):`, or similar. Run `git log --oneline <previous-publish-commit>..HEAD` to list commits since.

Also check `git diff` (or `git status`) for any uncommitted source/test work outside the files you're editing in this command.

For every substantive commit or uncommitted change, verify the WIP CHANGELOG section mentions it. If something significant is missing, **stop and ask the user** before finalizing — don't invent entries on their behalf. Pure example/doc tweaks and trivial typo fixes don't need entries.

### 7. Run tests [per-repo]

Run `npm test` from the root — this runs **both** layers in order:
- `npm run test:unit` — Vitest unit specs (renderer package, happy-dom).
- `npm run test:e2e` — Playwright e2e specs.

All specs must pass. (Equivalently: `make test`, though the Makefile's `test` currently runs only e2e — prefer `npm test` to get the unit layer too.)

If anything fails, **stop and report**. Do not proceed to build/commit. The user fixes the regression (or decides to fixme the spec) before the publish flow can continue.

If Playwright complains that chromium isn't installed, suggest `npm run test:e2e:install` (or `make test-e2e-install`) and stop.

### 8. Build the packages [per-repo]

Run `npm run build` from the root (or `make build`). This fans out via workspaces (`npm run build -ws --if-present`) and builds **both** packages — core first (the renderer imports its types), then the renderer. Each package's build cleans its `dist/`, runs Vite, and emits type declarations via `tsc -b`.

If the build errors, stop and report.

After build, do a quick smoke check on the emitted artifacts:
- `packages/web-dropzone-core/dist/` — `core.js`, `core.umd.js`, and `index.d.ts` all exist and are non-empty.
- `packages/web-dropzone/dist/` — `dropzone.js`, `dropzone.umd.js`, `style.css`, and `index.d.ts` all exist and are non-empty.

### 9. Verify the package contents [per-repo]

Run `npm pack --dry-run` for **each** package (from within each package dir, or `npm pack --dry-run -w <name>`), or `make package` for a real two-tarball pack. Confirm:

**`@keenmate/web-dropzone-core`** (`files`: `dist`, `src`) includes:
- `dist/` (built JS + `core.umd.js` + `*.d.ts`)
- `src/` (raw TS sources — this package ships sources)
- `README.md` (falls back to root or its own), `LICENSE`, `package.json`

**`@keenmate/web-dropzone`** (`files`: `dist`, `src/css`, `component-variables.manifest.json`) includes:
- `dist/` (built JS + `style.css` + `*.d.ts`)
- `src/css/` (raw CSS files exposed via the `./css` export)
- `component-variables.manifest.json`
- `README.md`, `LICENSE`, `package.json`

If anything user-facing is missing or anything private leaked in (e.g. `test/`, `e2e/`, `examples-*.html`, `*.spec.ts`, `*.test.ts`, `tsconfig.json`, `vite.config.ts`), stop and report — the `files` field in each `package.json` controls this and the leak needs fixing before publish. Also re-confirm neither tarball's `package.json` still carries a `file:` dep for `@keenmate/web-components-core` (the step-1 check catches it; this is the last line of defense).

### 10. Commit [per-repo]

Stage:

- `./CHANGELOG.md`
- `./README.md`
- `./package.json` (root)
- `./packages/web-dropzone-core/package.json`
- `./packages/web-dropzone/package.json`

Do **not** stage `packages/*/dist/` — it's gitignored.

Commit message format:

```
vNEW_VERSION - <one-line summary of the headline change>

<grouped bullets paraphrased from the CHANGELOG section — split into the same
groups the CHANGELOG used: Added, Fixed, Changed, Breaking Changes, Internal, etc.
Keep bullets terse; full prose lives in the CHANGELOG.>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

### 11. Report [per-repo]

Report back with:

- The new version number (applies to both packages)
- The commit SHA
- The exact commands to publish — **core first, then renderer.** Pick the right form for the arg type:
  - For `rc` (publishing a pre-release):
    ```
    npm login                                          # if not already logged in
    npm publish -w @keenmate/web-dropzone-core --tag rc
    npm publish -w @keenmate/web-dropzone --tag rc
    ```
    The `--tag rc` is critical — without it npm assigns the `latest` dist-tag, which would make the pre-release the default install for everyone running `npm install @keenmate/web-dropzone`. With `--tag rc`, `latest` stays put and consumers opt in via `@rc` or an exact pin.
  - For `release` / `patch` / `minor` / `major` (publishing a stable release):
    ```
    npm login                                    # if not already logged in
    npm publish -w @keenmate/web-dropzone-core
    npm publish -w @keenmate/web-dropzone
    ```
    Or `make publish` (publishes both, core first, with a confirmation prompt). No `--tag` needed — it correctly lands as `latest`.
  - **Order matters:** the renderer pins `@keenmate/web-dropzone-core@NEW_VERSION` exactly, so core must be on the registry first or a fresh `npm install` of the renderer fails to resolve.
- A reminder that the CHANGELOG `[PUBLISHED]` tag is now in place — if `npm publish` fails, the user should revert the tag (CHANGELOG heading), the fresh `[Unreleased]` re-insertion, and the version bumps (all three package.json files) before retrying, since the registry will refuse to re-publish the same version.

## Things not to do [canonical + per-repo]

- **Do not run `npm publish`.** The user publishes manually after `npm login`.
- **Do not push to git remote.** The commit stays local until the user pushes.
- **Do not publish with a `file:` (or `link:`/`workspace:`) dep on `@keenmate/web-components-core` still in either package.json.** Substitute a published semver range (ask the user for it) — a `file:` specifier breaks every consumer install.
- **Do not publish the packages out of order.** Core first, then renderer.
- **Do not let the two package versions drift apart** — core, renderer, the renderer's core-dep pin, and the root all carry `NEW_VERSION`.
- **Do not silently insert a drafted What's New section.** If you draft one in Step 1 because it's missing, present it and wait for explicit approval (or edits) before inserting.
- **Do not keep more than two `## What's New in vX.Y.Z` sections in the README.** Step 4 trims older ones.
- **Do not skip the build step** — without it `packages/*/dist/` is stale and the publish would ship outdated artifacts.
- **Do not skip the test gate** — run both unit and e2e; the gate is what catches regressions before they ship.
- **Do not invent CHANGELOG entries** to cover commits you find; ask the user if something's missing.
- **Do not bump if there's nothing meaningful in the `## [Unreleased]` section** — stop and explain.
- **Do not retro-fix older CHANGELOG sections** that carry legacy markers (`- PUBLISHED -`, `- RELEASED -`) — only finalize the section you're shipping.

### Repo-specific don'ts

- **Do not stage `packages/*/dist/`, `test/`, `e2e/`, `test-results/`, `playwright-report/`, or `nul`** — they're either ignored or test artifacts.
- **Do not forget to re-open a fresh `## [Unreleased]` heading** after finalizing — this repo keeps one between releases (unlike the single-package siblings).
