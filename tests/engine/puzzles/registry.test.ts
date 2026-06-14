import { describe, it, expect } from 'vitest';
import { MODULES, getModule } from '../../../src/engine/puzzles/registry';

describe('registry', () => {
  it('exposes sudoku, tectonic, and kakuro modules keyed by type', () => {
    expect(MODULES.sudoku?.type).toBe('sudoku');
    expect(MODULES.tectonic?.type).toBe('tectonic');
    expect(MODULES.kakuro?.type).toBe('kakuro');
  });
  it('getModule returns a defined module', () => {
    expect(getModule('sudoku').type).toBe('sudoku');
    expect(getModule('tectonic').type).toBe('tectonic');
    expect(getModule('kakuro').type).toBe('kakuro');
  });
  it('getModule throws for an unimplemented type', () => {
    expect(() => getModule('grecolatin')).toThrow();
  });
  it('every defined module implements the serialization seam', () => {
    for (const m of Object.values(MODULES)) {
      if (!m) continue;
      expect(typeof m.serializeInstance).toBe('function');
      expect(typeof m.deserializeInstance).toBe('function');
      expect(typeof m.serializeSolution).toBe('function');
      expect(typeof m.deserializeSolution).toBe('function');
    }
  });
});
