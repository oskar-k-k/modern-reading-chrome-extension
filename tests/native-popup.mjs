import {expect} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';

/** Checks the real toolbar popup, which Playwright does not expose as a regular Page. */
export async function checkNativePopup(context, page, worker) {
    const cdp = await context.newCDPSession(page);
    await page.bringToFront();
    await worker.evaluate(() => chrome.action.openPopup());
    let target;
    await expect.poll(async () => {
        target = (await cdp.send('Target.getTargets')).targetInfos.find(item => item.url.endsWith('/popup.html'));
        return Boolean(target);
    }).toBe(true);
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: target.targetId, flatten: false});
    let nextId = 0;
    async function send(method, params = {}) {
        const id = ++nextId;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                cdp.off('Target.receivedMessageFromTarget', receive);
                reject(new Error(`Native popup command timed out: ${method}`));
            }, 5000);
            function receive(event) {
                const message = JSON.parse(event.message);
                if (event.sessionId !== sessionId || message.id !== id) return;
                clearTimeout(timer);
                cdp.off('Target.receivedMessageFromTarget', receive);
                if (message.error) reject(new Error(message.error.message));
                else resolve(message.result);
            }
            cdp.on('Target.receivedMessageFromTarget', receive);
            cdp.send('Target.sendMessageToTarget', {sessionId, message: JSON.stringify({id, method, params})})
                .catch(error => {
                    clearTimeout(timer);
                    cdp.off('Target.receivedMessageFromTarget', receive);
                    reject(error);
                });
        });
    }
    try {
        await expect.poll(async () => {
            const result = await send('Runtime.evaluate', {
                expression: 'document.readyState === "complete" && !document.querySelector("#automatic").disabled',
                returnByValue: true,
            });
            return result.result.value;
        }).toBe(true);
        const metrics = await send('Runtime.evaluate', {
            expression: '({width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth})',
            returnByValue: true,
        });
        expect(metrics.result.value.width).toBe(380);
        expect(metrics.result.value.scrollWidth).toBe(380);
        expect(metrics.result.value.height).toBeLessThan(340);
        const screenshot = await send('Page.captureScreenshot');
        await mkdir('test-results', {recursive: true});
        await writeFile('test-results/native-popup.png', Buffer.from(screenshot.data, 'base64'));
        const measure = async () => (await send('Runtime.evaluate', {
            expression: '({width:innerWidth, content:document.querySelector("main").getBoundingClientRect().width})',
            returnByValue: true,
        })).result.value;
        const collapsed = await measure();
        for (const open of [true, false, true]) {
            await send('Runtime.evaluate', {expression: `document.querySelector('details').open = ${open}`});
            await expect.poll(async () => (await send('Runtime.evaluate', {expression: 'innerHeight', returnByValue: true})).result.value).toBe(open ? 480 : metrics.result.value.height);
            await expect.poll(measure).toEqual(collapsed);
        }
        const expanded = await send('Page.captureScreenshot');
        await writeFile('test-results/native-popup-expanded.png', Buffer.from(expanded.data, 'base64'));
    } finally {
        await cdp.send('Target.closeTarget', {targetId: target.targetId});
        await cdp.detach();
    }
}
