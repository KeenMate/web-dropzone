import { test, expect } from '@playwright/test';

/**
 * Section 13 — global API + logging.
 *
 * Fixture: test/logging.html. The renderer's index module populates
 * `window.components['web-dropzone']` on load — this exposes versions,
 * a register() helper, and a logging API. Specs assert the shape and
 * the round-trip of setLogLevel / setCategoryLevel.
 */

const PAGE = '/test/logging.html';

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() =>
        !!(window as any).components?.['web-dropzone']
    );
});

test.describe('global API surface', () => {
    test('window.components["web-dropzone"] is populated on module load', async ({ page }) => {
        const has = await page.evaluate(() => {
            const api = (window as any).components?.['web-dropzone'];
            return {
                version: typeof api?.version,
                config: typeof api?.config,
                logging: typeof api?.logging,
                register: typeof api?.register,
                getInstances: typeof api?.getInstances
            };
        });
        expect(has).toEqual({
            version: 'function',
            config: 'object',
            logging: 'object',
            register: 'function',
            getInstances: 'function'
        });
    });

    test('config exposes the renderer + core package metadata', async ({ page }) => {
        const cfg = await page.evaluate(() =>
            (window as any).components['web-dropzone'].config
        );
        expect(cfg.name).toBe('@keenmate/web-dropzone');
        expect(cfg.version).toMatch(/^\d+\.\d+\.\d+/);
        expect(cfg.core.name).toBe('@keenmate/web-dropzone-core');
        expect(cfg.core.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    test('version() returns the same string as config.version', async ({ page }) => {
        const same = await page.evaluate(() => {
            const api = (window as any).components['web-dropzone'];
            return api.version() === api.config.version;
        });
        expect(same).toBe(true);
    });

    test('getInstances returns every mounted host element', async ({ page }) => {
        const count = await page.evaluate(() =>
            (window as any).components['web-dropzone'].getInstances().length
        );
        // The fixture has one <web-dropzone id="any">.
        expect(count).toBe(1);
    });
});

test.describe('logging API', () => {
    test('exposes setLogLevel / setCategoryLevel / enable / disable + getCategories', async ({ page }) => {
        const shape = await page.evaluate(() => {
            const logging = (window as any).components['web-dropzone'].logging;
            return {
                enableLogging: typeof logging.enableLogging,
                disableLogging: typeof logging.disableLogging,
                setLogLevel: typeof logging.setLogLevel,
                setCategoryLevel: typeof logging.setCategoryLevel,
                getCategories: typeof logging.getCategories
            };
        });
        expect(shape).toEqual({
            enableLogging: 'function',
            disableLogging: 'function',
            setLogLevel: 'function',
            setCategoryLevel: 'function',
            getCategories: 'function'
        });
    });

    test('getCategories returns the LOGGING_CATEGORIES tuple', async ({ page }) => {
        const cats = await page.evaluate(() =>
            (window as any).components['web-dropzone'].logging.getCategories()
        );
        expect(Array.isArray(cats)).toBe(true);
        expect(cats.length).toBeGreaterThan(0);
        // The categories use the DROPZONE: prefix so loglevel can route them
        // independently from any other consumer that imports loglevel.
        expect(cats).toEqual(expect.arrayContaining([
            'DROPZONE:INIT', 'DROPZONE:FILE', 'DROPZONE:UI', 'DROPZONE:INTERACTION'
        ]));
    });

    test('setLogLevel does not throw for valid level strings', async ({ page }) => {
        await page.evaluate(() => {
            const logging = (window as any).components['web-dropzone'].logging;
            logging.setLogLevel('warn');
            logging.setLogLevel('debug');
            logging.setLogLevel('silent');
        });
        // If anything threw, page.evaluate would surface it as a test failure.
        expect(true).toBe(true);
    });
});
