export interface Settings {
    automatic: boolean;
    fraction: number;
    minimum: number;
    excludedOrigins: string[];
    locale: 'en' | 'de';
}

export const defaults: Settings = {automatic: true, fraction: 0.5, minimum: 120, excludedOrigins: [], locale: 'en'};

/** Validates untrusted storage data and supplies safe defaults for malformed fields. */
export function parseSettings(value: unknown): Settings {
    const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return {
        automatic: typeof data.automatic === 'boolean' ? data.automatic : defaults.automatic,
        fraction: typeof data.fraction === 'number' && Number.isFinite(data.fraction) ? Math.min(0.7, Math.max(0.2, data.fraction)) : defaults.fraction,
        minimum: typeof data.minimum === 'number' && Number.isFinite(data.minimum) ? Math.round(Math.min(1000, Math.max(40, data.minimum))) : defaults.minimum,
        excludedOrigins: Array.isArray(data.excludedOrigins) ? data.excludedOrigins.filter((origin): origin is string => {
            if (typeof origin !== 'string') return false;
            try { const url = new URL(origin); return /^https?:$/.test(url.protocol) && url.origin === origin; } catch { return false; }
        }).slice(0, 1000) : [],
        locale: data.locale === 'de' ? 'de' : 'en',
    };
}

/** Splits words into grapheme-safe prefixes while preserving all original text. */
export function readingSegments(text: string, fraction: number): {text: string; highlighted: boolean}[] {
    const words = new Intl.Segmenter(undefined, {granularity: 'word'});
    const graphemes = new Intl.Segmenter(undefined, {granularity: 'grapheme'});
    const segments: {text: string; highlighted: boolean}[] = [];
    for (const word of words.segment(text)) {
        if (!word.isWordLike || !/\p{L}/u.test(word.segment)) {
            segments.push({text: word.segment, highlighted: false});
            continue;
        }
        const letters = Array.from(graphemes.segment(word.segment), entry => entry.segment);
        const count = Math.max(1, Math.ceil(letters.length * fraction));
        segments.push({text: letters.slice(0, count).join(''), highlighted: true});
        segments.push({text: letters.slice(count).join(''), highlighted: false});
    }
    return segments;
}
