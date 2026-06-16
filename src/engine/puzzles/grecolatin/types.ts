export interface GrecoLatinInstance {
  n: number;
  /** length n*n; given digit a ∈ 0..n-1, or null (open). */
  digitClues: (number | null)[];
  /** length n*n; given letter b ∈ 0..n-1, or null (open). */
  letterClues: (number | null)[];
}
export type GrecoLatinSolution = null; // construction puzzle — no fixed solution to match
export interface GrecoLatinState { cells: number[] }
export interface GrecoLatinMove { index: number; value: number } // encoded pair, or 0 to clear
