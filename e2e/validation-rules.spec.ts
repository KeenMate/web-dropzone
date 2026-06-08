import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Section 14 — additional validation rules.
 *
 * Fixture: test/validation-rules.html. Covers the rules not exercised
 * by validation.spec.ts: min-file-size, max-total-size, min-file-count
 * + form validity, and dedupe-mode.
 */

const PAGE = '/test/validation-rules.html';

function dz(page: Page, id: string): Locator {
    return page.locator(`#${id}`);
}

function log(page: Page, id: string): Locator {
    return page.locator(`#${id}-log`);
}

async function stage(page: Page, id: string, specs: Array<{ name: string; size: number; type?: string }>): Promise<void> {
    await page.evaluate(({ id, specs }) => (window as any).__stage(id, specs), { id, specs });
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof (window as any).__stage === 'function');
});

test.describe('min-file-size', () => {
    test('files below the minimum are rejected with code="size"', async ({ page }) => {
        await stage(page, 'min-size', [{ name: 'tiny.txt', size: 100 }]);
        expect(await dz(page, 'min-size').evaluate((el: any) => el.files.length)).toBe(0);
        await expect(log(page, 'min-size')).toContainText('size tiny.txt');
    });

    test('files at or above the minimum pass', async ({ page }) => {
        await stage(page, 'min-size', [{ name: 'big.txt', size: 4096 }]);
        expect(await dz(page, 'min-size').evaluate((el: any) => el.files.length)).toBe(1);
    });
});

test.describe('max-total-size (aggregate cap)', () => {
    test('batch summing under the cap passes', async ({ page }) => {
        await stage(page, 'max-total', [
            { name: 'a.txt', size: 512 },
            { name: 'b.txt', size: 512 }
        ]);
        expect(await dz(page, 'max-total').evaluate((el: any) => el.files.length)).toBe(2);
    });

    test('files that would push the total over the cap are rejected', async ({ page }) => {
        // 1024 + 1024 = 2048 (at cap). Adding a third 1024 file exceeds.
        await stage(page, 'max-total', [
            { name: 'a.txt', size: 1024 },
            { name: 'b.txt', size: 1024 }
        ]);
        await stage(page, 'max-total', [{ name: 'c.txt', size: 1024 }]);
        expect(await dz(page, 'max-total').evaluate((el: any) => el.files.length)).toBe(2);
        await expect(log(page, 'max-total')).toContainText('size c.txt');
    });
});

test.describe('min-file-count + form validity', () => {
    test('zero files → form submit blocked (preventDefault not enough; setValidity short-circuits)', async ({ page }) => {
        // Form validity gate fires natively — no submit handler runs at all
        // when min-file-count isn't satisfied. The fixture's submit handler
        // would log 'submitted'; with the gate active we expect nothing.
        await page.locator('#min-count-form button[type="submit"]').click();
        const text = await log(page, 'min-count').textContent();
        expect(text ?? '').not.toContain('submitted');
    });

    test('1 file (under min=2) — still blocked', async ({ page }) => {
        await stage(page, 'min-count', [{ name: 'lone.txt', size: 64 }]);
        await page.locator('#min-count-form button[type="submit"]').click();
        const text = await log(page, 'min-count').textContent();
        expect(text ?? '').not.toContain('submitted');
    });

    test('2 files (at min=2) — submit succeeds', async ({ page }) => {
        await stage(page, 'min-count', [
            { name: 'a.txt', size: 64 },
            { name: 'b.txt', size: 64 }
        ]);
        await page.locator('#min-count-form button[type="submit"]').click();
        await expect(log(page, 'min-count')).toContainText('submitted');
    });
});

test.describe('dedupe-mode (default "name")', () => {
    test('same filename twice → second add rejected with code="duplicate"', async ({ page }) => {
        await stage(page, 'dedupe-name', [{ name: 'dup.txt', size: 64 }]);
        await stage(page, 'dedupe-name', [{ name: 'dup.txt', size: 64 }]);
        expect(await dz(page, 'dedupe-name').evaluate((el: any) => el.files.length)).toBe(1);
        await expect(log(page, 'dedupe-name')).toContainText('duplicate dup.txt');
    });
});

test.describe('dedupe-mode="none"', () => {
    test('duplicates are accepted', async ({ page }) => {
        await stage(page, 'dedupe-none', [{ name: 'same.txt', size: 64 }]);
        await stage(page, 'dedupe-none', [{ name: 'same.txt', size: 64 }]);
        expect(await dz(page, 'dedupe-none').evaluate((el: any) => el.files.length)).toBe(2);
    });
});
