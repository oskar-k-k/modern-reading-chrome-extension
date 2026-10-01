export const locales = ['en', 'de', 'es', 'fr', 'pt', 'zh_CN', 'ja'] as const;
export type Locale = typeof locales[number];

/** Recognizes supported saved choices and Chrome language tags, otherwise uses English. */
export function resolveLocale(value: unknown): Locale {
    if (typeof value !== 'string') return 'en';
    const tag = value.toLowerCase().replaceAll('_', '-');
    if (tag === 'zh' || /^zh-(cn|sg|hans)(-|$)/.test(tag)) return 'zh_CN';
    const base = tag.split('-')[0];
    return locales.find(locale => locale === base) ?? 'en';
}