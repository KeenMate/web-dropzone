import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Section 7 — upload pipeline.
 *
 * Fixture: test/upload.html. Four dropzones, all sharing a synthetic
 * upload handler that parks each upload on a Promise keyed by file.name.
 * Specs drive the lifecycle by resolving / failing / pumping progress
 * through window.__resolve, window.__progress, window.__pendingNames.
 *
 * This gives deterministic control over the worker pool: pause / resume
 * / retry / concurrency / status transitions are all observable without
 * any real HTTP timing.
 */

const PAGE = '/test/upload.html';

function dz(page: Page, id: string): Locator {
    return page.locator(`#${id}`);
}

async function addNamed(page: Page, id: string, names: string[]): Promise<void> {
    await page.evaluate(({ id, names }) => (window as any).__addNamed(id, names), { id, names });
}

async function pendingNames(page: Page): Promise<string[]> {
    return page.evaluate(() => (window as any).__pendingNames());
}

async function resolveUpload(page: Page, name: string, outcome: 'ok' | 'fail' = 'ok'): Promise<void> {
    await page.evaluate(({ name, outcome }) => (window as any).__resolve(name, outcome), { name, outcome });
}

async function pumpProgress(page: Page, name: string, pct: number): Promise<void> {
    await page.evaluate(({ name, pct }) => (window as any).__progress(name, pct), { name, pct });
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof (window as any).__addNamed === 'function');
});

test.describe('auto-upload (default true)', () => {
    test('handler runs immediately on add — file enters "uploading" state', async ({ page }) => {
        await addNamed(page, 'auto', ['a.txt']);
        // The handler parks on a pending Promise; status flips before the
        // resolve. Poll to absorb the rAF-scheduled status flip.
        await expect.poll(
            () => dz(page, 'auto').evaluate((el: any) => el.files[0].status)
        ).toBe('uploading');
    });

    test('resolving the pump transitions the file to "complete"', async ({ page }) => {
        await addNamed(page, 'auto', ['done.txt']);
        await expect.poll(() => pendingNames(page)).toContain('done.txt');
        await resolveUpload(page, 'done.txt', 'ok');
        await expect.poll(
            () => dz(page, 'auto').evaluate((el: any) => el.files[0].status)
        ).toBe('complete');
    });

    test('failing the pump transitions the file to "error"', async ({ page }) => {
        await addNamed(page, 'auto', ['boom.txt']);
        await expect.poll(() => pendingNames(page)).toContain('boom.txt');
        await resolveUpload(page, 'boom.txt', 'fail');
        await expect.poll(
            () => dz(page, 'auto').evaluate((el: any) => el.files[0].status)
        ).toBe('error');
    });
});

test.describe('auto-upload="false"', () => {
    test('handler does NOT run until uploadAll() is called', async ({ page }) => {
        await addNamed(page, 'manual', ['queued.txt']);
        // Give the rAF + microtasks a chance to start a worker — they shouldn't.
        await page.waitForTimeout(50);
        const status = await dz(page, 'manual').evaluate((el: any) => el.files[0].status);
        expect(status).toBe('pending');
        // The synthetic pump never received a registration either.
        const names = await pendingNames(page);
        expect(names).not.toContain('queued.txt');
    });

    test('uploadAll() starts the worker pool for queued files', async ({ page }) => {
        await addNamed(page, 'manual', ['queued.txt']);
        await dz(page, 'manual').evaluate((el: any) => { void el.uploadAll(); });
        await expect.poll(
            () => dz(page, 'manual').evaluate((el: any) => el.files[0].status)
        ).toBe('uploading');
    });
});

test.describe('concurrency cap', () => {
    test('only N workers are active at any time (concurrency="2")', async ({ page }) => {
        // 4 files arrive; with concurrency=2 we expect 2 in flight, 2 pending.
        await addNamed(page, 'conc', ['c1', 'c2', 'c3', 'c4']);
        await expect.poll(() => pendingNames(page).then(n => n.length)).toBe(2);

        const statuses = await dz(page, 'conc').evaluate((el: any) =>
            el.files.map((f: any) => ({ name: f.name, status: f.status }))
        );
        const uploading = statuses.filter((s: any) => s.status === 'uploading');
        const pending = statuses.filter((s: any) => s.status === 'pending');
        expect(uploading.length).toBe(2);
        expect(pending.length).toBe(2);
    });

    test('completing a worker frees the slot for the next queued file', async ({ page }) => {
        await addNamed(page, 'conc', ['c1', 'c2', 'c3', 'c4']);
        await expect.poll(() => pendingNames(page).then(n => n.length)).toBe(2);
        const first = (await pendingNames(page))[0];
        await resolveUpload(page, first, 'ok');
        // After one resolves a new one rotates in; pending pool stays at 2.
        await expect.poll(async () => {
            const names = await pendingNames(page);
            return names.length === 2 && !names.includes(first);
        }).toBe(true);
    });
});

test.describe('file-progress events', () => {
    test('progress pumps emit file-progress with monotonic values', async ({ page }) => {
        await addNamed(page, 'events', ['p.txt']);
        await expect.poll(() => pendingNames(page)).toContain('p.txt');

        await pumpProgress(page, 'p.txt', 25);
        await pumpProgress(page, 'p.txt', 75);
        await resolveUpload(page, 'p.txt', 'ok');

        // The log records every progress dispatch as a line.
        const text = await page.locator('#events-log').textContent();
        expect(text).toContain('progress p.txt=25');
        expect(text).toContain('progress p.txt=75');
    });

    test('status transitions fire file-status-changed (uploading → complete)', async ({ page }) => {
        await addNamed(page, 'events', ['s.txt']);
        await expect.poll(() => pendingNames(page)).toContain('s.txt');
        await resolveUpload(page, 's.txt', 'ok');

        await expect.poll(async () => {
            const text = await page.locator('#events-log').textContent();
            return text?.includes('status s.txt=uploading') && text.includes('status s.txt=complete');
        }).toBe(true);
    });
});
