import { horizontalRuns, verticalRuns } from './rules';
import type { KakuroInstance, KakuroState } from './types';
import type { Hint } from '../../core/types';

export function getHint(inst: KakuroInstance, state: KakuroState): Hint | null {
  const grid = inst.black.map((b, i) => (b ? 0 : state.cells[i] || 0));
  const runs: { cells: number[]; target: number | null }[] = [];
  const cellRuns: number[][] = inst.black.map(() => []);
  const add = (cells: number[], sum: number | undefined) => { if (!cells.length) return; const idx = runs.length; runs.push({ cells, target: sum ?? null }); for (const c of cells) cellRuns[c].push(idx); };
  for (const r of horizontalRuns(inst.width, inst.height, inst.black)) add(r.cells, r.clueIndex >= 0 ? inst.clues[r.clueIndex]?.right : undefined);
  for (const r of verticalRuns(inst.width, inst.height, inst.black)) add(r.cells, r.clueIndex >= 0 ? inst.clues[r.clueIndex]?.down : undefined);
  for (let i = 0; i < grid.length; i++) {
    if (inst.black[i] || grid[i] !== 0) continue;
    const cands: number[] = [];
    for (let v = 1; v <= 9; v++) {
      let okv = true;
      for (const ri of cellRuns[i]) {
        const run = runs[ri];
        let filled = 0, remaining = 0;
        for (const c of run.cells) { const val = c === i ? v : grid[c]; if (val === v && c !== i) { okv = false; break; } if (val !== 0) filled += val; else remaining++; }
        if (!okv) break;
        if (run.target !== null) { const need = run.target - filled; if (filled > run.target || (remaining === 0 && filled !== run.target) || need < remaining || need > remaining * 9) { okv = false; break; } }
      }
      if (okv) cands.push(v);
    }
    if (cands.length === 1) return { cells: [i], text: `Forced: place ${cands[0]}` };
  }
  return null;
}
