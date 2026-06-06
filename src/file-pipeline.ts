/**
 * Pure helpers for the add-files pipeline.
 *
 * Everything in here is stateless — no `this`, no DOM, no event dispatch.
 * `dropzone.ts`'s `processFiles` orchestrates the stateful bits (running
 * totals, dedupe set, emit events, re-render); these functions answer the
 * one-shot "should this file pass / what's its dedupe key / what does its
 * FileState look like" questions that the orchestration needs to ask.
 *
 * Pulled out of the class so they can be unit-tested without standing up
 * a store: pass a config + a file in, assert the result. The shapes
 * deliberately don't reach back into `WebDropzone` — anything they need
 * arrives as an argument.
 */

import { formatFileSize } from './dropzone';
import type {
    AddFilesOptions,
    DedupeMode,
    FileState,
    ValidationResult
} from './types';

/**
 * Subset of `DropzoneConfig` that the per-file validator actually reads.
 * Declared structurally so callers can hand in either the full config or
 * a minimal stub in tests.
 */
export interface ValidationConfig {
    maxFileSize?: number;
    minFileSize?: number;
    accept?: string;
    validateCallback?: (file: File, existing: FileState[]) => ValidationResult;
}

/**
 * Stable key for "is this file the same one we've already seen?". Mode
 * `'name-size'` separates files with the same name but different sizes
 * (common after `Save as…`); `'name'` collapses them. Mode `'none'` is
 * handled at the call site (no key needed when dedup is off).
 */
export function dedupeKeyFor(file: File, mode: DedupeMode): string {
    if (mode === 'name-size') return `${file.name}|${file.size}`;
    return file.name;
}

/**
 * Does the file pass the `accept=` filter? Mirrors the platform's own
 * matching rules: extension (e.g. .pdf), MIME family (e.g. image/...),
 * exact MIME (e.g. image/png), and the universal wildcard. An empty or
 * whitespace-only filter accepts everything.
 */
export function isFileTypeAccepted(file: File, accept: string): boolean {
    const acceptTypes = accept.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (acceptTypes.length === 0) return true;

    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();

    return acceptTypes.some(token => {
        // Universal wildcard — accept anything. Without this branch, '*/*'
        // would fall into the '/*' MIME-wildcard rule below and compare
        // against the bogus prefix '*/', rejecting every real file.
        if (token === '*' || token === '*/*') return true;

        // Extension match (e.g., .pdf)
        if (token.startsWith('.')) {
            return fileName.endsWith(token);
        }

        // MIME type wildcard (e.g., image/*)
        if (token.endsWith('/*')) {
            const category = token.replace('/*', '/');
            return fileType.startsWith(category);
        }

        // Exact MIME type match
        return fileType === token;
    });
}

/**
 * Per-file validation gate. Stateless — count and total-size caps are
 * stateful and stay in `processFiles` where the running totals live.
 * Returns `{ valid: true }` on accept, `{ valid: false, error, code }` on
 * reject. A custom `validateCallback` runs last and can override accept
 * but can't override reject (the standard checks short-circuit first).
 */
export function validateFile(
    file: File,
    config: ValidationConfig,
    existingFiles: FileState[]
): ValidationResult {
    if (config.maxFileSize && config.maxFileSize > 0 && file.size > config.maxFileSize) {
        return {
            valid: false,
            error: `File is too large. Maximum size is ${formatFileSize(config.maxFileSize)}`,
            code: 'size'
        };
    }

    if (config.minFileSize && config.minFileSize > 0 && file.size < config.minFileSize) {
        return {
            valid: false,
            error: `File is too small. Minimum size is ${formatFileSize(config.minFileSize)}`,
            code: 'size'
        };
    }

    if (config.accept && !isFileTypeAccepted(file, config.accept)) {
        return {
            valid: false,
            error: `File type not accepted`,
            code: 'type'
        };
    }

    if (config.validateCallback) {
        const customResult = config.validateCallback(file, existingFiles);
        if (!customResult.valid) {
            return { ...customResult, code: customResult.code || 'custom' };
        }
    }

    return { valid: true };
}

/**
 * Build a fresh `FileState` for an accepted file. `id` is injected so
 * callers can plug in any generator (the store uses a Date.now-seeded
 * one; tests can pass a deterministic value). Mode-B routing fields
 * (`uploadCallback`, `uploadMetadata`) come from `opts` and survive
 * through pause / resume / retry — see ARCHITECTURE.md.
 */
export function createFileState(
    file: File,
    id: string,
    opts?: AddFilesOptions
): FileState {
    const state: FileState = {
        id,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'pending',
        progress: 0
    };
    if (opts?.uploadCallback) state.uploadCallback = opts.uploadCallback;
    if (opts?.uploadMetadata) state.uploadMetadata = opts.uploadMetadata;
    return state;
}
