import { describe, it, expect } from 'vitest';
import { regionSizes, cellsByRegion, kingNeighbors, serializeInstance, deserializeInstance } from '../../../../src/engine/puzzles/tectonic/rules';
import type { TectonicInstance } from '../../../../src/engine/puzzles/tectonic/types';

const INST: TectonicInstance = {
  width: 3, height: 2,
  regions: [0, 0, 1, 0, 1, 1],
  givens: [1, 0, 0, 0, 0, 0]
};

describe('tectonic rules', () => {
  it('regionSizes counts cells per region', () => {
    expect(regionSizes(INST)).toEqual({ 0: 3, 1: 3 });
  });
  it('cellsByRegion groups cell indices', () => {
    expect(cellsByRegion(INST.regions)).toEqual({ 0: [0, 1, 3], 1: [2, 4, 5] });
  });
  it('kingNeighbors gives 8-neighbourhood within bounds', () => {
    expect(new Set(kingNeighbors(0, 3, 2))).toEqual(new Set([1, 3, 4]));
    expect(new Set(kingNeighbors(4, 3, 2))).toEqual(new Set([0, 1, 2, 3, 5]));
  });
  it('serialize/deserialize round-trips', () => {
    expect(deserializeInstance(serializeInstance(INST))).toEqual(INST);
  });
});
