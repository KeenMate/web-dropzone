import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Section 6 — programmatic API surface.
 *
 * Fixture: test/api.html. Two dropzones:
 *
 *   - `#api` — vanilla. No upload callback. Covers the pure-state methods:
 *     addFiles, removeFile, clear, getFiles, getFile, getConfig.
 *
 *   - `#upload` — wired to a synthetic upload handler controlled by
 *     window.__pending pumps. auto-upload="false" so the spec drives the
 *     state machine explicitly via uploadAll(). Covers the lifecycle
 *     methods: pauseFile / resumeFile / cancelFile / retryFile,
 *     pauseAll / resumeAll / retryAll, and the getOverallProgress
 *     aggregate.
 */

const PAGE = '/test/api.html';

function dz(page: Page, id: string): Locator {
    return page.locator(`#${id}`);
}

async function addNamed(page: Page, id: string, names: string[]): Promise<void> {
    await page.evaluate(
        ({ id, names }) => (window as any).__addNamed(id, names),
        { id, names }
    );
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    // The fixture's setup script registers window.__addNamed asynchronously
    // when the module finishes loading. Specs drive everything via
    // page.evaluate, which has no auto-wait for module readiness — so
    // explicitly gate the suite on the helper being present.
    await page.waitForFunction(() => typeof (window as any).__addNamed === 'function');
});

test.describe('addFiles / files getter / getFile', () => {
    test('addFiles populates the queue; getStore().getFiles() returns a snapshot copy', async ({ page }) => {
        await addNamed(page, 'api', ['a.txt', 'b.txt']);
        const result = await dz(page, 'api').evaluate((el: any) => {
            const store = el.getStore();
            const snap1 = store.getFiles();
            const snap2 = store.getFiles();
            // getFiles always returns a fresh copy — mutating snap1 must
            // not affect what the second call sees.
            snap1.length = 0;
            return { snap2Length: snap2.length, name0: snap2[0].name };
        });
        expect(result.snap2Length).toBe(2);
        expect(result.name0).toBe('a.txt');
    });

    test('the .files getter on the host element mirrors the snapshot', async ({ page }) => {
        await addNamed(page, 'api', ['a.txt', 'b.txt']);
        const names = await dz(page, 'api').evaluate((el: any) =>
            el.files.map((f: any) => f.name)
        );
        expect(names).toEqual(['a.txt', 'b.txt']);
    });

    test('getFile(id) returns the matching FileState', async ({ page }) => {
        await addNamed(page, 'api', ['only.txt']);
        const found = await dz(page, 'api').evaluate((el: any) => {
            const f = el.files[0];
            const looked = el.getFile(f.id);
            return looked?.name;
        });
        expect(found).toBe('only.txt');
    });

    test('getFile(missing) returns undefined', async ({ page }) => {
        const result = await dz(page, 'api').evaluate((el: any) => el.getFile('does-not-exist'));
        expect(result).toBeUndefined();
    });
});

test.describe('removeFile / clear', () => {
    test('removeFile drops the matching FileState from the queue', async ({ page }) => {
        await addNamed(page, 'api', ['a.txt', 'b.txt', 'c.txt']);
        await dz(page, 'api').evaluate((el: any) => {
            const target = el.files.find((f: any) => f.name === 'b.txt');
            return el.removeFile(target.id);
        });
        const remaining = await dz(page, 'api').evaluate((el: any) =>
            el.files.map((f: any) => f.name)
        );
        expect(remaining).toEqual(['a.txt', 'c.txt']);
    });

    test('clear drains the queue completely', async ({ page }) => {
        await addNamed(page, 'api', ['a.txt', 'b.txt']);
        await dz(page, 'api').evaluate((el: any) => el.clear());
        expect(await dz(page, 'api').evaluate((el: any) => el.files.length)).toBe(0);
    });
});

