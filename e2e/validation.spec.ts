import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Section 2 — validation gates.
 *
 * Fixture: test/validation.html. Four dropzones, each with one validation
 * rule. Every dropzone has a sibling `.event-log` that receives one line
 * per rejection in the form `<code> <name>` — specs assert on its
 * textContent rather than poking at the files-rejected detail directly,
 * which keeps the assertions simple and robust to detail-shape evolution.
 */

const PAGE = '/test/validation.html';

function dz(page: Page, id: string): Locator {
    return page.locator(`#${id}`);
}

function log(page: Page, id: string): Locator {
    return page.locator(`#${id}-log`);
}

async function addFiles(p: Locator, specs: Array<{ name: string; size: number; type?: string }>): Promise<void> {
    await p.evaluate((el: any, specs) => {
        const files = specs.map(s => {
            // Build a Blob of the requested size, then wrap as File.
            const bytes = new Uint8Array(s.size);
            return new File([bytes], s.name, { type: s.type || 'application/octet-stream' });
        });
        return el.addFiles(files);
    }, specs);
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
});

test.describe('max-file-size', () => {
    test('files at or below the limit are accepted', async ({ page }) => {
        const p = dz(page, 'size');
        await addFiles(p, [{ name: 'small.txt', size: 500 }]);
        expect(await p.evaluate((el: any) => el.files.length)).toBe(1);
        await expect(log(page, 'size')).toHaveText('');
    });

    test('files above the limit fire files-rejected with code="size"', async ({ page }) => {
        const p = dz(page, 'size');
        await addFiles(p, [{ name: 'big.txt', size: 2048 }]);
        expect(await p.evaluate((el: any) => el.files.length)).toBe(0);
        await expect(log(page, 'size')).toContainText('size big.txt');
    });
});

test.describe('max-file-count', () => {
    test('first N files are accepted', async ({ page }) => {
        const p = dz(page, 'count');
        await addFiles(p, [
            { name: 'a.txt', size: 10 },
            { name: 'b.txt', size: 10 }
        ]);
        expect(await p.evaluate((el: any) => el.files.length)).toBe(2);
    });

    test('files past the cap fire files-rejected with code="count"', async ({ page }) => {
        const p = dz(page, 'count');
        await addFiles(p, [
            { name: 'a.txt', size: 10 },
            { name: 'b.txt', size: 10 },
            { name: 'c.txt', size: 10 }
        ]);
        expect(await p.evaluate((el: any) => el.files.length)).toBe(2);
        await expect(log(page, 'count')).toContainText('count c.txt');
    });
});

test.describe('accept (type filter)', () => {
    test('matching MIME types pass', async ({ page }) => {
        const p = dz(page, 'type');
        await addFiles(p, [{ name: 'photo.png', size: 10, type: 'image/png' }]);
        expect(await p.evaluate((el: any) => el.files.length)).toBe(1);
    });

    test('non-matching MIME types fire files-rejected with code="type"', async ({ page }) => {
        const p = dz(page, 'type');
        await addFiles(p, [{ name: 'doc.pdf', size: 10, type: 'application/pdf' }]);
        expect(await p.evaluate((el: any) => el.files.length)).toBe(0);
        await expect(log(page, 'type')).toContainText('type doc.pdf');
    });
});

test.describe('validateCallback (custom rule)', () => {
    test('passes files that satisfy the callback', async ({ page }) => {
        const p = dz(page, 'custom');
        await addFiles(p, [{ name: 'good.txt', size: 10 }]);
        expect(await p.evaluate((el: any) => el.files.length)).toBe(1);
    });

    test('rejects with code="custom" + the callback-supplied error', async ({ page }) => {
        const p = dz(page, 'custom');
        await addFiles(p, [{ name: 'bad.txt', size: 10 }]);
        expect(await p.evaluate((el: any) => el.files.length)).toBe(0);
        await expect(log(page, 'custom')).toContainText('custom bad.txt');
    });
});
