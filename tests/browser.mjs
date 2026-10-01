import {chromium, expect} from '@playwright/test';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {mkdir, readFile} from 'node:fs/promises';
import {checkNativePopup} from './native-popup.mjs';

const text = 'A quieter way to read. Follow the beginnings of these words and find a comfortable rhythm. This paragraph is deliberately long enough to exercise automatic paragraph detection.';
const server = createServer((_request, response) => {
    response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    response.end(`<!doctype html><html lang="en"><title>Reading fixture</title><body><main><h1>Reading fixture</h1><p id="article">${text} <a href="#more">Continue reading</a></p><p>Short text.</p><div contenteditable="true"><p>${text}</p></div><pre>${text}</pre></main></body></html>`);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
const url = `http://127.0.0.1:${address.port}`;
const extension = resolve('dist');
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
expect(manifest.host_permissions).toEqual(['http://*/*', 'https://*/*']);
expect(manifest.optional_host_permissions).toBeUndefined();
let context;
try {
    context = await chromium.launchPersistentContext('', {
        channel: process.env.MODERN_READING_BROWSER ?? 'chromium', headless: true,
        args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--auto-confirm-extension-installs=accept'],
    });
    const errors = [];
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const page = await context.newPage();
    await page.goto(url);
    await expect(page.locator('#article [data-modern-reading]').first()).toBeAttached();
    await checkNativePopup(context, page, worker);
    await page.bringToFront();
    const target = await worker.evaluate(async () => (await chrome.tabs.query({active: true, currentWindow: true}))[0]);
    const popup = await context.newPage();
    // Opening the popup as a test tab changes the active tab; retain the real article target.
    await popup.addInitScript(({id, url}) => {
        const query = chrome.tabs.query.bind(chrome.tabs);
        chrome.tabs.query = options => options.active ? Promise.resolve([{id, url}]) : query(options);
    }, {id: target.id, url});
    await page.bringToFront();
    await popup.goto(`chrome-extension://${worker.url().split('/')[2]}/popup.html`);
    // Fresh installation works without opening the popup or granting runtime permissions.
    await expect(page.locator('#article [data-modern-reading]').first()).toBeAttached();
    await expect(page.locator('#article')).toHaveText(text + ' Continue reading');
    await expect(page.locator('pre [data-modern-reading], [contenteditable] [data-modern-reading]')).toHaveCount(0);
    await expect(popup.locator('#automatic')).toBeChecked();
    await expect(popup.locator('#advanced')).not.toHaveAttribute('open');
    await expect(popup.locator('footer')).not.toBeVisible();
    await expect(popup.locator('.support')).toBeVisible();
    await expect(popup.getByRole('link', {name: 'Ko-fi', exact: true})).toHaveAttribute('href', 'https://ko-fi.com/oskar_k_k');
    await expect(popup.getByRole('link', {name: 'Patreon', exact: true})).toHaveAttribute('href', 'https://www.patreon.com/cw/oskar_k_k');
    for (const logo of await popup.locator('.support img').all()) {
        expect(await logo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    }
    await popup.setViewportSize({width: 380, height: 580});
    expect(await popup.evaluate(() => document.body.getBoundingClientRect().height)).toBeLessThan(320);
    // Guard against Chrome's initial narrow viewport collapsing the intrinsic popup width.
    await popup.setViewportSize({width: 180, height: 580});
    expect(await popup.evaluate(() => document.documentElement.getBoundingClientRect().width)).toBe(380);
    await popup.setViewportSize({width: 380, height: 580});
    await popup.locator('summary').click();
    await expect(popup.locator('footer')).toBeVisible();
    await expect(popup.locator('#version')).toHaveText(manifest.version);
    expect(await popup.locator('summary').evaluate(node => getComputedStyle(node).outlineStyle)).toBe('none');
    await popup.keyboard.press('Tab');
    expect(await popup.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)).toBe('solid');
    await popup.locator('#minimum').click();
    expect(await popup.locator('#minimum').evaluate(node => getComputedStyle(node).outlineStyle)).toBe('none');
    await popup.keyboard.press('Escape');
    for (const size of [16, 32, 48, 128]) {
        expect(await popup.evaluate(async size => {
            const image = new Image();
            image.src = chrome.runtime.getURL(`icons/icon-${size}.png`);
            await image.decode();
            return [image.naturalWidth, image.naturalHeight];
        }, size)).toEqual([size, size]);
    }
    await popup.locator('#locale').selectOption('de');
    await expect(popup.locator('html')).toHaveAttribute('lang', 'de');
    await popup.locator('summary').click();
    await mkdir('test-results', {recursive: true});
    await popup.screenshot({path: 'test-results/popup-de.png'});
    await popup.locator('#automatic').focus();
    await popup.keyboard.press('Space');
    await expect(page.locator('[data-modern-reading]')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('[data-modern-reading]')).toHaveCount(0);
    await popup.reload();
    await expect(popup.locator('#automatic')).not.toBeChecked();
    await popup.locator('#automatic').check();
    await expect(page.locator('#article [data-modern-reading]').first()).toBeAttached();
    await popup.locator('summary').click();
    await popup.locator('#fraction').fill('70');
    await popup.locator('#fraction').dispatchEvent('change');
    await expect(popup.locator('#fraction-value')).toHaveText('70%');
    await popup.locator('#minimum').selectOption('1000');
    await expect(page.locator('[data-modern-reading]')).toHaveCount(0);
    await expect(popup.locator('#status')).toHaveText('Lesemodus für diese Website eingeschaltet.');
    await popup.locator('#minimum').selectOption('120');
    await popup.locator('#excluded').check();
    await expect(page.locator('[data-modern-reading]')).toHaveCount(0);
    await page.reload();
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('settings')).settings.excludedOrigins.length)).toBe(1);
    await expect(page.locator('[data-modern-reading]')).toHaveCount(0);
    await popup.locator('#excluded').uncheck();
    await expect(page.locator('#article [data-modern-reading]').first()).toBeAttached();
    await popup.locator('#reset').click();
    await expect(popup.locator('#fraction-value')).toHaveText('50%');
    await expect(popup.locator('#automatic')).toBeChecked();
    await popup.screenshot({path: 'test-results/popup-advanced.png', fullPage: true});
    await popup.locator('footer').scrollIntoViewIfNeeded();
    await popup.screenshot({path: 'test-results/popup-info.png'});
    await popup.locator('#locale').selectOption('en');
    await popup.locator('summary').click();
    await popup.screenshot({path: 'test-results/popup-en.png'});
    await popup.close();
    await page.reload();
    await expect(page.locator('#article [data-modern-reading]').first()).toBeAttached();
    await page.evaluate(value => {
        const p = document.createElement('p'); p.id = 'dynamic'; p.textContent = value;
        document.querySelector('main').append(p);
    }, text);
    await expect(page.locator('#dynamic [data-modern-reading]')).toBeAttached();
    const unsupported = await context.newPage();
    await unsupported.goto('chrome-extension://' + worker.url().split('/')[2] + '/popup.html');
    await expect(unsupported.locator('#automatic')).toBeEnabled();
    await expect(unsupported.locator('#status')).toContainText('This page cannot be changed');
    await unsupported.locator('#automatic').uncheck();
    await expect(page.locator('[data-modern-reading]')).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log('Browser checks passed: automatic fresh install, persistent pause, keyboard toggle, collapsed popup sizing, EN/DE, strength, exclusions, reset, reload, dynamic text and protected-page feedback.');
} finally {
    await context?.close();
    server.close();
}