test.describe('getStore().getConfig', () => {
    test('returns the merged config (declared attrs win over DEFAULT_CONFIG)', async ({ page }) => {
        const cfg = await dz(page, 'api').evaluate((el: any) => el.getStore().getConfig());
        // `accept` was declared on the element
        expect(cfg.accept).toBe('*/*');
        expect(cfg.maxFileCount).toBe(10);
        // Default config fields stay reachable
        expect(cfg.icon).toBeTruthy();
    });
});

test.describe('getStore (web-component element)', () => {
    test('exposes the underlying DropzoneStoreAPI on the host element', async ({ page }) => {
        const sig = await dz(page, 'api').evaluate((el: any) => {
            const store = el.getStore?.();
            if (!store) return null;
            return {
                hasGetFiles: typeof store.getFiles === 'function',
                hasAddFiles: typeof store.addFiles === 'function',
                hasPauseAll: typeof store.pauseAll === 'function',
                hasGetOverallProgress: typeof store.getOverallProgress === 'function'
            };
        });
        expect(sig).toEqual({
            hasGetFiles: true,
            hasAddFiles: true,
            hasPauseAll: true,
            hasGetOverallProgress: true
        });
    });
});

test.describe('upload lifecycle (uploadFileCallback wired)', () => {
    test('uploadAll starts each file; resolving its pump completes it', async ({ page }) => {
        await addNamed(page, 'upload', ['x.txt']);
        // uploadAll returns a Promise that doesn't resolve until every
        // file completes — we deliberately don't await it here; the test
        // resolves the synthetic pump below to drive the lifecycle.
        await dz(page, 'upload').evaluate((el: any) => { void el.uploadAll(); });

        await expect.poll(
            () => dz(page, 'upload').evaluate((el: any) => el.files[0].status)
        ).toBe('uploading');

        await page.evaluate(() => (window as any).__resolveUpload('x.txt', 'ok'));

        await expect.poll(
            () => dz(page, 'upload').evaluate((el: any) => el.files[0].status)
        ).toBe('complete');
    });

    test('pauseFile aborts the in-flight handler; status flips to paused', async ({ page }) => {
        await addNamed(page, 'upload', ['p.txt']);
        await dz(page, 'upload').evaluate((el: any) => { void el.uploadAll(); });
        await expect.poll(
            () => dz(page, 'upload').evaluate((el: any) => el.files[0].status)
        ).toBe('uploading');
        await dz(page, 'upload').evaluate((el: any) => {
            const f = el.files[0];
            return el.pauseFile(f.id);
        });
        await expect.poll(
            () => dz(page, 'upload').evaluate((el: any) => el.files[0].status)
        ).toBe('paused');
    });

    test('cancelFile aborts the handler; status flips to cancelled', async ({ page }) => {
        await addNamed(page, 'upload', ['c.txt']);
        await dz(page, 'upload').evaluate((el: any) => { void el.uploadAll(); });
        await expect.poll(
            () => dz(page, 'upload').evaluate((el: any) => el.files[0].status)
        ).toBe('uploading');
        await dz(page, 'upload').evaluate((el: any) => {
            const f = el.files[0];
            return el.cancelFile(f.id);
        });
        await expect.poll(
            () => dz(page, 'upload').evaluate((el: any) => el.files[0].status)
        ).toBe('cancelled');
    });
});

test.describe('getStore().getOverallProgress aggregate', () => {
    test('returns a byte-weighted percent + per-status counts', async ({ page }) => {
        await addNamed(page, 'upload', ['a.txt', 'b.txt']);
        const agg = await dz(page, 'upload').evaluate((el: any) => el.getStore().getOverallProgress());
        expect(agg).toEqual(
            expect.objectContaining({
                uploadedBytes: expect.any(Number),
                totalBytes: expect.any(Number),
                completedCount: expect.any(Number),
                percent: expect.any(Number)
            })
        );
        expect(agg.completedCount).toBe(0); // nothing started yet
        expect(agg.totalBytes).toBeGreaterThan(0);
    });
});
