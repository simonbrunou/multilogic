// Theme application + persistence. The active theme lives on <html data-theme>, and the
// token stylesheet (app.css) swaps palettes off that attribute, so nothing here needs to be
// reactive: set the attribute and CSS does the rest. The no-flash inline script in app.html
// pre-applies the theme before first paint; this keeps it in sync after hydration.

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ml:settings';
const FALLBACK: Theme = 'light';

function isTheme(v: unknown): v is Theme {
  return v === 'light' || v === 'dark';
}

/** Read the persisted theme from the shared settings blob, falling back to light. */
function stored(): Theme {
  try {
    if (typeof localStorage === 'undefined') return FALLBACK;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return FALLBACK;
    const t = (JSON.parse(raw) as { theme?: unknown }).theme;
    return isTheme(t) ? t : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

// Browser-chrome colors per theme — kept in sync with --bg in app.css so the PWA status/title
// bar matches the active palette (the manual toggle isn't an OS preference, so a static
// prefers-color-scheme <meta> can't cover it).
const THEME_COLOR: Record<Theme, string> = { light: '#f9fafd', dark: '#14161b' };

function apply(t: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[t]);
}

/** Browser-only: resolve the initial theme from the saved settings. */
export function initTheme(): void {
  apply(stored());
}

/**
 * Reflect a theme on the document. Persistence is owned by the settings page (it writes the
 * whole Settings blob); this only updates <html>.
 */
export function setTheme(t: Theme): void {
  apply(t);
}
