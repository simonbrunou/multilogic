import { difficultyName, localeNames, puzzleName, tr, type Locale } from './messages';

export { localeNames };
export type { Locale };

const STORAGE_KEY = 'ml:lang';
// French is the deterministic default: it matches the app's original language and keeps
// non-browser contexts (unit tests, prerender) stable. The browser-only `initLocale` is
// what actually opts a visitor into English.
const FALLBACK: Locale = 'fr';

let current = $state<Locale>(FALLBACK);

/** The active locale. Reading this (directly or via `t`) inside a component tracks it. */
export function locale(): Locale {
  return current;
}

function isLocale(v: string | null): v is Locale {
  return v === 'en' || v === 'fr';
}

/** Best-effort locale guess from the browser; falls back to French. */
function detect(): Locale {
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
    return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'fr';
  }
  return FALLBACK;
}

function apply(l: Locale): void {
  current = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

/** Browser-only: resolve the initial locale from a saved preference or the browser. */
export function initLocale(): void {
  let stored: string | null = null;
  try {
    stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  } catch {
    /* storage unavailable */
  }
  apply(isLocale(stored) ? stored : detect());
}

/** Switch locale and persist the choice. */
export function setLocale(l: Locale): void {
  apply(l);
  try {
    localStorage?.setItem(STORAGE_KEY, l);
  } catch {
    /* storage unavailable */
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Params = Record<string, any>;

/**
 * Translate a dotted key (e.g. `'play.generating'`) in the active locale. String leaves
 * interpolate `{name}` placeholders from `params`; function leaves are called with `params`.
 * Reading the active locale here makes callers reactive to language changes.
 */
export function t(key: string, params: Params = {}): string {
  return tr(current, key, params);
}

/** Localised difficulty name in the active locale, falling back to the raw key. */
export function difficultyLabel(d: string): string {
  return difficultyName(current, d);
}

/** Localised puzzle-type name in the active locale, falling back to a capitalised id. */
export function puzzleTypeLabel(type: string): string {
  return puzzleName(current, type);
}
