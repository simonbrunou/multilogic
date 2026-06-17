import { describe, it, expect } from 'vitest';
import { createStorage, type StorageLike, type SavedGame } from '../../src/lib/storage';

function memoryBackend(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); }
  };
}

/** Backend that also exposes length/key, so pruneDailies (which feature-detects them) can run. */
function enumerableBackend(): StorageLike & { length: number; key(i: number): string | null } {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null
  };
}

const SAMPLE: SavedGame = {
  type: 'sudoku',
  difficulty: 'easy',
  instance: 'G',
  solution: 'S',
  cells: new Array(81).fill(0),
  notes: [],
  elapsedMs: 1234,
  hintsUsed: 0,
  solved: false,
  recorded: false
};

const SLOT = 'play:sudoku';

describe('storage', () => {
  it('saves and resumes an in-progress game', () => {
    const s = createStorage(memoryBackend());
    s.saveGame(SLOT, SAMPLE);
    const loaded = s.loadGame<SavedGame>(SLOT);
    expect(loaded).not.toBeNull();
    expect(loaded!.elapsedMs).toBe(1234);
    expect(loaded!.cells.length).toBe(81);
  });

  it('keeps daily and practice saves of one type in separate slots', () => {
    const s = createStorage(memoryBackend());
    s.saveGame(SLOT, SAMPLE);
    s.saveGame('daily:sudoku:2026-06-17', { ...SAMPLE, elapsedMs: 99, solved: true });
    expect(s.loadGame<SavedGame>(SLOT)!.elapsedMs).toBe(1234);
    expect(s.loadGame<SavedGame>('daily:sudoku:2026-06-17')!.solved).toBe(true);
  });

  it('pruneDailies drops finished dailies of other dates but keeps in-progress ones', () => {
    const s = createStorage(enumerableBackend());
    s.saveGame('daily:sudoku:2026-06-16', { ...SAMPLE, solved: true });   // old, finished
    s.saveGame('daily:kakuro:2026-06-16', { ...SAMPLE, solved: false });  // old, in-progress
    s.saveGame('daily:sudoku:2026-06-17', { ...SAMPLE, solved: false });  // today
    s.saveGame(SLOT, SAMPLE);                                             // practice — untouched
    s.pruneDailies(['2026-06-17']);
    expect(s.loadGame('daily:sudoku:2026-06-16')).toBeNull();              // finished + stale → gone
    expect(s.loadGame('daily:kakuro:2026-06-16')).not.toBeNull();          // unfinished → kept
    expect(s.loadGame('daily:sudoku:2026-06-17')).not.toBeNull();          // today → kept
    expect(s.loadGame(SLOT)).not.toBeNull();                               // practice slot → kept
  });

  it('clearGame removes the saved game', () => {
    const s = createStorage(memoryBackend());
    s.saveGame(SLOT, SAMPLE);
    s.clearGame(SLOT);
    expect(s.loadGame(SLOT)).toBeNull();
  });

  it('returns null for a save written by a newer schema version', () => {
    const backend = memoryBackend();
    backend.setItem('ml:game:play:sudoku', JSON.stringify({ version: 999, data: SAMPLE }));
    const s = createStorage(backend);
    expect(s.loadGame(SLOT)).toBeNull();
  });

  it('records and reads per-type/difficulty stats', () => {
    const s = createStorage(memoryBackend());
    s.recordSolve('sudoku', 'easy', 5000);
    s.recordSolve('sudoku', 'easy', 3000);
    const stats = s.getStats('sudoku', 'easy');
    expect(stats.solved).toBe(2);
    expect(stats.bestMs).toBe(3000);
  });

  it('round-trips settings with defaults', () => {
    const s = createStorage(memoryBackend());
    expect(s.getSettings().highlightErrors).toBe(true);
    s.setSettings({ ...s.getSettings(), highlightErrors: false });
    expect(s.getSettings().highlightErrors).toBe(false);
  });

  it('survives corrupt JSON gracefully', () => {
    const backend = memoryBackend();
    backend.setItem('ml:game:sudoku', '{not json');
    const s = createStorage(backend);
    expect(s.loadGame('sudoku')).toBeNull();
  });
});
