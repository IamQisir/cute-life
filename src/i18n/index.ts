// The UI language. Chosen once per page load (saved choice, else the browser's
// languages, else English); switching saves the choice and reloads, so every
// string can simply be read when its element is built.

import { en, type Messages } from './en';

export const LANGS = ['en', 'zh', 'ja'] as const;
export type Lang = typeof LANGS[number];

/** Each language's name, written in that language (for the picker). */
export const LANG_NAMES: Record<Lang, string> = { en: 'English', zh: '中文', ja: '日本語' };
const HTML_LANG: Record<Lang, string> = { en: 'en', zh: 'zh-CN', ja: 'ja' };
const STORE_KEY = 'cute-life.lang';

/** Map a BCP 47 tag to a supported language, or null. */
export function langFromTag(tag: string): Lang | null {
  const base = tag.toLowerCase().split('-')[0];
  return base === 'zh' || base === 'ja' || base === 'en' ? base : null;
}

export function detectLang(saved: string | null, preferred: readonly string[]): Lang {
  if (saved && (LANGS as readonly string[]).includes(saved)) return saved as Lang;
  for (const tag of preferred) {
    const lang = langFromTag(tag);
    if (lang) return lang;
  }
  return 'en';
}

function readSaved(): string | null {
  try { return localStorage.getItem(STORE_KEY); } catch { return null; }
}

// Tests and other non-browser runs stay in English.
export const lang: Lang = typeof document === 'undefined'
  ? 'en'
  : detectLang(readSaved(), navigator.languages?.length ? navigator.languages : [navigator.language ?? 'en']);

/** Every user-facing string, in the current language. Only that language is downloaded. */
export const t: Messages = lang === 'zh' ? (await import('./zh')).zh : lang === 'ja' ? (await import('./ja')).ja : en;

if (typeof document !== 'undefined') document.documentElement.lang = HTML_LANG[lang];

/** Remember the choice; the caller reloads the page to apply it. */
export function saveLang(next: Lang) {
  try { localStorage.setItem(STORE_KEY, next); } catch { /* fine: just not remembered */ }
}

export type { Messages };
