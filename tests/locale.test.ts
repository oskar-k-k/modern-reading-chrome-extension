import {describe, expect, it} from 'vitest';
import {resolveLocale, locales} from '../src/locale';
import {parseSettings} from '../src/model';
import {modernReadingMessages} from '../src/modern-reading.mjs';
describe('language selection', () => {
    it.each([['de-DE','de'],['en-US','en'],['es-MX','es'],['fr-CA','fr'],['pt-BR','pt'],['ja-JP','ja'],['zh-Hans-CN','zh_CN'],['zh_CN','zh_CN'],['zh-TW','en'],['xx','en'],[null,'en']])('maps %s to %s', (tag, expected) => {expect(resolveLocale(tag)).toBe(expected);});
    it.each(locales)('preserves saved %s and provides all UI messages', locale => {
        expect(parseSettings({locale}).locale).toBe(locale);
        expect(Object.keys(modernReadingMessages[locale]).sort()).toEqual(Object.keys(modernReadingMessages.en).sort());
    });
});