import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Section 10 — async confirmation gates.
 *
 * Fixture: test/gates.html. Covers the two gates added in the prior
 * release:
 *
 *   - `beforeFilesAddedCallback(files, existingFiles) → boolean`
 *     Runs once per add batch AFTER sync validation. Resolving false
 *     fires `files-rejected` with `code: 'cancelled'`.
 *
 *   - `beforeFilesRemovedCallback(files, allFiles) → boolean`
 *     Runs on user-initiated removes (or programmatic removeFile
 *     with `{ confirm: true }`). Resolving false aborts — no
 *     `file-removed` event, no state change.
 */

const PAGE = '/test/gates.html';

function dz(page: Page, id: string): Locator {
    return page.locator(`#${id}`);
}

async function addNamed(page: Page, id: string, names: string[]): Promise<void> {
    await page.evaluate(({ id, names }) => (window as any).__addNamed(id, names), { id, names });
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof (window as any).__addNamed === 'function');
});

test.describe('beforeFilesAddedCallback', () => {
    test('resolve(true) — files enter the store normally', async ({ page }) => {
        await addNamed(page, 'add-accept', ['ok.txt']);
        const count = await dz(page, 'add-accept').evaluate((el: any) => el.files.length);
        expect(count).toBe(1);
    });

    test('resolve(false) — files-rejected with code="cancelled"; store stays empty', async ({ page }) => {
        await addNamed(page, 'add-reject', ['nope.txt']);
        const count = await dz(page, 'add-reject').evaluate((el: any) => el.files.length);
        expect(count).toBe(0);
        await expect(page.locator('#add-reject-log')).toContainText('cancelled nope.txt');
    });

    test('callback receives (files: File[], existingFiles: FileState[])', async ({ page }) => {
        // First add — existing is empty
        await addNamed(page, 'add-args', ['one.txt', 'two.txt']);
        await expect(page.locator('#add-args-log')).toContainText('files=2 existing=0');
        await expect(page.locator('#add-args-log')).toContainText('names=one.txt,two.txt');

        // Second add — existing now has 2; new batch arrives fresh
        await addNamed(page, 'add-args', ['three.txt']);
        await expect(page.locator('#add-args-log')).toContainText('files=1 existing=2');
    });
});

test.describe('beforeFilesRemovedCallback', () => {
    test('resolve(true) — file leaves the store via removeFile({ confirm: true })', async ({ page }) => {
        await addNamed(page, 'rm-accept', ['gone.txt']);
        await dz(page, 'rm-accept').evaluate((el: any) => {
            const id = el.files[0].id;
            return el.removeFile(id, { confirm: true });
        });
        const count = await dz(page, 'rm-accept').evaluate((el: any) => el.files.length);
        expect(count).toBe(0);
    });

    test('resolve(false) — file stays in the store; no state change', async ({ page }) => {
        await addNamed(page, 'rm-reject', ['sticky.txt']);
        await dz(page, 'rm-reject').evaluate((el: any) => {
            const id = el.files[0].id;
            return el.removeFile(id, { confirm: true });
        });
        const count = await dz(page, 'rm-reject').evaluate((el: any) => el.files.length);
        expect(count).toBe(1);
    });

    test('programmatic removeFile() without opts SKIPS the gate (default)', async ({ page }) => {
        await addNamed(page, 'rm-reject', ['bypass.txt']);
        await dz(page, 'rm-reject').evaluate((el: any) => {
            const id = el.files[0].id;
            // No { confirm: true } — gate is skipped, removal proceeds even though
            // beforeFilesRemovedCallback returns false.
            return el.removeFile(id);
        });
        const count = await dz(page, 'rm-reject').evaluate((el: any) => el.files.length);
        expect(count).toBe(0);
    });
});
