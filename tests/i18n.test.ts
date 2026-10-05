import { describe, expect, it } from 'vitest';
import { detectLang, langFromTag, LANG_NAMES, LANGS, lang, t } from '../src/i18n';
import { en } from '../src/i18n/en';
import { ja } from '../src/i18n/ja';
import { zh } from '../src/i18n/zh';
import { CATALOG } from '../src/life/catalog';
import { longName } from '../src/ui/patternCard';

/** Keys, array lengths and function arity: everything but the words themselves. */
function shape(value: unknown): unknown {
  if (typeof value === 'function') return `fn/${value.length}`;
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, shape(v)]));
  }
  return typeof value;
}

/** Every string in a dictionary, with functions called on sample arguments. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') {
    const out = value(...Array.from({ length: value.length }, (_, i) => (i % 2 ? 3 : 'x')));
    return strings(out);
  }
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

describe('dictionaries', () => {
  it.each([['zh', zh], ['ja', ja]] as const)('%s matches the English shape', (_, messages) => {
    expect(shape(messages)).toEqual(shape(en));
  });

  it.each([['en', en], ['zh', zh], ['ja', ja]] as const)('%s has no empty strings or markup', (_, messages) => {
    for (const text of strings(messages)) {
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text).not.toMatch(/[<>]|undefined|NaN/);
    }
  });

  it('names every catalog pattern in every language', () => {
    for (const messages of [en, zh, ja]) {
      expect(Object.keys(messages.patterns).sort()).toEqual(CATALOG.map((e) => e.id).sort());
    }
  });

  it('formats the status line as alternating text and numbers', () => {
    for (const messages of [en, zh, ja]) {
      const parts = messages.controls.status(12, 340);
      expect(parts).toHaveLength(5);
      expect([parts[1], parts[3]]).toEqual(['12', '340']);
    }
    expect(en.controls.status(0, 1).join('')).toBe('generation 0 · 1 cell');
  });
});

describe('language choice', () => {
  it('stays English outside the browser', () => {
    expect(lang).toBe('en');
    expect(t).toBe(en);
  });

  it('maps browser tags to supported languages', () => {
    expect(langFromTag('zh-CN')).toBe('zh');
    expect(langFromTag('zh-Hant-TW')).toBe('zh');
    expect(langFromTag('ja-JP')).toBe('ja');
    expect(langFromTag('EN-gb')).toBe('en');
    expect(langFromTag('fr-FR')).toBeNull();
  });

  it('prefers a saved choice, then the first supported browser language', () => {
    expect(detectLang('ja', ['zh-CN'])).toBe('ja');
    expect(detectLang(null, ['fr-FR', 'zh-CN', 'en'])).toBe('zh');
    expect(detectLang('klingon', ['ja'])).toBe('ja');
    expect(detectLang(null, ['fr-FR'])).toBe('en');
  });

  it('names each language in itself', () => {
    expect(LANGS.map((l) => LANG_NAMES[l])).toEqual(['English', '中文', '日本語']);
  });
});

describe('card names', () => {
  it('shrinks only names that would overflow a card', () => {
    expect(longName('pentadecathlon')).toBe(true);
    expect(longName('figure eight')).toBe(false);
    expect(longName('十五项全能')).toBe(true);
    expect(longName('滑翔机')).toBe(false);
    expect(longName('ペンタデカスロン')).toBe(true);
    expect(longName('イーター 1')).toBe(true);
    expect(longName('p46 gun')).toBe(false);
  });
});
