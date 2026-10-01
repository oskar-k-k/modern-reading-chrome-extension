import {parseSettings} from './model';
import {Reader} from './reader';

const scope = globalThis as typeof globalThis & {modernReadingInstalled?: boolean};
if (!scope.modernReadingInstalled) {
    scope.modernReadingInstalled = true;
    let settings = parseSettings(null);
    let manual: boolean | undefined;
    let revision = 0;
    const reader = new Reader(document, settings);
    const apply = () => reader.configure(manual ?? (settings.automatic && !settings.excludedOrigins.includes(location.origin)), settings);
    const ready = chrome.storage.local.get('settings').then(data => {
        if (revision !== 0) return;
        settings = parseSettings(data.settings);
        apply();
    }).catch(() => { /* Manual activation remains available when storage cannot be read. */ });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes.settings) return;
        revision++;
        const previous = settings;
        settings = parseSettings(changes.settings.newValue);
        if (previous.automatic !== settings.automatic || previous.excludedOrigins.join() !== settings.excludedOrigins.join()) manual = undefined;
        apply();
    });
    chrome.runtime.onMessage.addListener((message: unknown, _sender, respond) => {
        if (!message || typeof message !== 'object' || !('type' in message)) return;
        if (message.type !== 'modern-reading:status' && message.type !== 'modern-reading:toggle') return;
        void ready.then(() => {
            if (message.type === 'modern-reading:toggle' && 'enabled' in message && typeof message.enabled === 'boolean') {
                manual = message.enabled;
                revision++;
                apply();
            }
            respond(reader.status());
        });
        return true;
    });
}
