import type { YakusoInstance } from './types';
import type { Difficulty } from '../../core/types';
import { bandFromEffort } from '../../core/difficulty';
import { effortToSolve } from './solver';

// Thresholds calibrated from the generated distribution (see calibration in the
// generator/rater tests). effort 0 → easy; ≤T1 → medium; ≤T2 → hard; else expert.
const YAKUSO_T1 = 1;
const YAKUSO_T2 = 4;

export function rate(inst: YakusoInstance): Difficulty {
  // Cap the effort search at T2 + 1: any count above T2 is already 'expert'.
  return bandFromEffort(effortToSolve(inst, YAKUSO_T2 + 1), YAKUSO_T1, YAKUSO_T2);
}
