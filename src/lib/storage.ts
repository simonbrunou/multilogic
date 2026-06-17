export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const SCHEMA_VERSION = 2;

/** What the grid-based puzzles (sudoku/tectonic/kakuro/yakuso) persist to resume a board. */
export interface SavedGame {
  type: string;
  difficulty: string;
  instance: string;
  solution: string;
  cells: number[];
  notes: [number, number[]][];
  elapsedMs: number;
  solved: boolean;
}

/** What Greco-Latin persists — it tracks two dimensions independently, not a single cell array. */
export interface SavedGreco {
  type: 'grecolatin';
  difficulty: string;
  instance: string;
  digits: number[];
  letters: number[];
  elapsedMs: number;
  solved: boolean;
}

interface Envelope<T> {
  version: number;
  data: T;
}

export interface Stats {
  solved: number;
  bestMs: number | null;
  totalMs: number;
}

export interface Settings {
  highlightErrors: boolean;
  autoNotes: boolean;
  theme: 'light' | 'dark';
}

const DEFAULT_SETTINGS: Settings = { highlightErrors: true, autoNotes: false, theme: 'light' };

function safeParse<T>(raw: string | null): T | null {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function createStorage(backend: StorageLike) {
  // `slot` namespaces a save, e.g. `play:sudoku` or `daily:yakuso:2026-06-17`, so the
  // practice board and each day's daily of the same type never clobber one another.
  const gameKey = (slot: string) => `ml:game:${slot}`;
  const statsKey = 'ml:stats';
  const settingsKey = 'ml:settings';

  return {
    saveGame<T>(slot: string, game: T): void {
      const env: Envelope<T> = { version: SCHEMA_VERSION, data: game };
      // Best-effort: persistence is a convenience, never crash play if the quota is full.
      try { backend.setItem(gameKey(slot), JSON.stringify(env)); } catch { /* quota or disabled storage */ }
    },
    loadGame<T = SavedGame>(slot: string): T | null {
      const env = safeParse<Envelope<T>>(backend.getItem(gameKey(slot)));
      if (!env || env.version !== SCHEMA_VERSION) return null;
      return env.data;
    },
    clearGame(slot: string): void {
      backend.removeItem(gameKey(slot));
    },
    /**
     * Drop daily saves whose date is not in `keepDates`, so the date-stamped `daily:*` slots
     * don't accumulate forever. No-op on backends that can't be enumerated (e.g. the test stub).
     */
    pruneDailies(keepDates: string[]): void {
      const b = backend as unknown as { length?: number; key?(i: number): string | null };
      if (typeof b.length !== 'number' || typeof b.key !== 'function') return;
      const prefix = 'ml:game:daily:';
      const stale: string[] = [];
      for (let i = 0; i < b.length; i++) {
        const k = b.key(i);
        if (k && k.startsWith(prefix) && !keepDates.some((d) => k.endsWith(`:${d}`))) stale.push(k);
      }
      for (const k of stale) backend.removeItem(k);
    },
    recordSolve(type: string, difficulty: string, ms: number): void {
      const all = safeParse<Record<string, Stats>>(backend.getItem(statsKey)) ?? {};
      const key = `${type}:${difficulty}`;
      const cur = all[key] ?? { solved: 0, bestMs: null, totalMs: 0 };
      cur.solved += 1;
      cur.totalMs += ms;
      cur.bestMs = cur.bestMs === null ? ms : Math.min(cur.bestMs, ms);
      all[key] = cur;
      backend.setItem(statsKey, JSON.stringify(all));
    },
    getStats(type: string, difficulty: string): Stats {
      const all = safeParse<Record<string, Stats>>(backend.getItem(statsKey)) ?? {};
      return all[`${type}:${difficulty}`] ?? { solved: 0, bestMs: null, totalMs: 0 };
    },
    getSettings(): Settings {
      return { ...DEFAULT_SETTINGS, ...(safeParse<Partial<Settings>>(backend.getItem(settingsKey)) ?? {}) };
    },
    setSettings(s: Settings): void {
      backend.setItem(settingsKey, JSON.stringify(s));
    }
  };
}
