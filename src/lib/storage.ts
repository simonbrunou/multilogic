export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SCHEMA_VERSION = 1;

export interface SavedGame {
  type: string;
  givens: string;
  solution: string;
  cells: number[];
  notes: [number, number[]][];
  elapsedMs: number;
  difficulty: string;
}

interface StoredGame extends SavedGame {
  version: number;
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
  const gameKey = (type: string) => `ml:game:${type}`;
  const statsKey = 'ml:stats';
  const settingsKey = 'ml:settings';

  return {
    saveGame(game: SavedGame): void {
      const stored: StoredGame = { ...game, version: SCHEMA_VERSION };
      backend.setItem(gameKey(game.type), JSON.stringify(stored));
    },
    loadGame(type: string): SavedGame | null {
      const stored = safeParse<StoredGame>(backend.getItem(gameKey(type)));
      if (!stored || stored.version !== SCHEMA_VERSION) return null;
      return stored;
    },
    clearGame(type: string): void {
      backend.removeItem(gameKey(type));
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
