// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from 'vitest';
import {defaults, parseSettings, readingSegments} from '../src/model';
import {Reader} from '../src/reader';

const paragraph = 'Reading should feel comfortable. These longer paragraphs give your eyes a consistent place to land while preserving every word and punctuation mark.';
let reader: Reader | undefined;
const settle = () => new Promise(resolve => setTimeout(resolve, 120));
afterEach(() => { reader?.configure(false, defaults); document.body.replaceChildren(); });

describe('reading model', () => {
    it('starts new installations automatically and preserves an explicit pause', () => {
        expect(parseSettings(undefined).automatic).toBe(true);
        expect(parseSettings({automatic: false}).automatic).toBe(false);
    });
    it('preserves multilingual text, emoji, combining marks and whitespace exactly', () => {
        for (const text of ['Grüße!\nStraße 123 👩‍💻', 'e\u0301lan — beautiful', '你好 世界', '<script>alert("x")</script>']) {
            expect(readingSegments(text, 0.5).map(part => part.text).join('')).toBe(text);
        }
        expect(readingSegments('e\u0301lan', 0.2)[0].text).toBe('e\u0301');
        expect(readingSegments('123', 0.5).every(part => !part.highlighted)).toBe(true);
    });
    it('validates storage values and rejects non-HTTP origins', () => {
        expect(parseSettings({automatic: 'true', fraction: NaN, minimum: -3, excludedOrigins: ['https://example.com', 'javascript:alert(1)', 'https://example.com/path'], locale: 'fr'}))
            .toEqual({...defaults, minimum: 40, excludedOrigins: ['https://example.com']});
        expect(parseSettings(null)).toEqual(defaults);
    });
});

describe('reversible website reading', () => {
    it('preserves text, original nodes, links and their handlers after repeated toggles', async () => {
        document.body.innerHTML = `<article><p>${paragraph} <a href="#read">Read more here</a>.</p></article>`;
        const p = document.querySelector('p')!;
        const original = p.firstChild;
        const text = p.textContent;
        const link = document.querySelector('a')!;
        const click = vi.fn();
        link.addEventListener('click', click);
        reader = new Reader(document, defaults);
        reader.configure(true, defaults);
        await settle();
        expect(reader.status().count).toBe(1);
        expect(p.textContent).toBe(text);
        link.click();
        expect(click).toHaveBeenCalledOnce();
        reader.configure(true, {...defaults, fraction: 0.7});
        await settle();
        expect(document.querySelector('[data-modern-reading] [data-modern-reading]')).toBeNull();
        reader.configure(false, defaults);
        expect(p.firstChild).toBe(original);
        expect(document.querySelector('a')).toBe(link);
        expect(p.textContent).toBe(text);
    });
    it('skips editors, code, navigation, hidden content and short paragraphs', async () => {
        document.body.innerHTML = `<nav><p>${paragraph}</p></nav><div contenteditable><p>${paragraph}</p></div><pre>${paragraph}</pre><p hidden>${paragraph}</p><p>Short text</p><p>${paragraph}</p>`;
        reader = new Reader(document, defaults);
        reader.configure(true, defaults);
        await settle();
        expect(reader.status().count).toBe(1);
        expect(document.querySelector('nav span,pre span,[contenteditable] span,[hidden] span')).toBeNull();
    });
    it('handles added paragraphs and keeps site updates when disabled', async () => {
        document.body.innerHTML = `<main><p>${paragraph}</p></main>`;
        reader = new Reader(document, defaults);
        reader.configure(true, defaults);
        await settle();
        const added = document.createElement('p');
        added.textContent = paragraph;
        document.querySelector('main')!.append(added);
        await settle();
        expect(reader.status().count).toBe(2);
        const wrapper = document.querySelector('[data-modern-reading]')!;
        wrapper.textContent = 'Updated by the website';
        reader.configure(false, defaults);
        expect(document.querySelector('p')!.textContent).toBe('Updated by the website');
        expect(document.querySelector('[data-modern-reading]')).toBeNull();
    });
    it('handles character-data changes and cancels queued work on disable', async () => {
        const p = document.createElement('p');
        const text = document.createTextNode('Short');
        p.append(text);
        document.body.append(p);
        reader = new Reader(document, defaults);
        reader.configure(true, defaults);
        await settle();
        text.data = paragraph;
        await settle();
        expect(reader.status().count).toBe(1);
        reader.configure(true, defaults);
        reader.configure(false, defaults);
        await settle();
        expect(document.querySelector('[data-modern-reading]')).toBeNull();
    });
    it('preserves framework updates to a retained original text node on restoration', async () => {
        const p = document.createElement('p');
        const original = document.createTextNode(paragraph);
        p.append(original);
        document.body.append(p);
        reader = new Reader(document, defaults);
        reader.configure(true, defaults);
        await settle();
        original.data = 'Updated through a retained framework reference';
        reader.configure(false, defaults);
        expect(p.textContent).toBe(original.data);
        expect(p.firstChild).toBe(original);
    });
});
