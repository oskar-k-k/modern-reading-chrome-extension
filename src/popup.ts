import {modernReadingMessages} from './modern-reading.mjs';
import {defaults, parseSettings, readingSegments, type Settings} from './model';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const automatic = element<HTMLInputElement>('automatic');
const excluded = element<HTMLInputElement>('excluded');
const fraction = element<HTMLInputElement>('fraction');
const minimum = element<HTMLSelectElement>('minimum');
const locale = element<HTMLSelectElement>('locale');
const status = element<HTMLParagraphElement>('status');
let settings: Settings = {...defaults};
let tabId: number | undefined;
let origin: string | undefined;
let connected = false;
let busy = false;
let statusKey: keyof typeof modernReadingMessages.en = 'loading';

function notify(key: typeof statusKey) {
    statusKey = key;
    status.textContent = modernReadingMessages[settings.locale][key];
}

function render() {
    const copy = modernReadingMessages[settings.locale];
    document.documentElement.lang = settings.locale;
    element('version').textContent = chrome.runtime.getManifest().version;
    document.querySelectorAll<HTMLElement>('[data-copy]').forEach(node => {
        node.textContent = copy[node.dataset.copy as keyof typeof copy];
    });
    automatic.checked = settings.automatic;
    excluded.checked = !!origin && settings.excludedOrigins.includes(origin);
    excluded.disabled = busy || !origin;
    fraction.value = String(settings.fraction * 100);
    minimum.value = String(settings.minimum);
    locale.value = settings.locale;
    element('fraction-value').textContent = `${Math.round(settings.fraction * 100)}%`;
    for (const option of minimum.options) option.textContent = `${option.value} ${copy.characters}`;
    const preview = element('preview');
    preview.replaceChildren();
    for (const segment of readingSegments(copy.sample, settings.fraction)) {
        const node = document.createElement('span');
        node.textContent = segment.text;
        if (segment.highlighted) node.style.fontWeight = '750';
        preview.append(node);
    }
    notify(statusKey);
}

async function refreshStatus() {
    if (!connected || tabId === undefined) return;
    const response: unknown = await chrome.tabs.sendMessage(tabId, {type: 'modern-reading:status'});
    if (!response || typeof response !== 'object' || !('enabled' in response) || typeof response.enabled !== 'boolean' || !('count' in response) || typeof response.count !== 'number') throw new Error('Invalid reader status');
    if (!settings.automatic) { notify('ready'); return; }
    if (origin && settings.excludedOrigins.includes(origin)) { notify('sitePaused'); return; }
    notify(response.enabled ? 'active' : 'ready');
}

async function save(next: Settings) {
    await chrome.storage.local.set({settings: next});
    settings = next;
    render();
}

async function run(action: () => Promise<void>) {
    if (busy) return;
    busy = true;
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input,select,button').forEach(control => { control.disabled = true; });
    try { await action(); }
    catch {
        try { settings = parseSettings((await chrome.storage.local.get('settings')).settings); } catch { /* Keep the last readable settings when storage is unavailable. */ }
        notify('error');
    }
    finally {
        busy = false;
        document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input,select,button').forEach(control => { control.disabled = false; });
        render();
    }
}

automatic.addEventListener('change', () => {
    const requested = automatic.checked;
    void run(async () => {
        await save({...settings, automatic: requested});
        const response: unknown = await chrome.runtime.sendMessage({type: 'modern-reading:reconcile'});
        if (!response || typeof response !== 'object' || !('ok' in response) || response.ok !== true) {
            throw new Error('Automatic injection could not be registered');
        }
        if (connected) await refreshStatus();
    });
});
excluded.addEventListener('change', () => { void run(async () => {
    const excludedOrigins = settings.excludedOrigins.filter(value => value !== origin);
    if (excluded.checked && origin) excludedOrigins.push(origin);
    await save({...settings, excludedOrigins});
    await refreshStatus();
}); });
fraction.addEventListener('input', () => {
    settings = {...settings, fraction: Number(fraction.value) / 100};
    render();
});
fraction.addEventListener('change', () => { void run(() => save(settings)); });
minimum.addEventListener('change', () => { void run(() => save({...settings, minimum: Number(minimum.value)})); });
locale.addEventListener('change', () => { void run(() => save({...settings, locale: locale.value === 'de' ? 'de' : 'en'})); });
element('reset').addEventListener('click', () => { void run(async () => {
    await save({...defaults, locale: settings.locale});
    await chrome.runtime.sendMessage({type: 'modern-reading:reconcile'});
    await refreshStatus();
}); });

async function initialize() {
    const data = await chrome.storage.local.get('settings');
    settings = parseSettings(data.settings ?? {...defaults, locale: chrome.i18n.getUILanguage().startsWith('de') ? 'de' : 'en'});
    render();
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab?.id || !tab.url || !/^https?:\/\//.test(tab.url)) { notify('unsupported'); return; }
    tabId = tab.id;
    origin = new URL(tab.url).origin;
    try {
        await chrome.scripting.executeScript({target: {tabId}, files: ['content.js']});
        connected = true;
        await refreshStatus();
    } catch { notify('unsupported'); }
}
render();
document.addEventListener('keydown', event => {
    if (event.key === 'Tab') document.body.classList.add('keyboard-navigation');
});
document.addEventListener('pointerdown', () => document.body.classList.remove('keyboard-navigation'));
void run(initialize);
// Refresh the mode and detect lost connections without inferring page content from block counts.
setInterval(() => {
    if (!busy && connected && statusKey !== 'error' && statusKey !== 'denied') {
        void refreshStatus().catch(() => { connected = false; notify('error'); render(); });
    }
}, 1000);
