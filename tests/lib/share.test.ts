import { describe, it, expect } from 'vitest';
import { shareText, encodeShare, decodeShare } from '../../src/lib/share';

describe('share', () => {
  it('formats a result string', () => {
    const txt = shareText({ type: 'sudoku', date: '2026-06-14', timeMs: 252000, hints: 0 });
    expect(txt).toContain('Sudoku');
    expect(txt).toContain('2026-06-14');
    expect(txt).toContain('4:12');
    expect(txt).toContain('aucun indice');
  });

  it('pluralises hints', () => {
    expect(shareText({ type: 'sudoku', date: '2026-06-14', timeMs: 1000, hints: 3 })).toContain('3 indices');
  });

  it('encode/decode round-trips', () => {
    const enc = encodeShare({ type: 'sudoku', date: '2026-06-14' });
    expect(decodeShare(enc)).toEqual({ type: 'sudoku', date: '2026-06-14' });
  });

  it('decode returns null on garbage', () => {
    expect(decodeShare('#nonsense')).toBeNull();
  });
});
