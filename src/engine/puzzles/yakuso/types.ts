/**
 * YAKUSO (Bertrand Lestre logic puzzle).
 *
 * A board of `rows` interior rows × `cols` columns with `cols === rows + 1`.
 * Each interior row owns a distinct digit `d ∈ 1..rows`, holding the value `d`
 * exactly `d` times and `0` in its other cells (the rows form a permutation of
 * `1..rows`). The `totals` row beneath the grid gives each column's sum. One or
 * more totals are **hidden** (`null`) — the player must deduce those columns'
 * sums, which makes the grid harder; the others are shown. Easier bands hide one
 * total (exactly recoverable as `Σ d² − shown`); expert hides two, so only their
 * joint sum is known and the split is ambiguous. Some interior cells are revealed
 * as `clues` (the difficulty knob). The solution is unique.
 */
export interface YakusoInstance {
  rows: number; // R
  cols: number; // C = R + 1
  /** length `cols`; column sums. `null` = hidden from the player (≥ 1 per grid). */
  totals: (number | null)[];
  /** length `rows*cols`; `null` = unseeded, else the seeded value (`0..rows`). */
  clues: (number | null)[];
}

/** length `rows*cols`; each cell `0` or its row's owned digit. */
export type YakusoSolution = number[];

/** length `rows*cols`; `0` = empty/undecided. */
export interface YakusoState { cells: number[] }

export interface YakusoMove { index: number; value: number }
