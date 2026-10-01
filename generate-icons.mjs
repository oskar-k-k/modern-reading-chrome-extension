import {chromium} from '@playwright/test';
import {readFile} from 'node:fs/promises';

// Rasterize the checked-in vector without platform fonts or a new build dependency.
const svg = await readFile(new URL('./public/icons/mark.svg', import.meta.url), 'utf8');
const browser = await chromium.launch({channel: process.env.MODERN_READING_BROWSER ?? 'chromium', headless: true});
try {
    const page = await browser.newPage({deviceScaleFactor: 1});
    for (const size of [16, 32, 48, 128]) {
        await page.setViewportSize({width: size, height: size});
        await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100%;height:100%}</style>${svg}`);
        await page.screenshot({path: `public/icons/icon-${size}.png`, omitBackground: true});
    }
} finally {
    await browser.close();
}
