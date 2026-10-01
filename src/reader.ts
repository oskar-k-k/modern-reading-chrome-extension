import {readingSegments, type Settings} from './model';

const excluded = 'script,style,noscript,textarea,input,select,option,button,pre,code,kbd,samp,svg,math,nav,header,footer,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="button"],[hidden],[aria-hidden="true"],[data-modern-reading]';
const blocks = 'p,li,blockquote,div,article,section,td,dd';

/** Applies reversible prefix highlighting, preserving existing elements and event listeners. */
export class Reader {
    private settings: Settings;
    private records = new Map<HTMLElement, {original: Text; initial: string}>();
    private pending = new Set<Element>();
    private timer: ReturnType<typeof setTimeout> | undefined;
    private observer: MutationObserver;
    private enabled = false;

    constructor(private document: Document, settings: Settings) {
        this.settings = settings;
        this.observer = new MutationObserver(changes => {
            for (const change of changes) {
                const target = change.target.nodeType === 1 ? change.target as Element : change.target.parentElement;
                if (target) this.enqueue(target.closest(blocks) ?? target);
            }
        });
    }

    /** Returns the current mode and number of connected highlighted text blocks. */
    status() {
        const parents = new Set<Element>();
        for (const span of this.records.keys()) {
            if (!span.isConnected) { this.records.delete(span); continue; }
            const parent = span.parentElement?.closest(blocks);
            if (parent) parents.add(parent);
        }
        return {enabled: this.enabled, count: parents.size};
    }

    /** Reconfigures the reader and restores the original text when disabled. */
    configure(enabled: boolean, settings: Settings) {
        this.stop();
        this.settings = settings;
        this.enabled = enabled;
        if (enabled && this.document.body) {
            this.enqueue(this.document.body);
            this.observe();
        }
    }

    private observe() {
        this.observer.observe(this.document.body, {subtree: true, childList: true, characterData: true});
    }

    private stop() {
        this.observer.disconnect();
        clearTimeout(this.timer);
        this.timer = undefined;
        this.pending.clear();
        for (const [span, {original, initial}] of this.records) {
            if (!span.isConnected) continue;
            // A framework may retain and update the detached original text node.
            if (original.data === initial) original.data = span.textContent ?? '';
            span.replaceWith(original);
        }
        this.records.clear();
    }

    private enqueue(root: Element) {
        this.pending.add(root);
        if (this.timer === undefined) this.timer = setTimeout(() => this.flush(), 30);
    }

    private flush() {
        this.timer = undefined;
        this.observer.disconnect();
        const start = performance.now();
        for (const root of this.pending) {
            this.pending.delete(root);
            if (root.isConnected) this.process(root);
            if (performance.now() - start > 12) break;
        }
        this.status();
        if (this.enabled) this.observe();
        if (this.pending.size) this.timer = setTimeout(() => this.flush(), 30);
    }

    private process(root: Element) {
        if (root.closest(excluded)) return;
        // Queue nested blocks without repeatedly walking their entire subtrees.
        const walker = this.document.createTreeWalker(root, 5, {acceptNode: node => {
            if (node.nodeType === 1) {
                const element = node as Element;
                if (element.matches(excluded)) return 2;
                if (element.matches(blocks)) { this.pending.add(element); return 2; }
                return 3;
            }
            return 1;
        }});
        const nodes: Text[] = [];
        while (walker.nextNode()) {
            const node = walker.currentNode as Text;
            const parent = node.parentElement;
            if (!parent || parent.closest(excluded) || parent.closest(blocks) !== root) continue;
            if (!node.data.trim() || node.data.length > 20000) continue;
            nodes.push(node);
        }
        if ((root.textContent?.trim().length ?? 0) < this.settings.minimum) return;
        for (const node of nodes) this.highlight(node);
    }

    private highlight(node: Text) {
        const span = this.document.createElement('span');
        span.dataset.modernReading = '';
        for (const segment of readingSegments(node.data, this.settings.fraction)) {
            if (!segment.highlighted) span.append(this.document.createTextNode(segment.text));
            else {
                const prefix = this.document.createElement('span');
                prefix.style.setProperty('font-weight', '750', 'important');
                prefix.textContent = segment.text;
                span.append(prefix);
            }
        }
        this.records.set(span, {original: node, initial: node.data});
        node.replaceWith(span);
    }
}
