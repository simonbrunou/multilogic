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

const SAMPLE: SavedGame = {
  type: 'sudoku',
  givens: 'G',
  solution: 'S',
  cells: new Array(81).fill(0),
  notes: [],
  elapsedMs: 1234,
  difficulty: 'easy'
};

describe('storage', () => {
  it('saves and resumes an in-progress game', () => {
    const s = createStorage(memoryBackend());
    s.saveGame(SAMPLE);
    const loaded = s.loadGame('sudoku');
    expect(loaded).not.toBeNull();
    expect(loaded!.elapsedMs).toBe(1234);
    expect(loaded!.cells.length).toBe(81);
  });

  it('clearGame removes the saved game', () => {
    const s = createStorage(memoryBackend());
    s.saveGame(SAMPLE);
    s.clearGame('sudoku');
    expect(s.loadGame('sudoku')).toBeNull();
  });

  it('returns null for a save written by a newer schema version', () => {
    const backend = memoryBackend();
    backend.setItem('ml:game:sudoku', JSON.stringify({ version: 999, type: 'sudoku' }));
    const s = createStorage(backend);
    expect(s.loadGame('sudoku')).toBeNull();
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
