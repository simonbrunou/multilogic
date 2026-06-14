export interface GrecoLatinInstance {
  n: number;          // order; valid orders are 3,4,5,7,8,9
  givens: number[];   // length n*n; 0 = empty; else encoded pair a*n+b+1
}
export type GrecoLatinSolution = null; // construction puzzle — no fixed solution to match
export interface GrecoLatinState { cells: number[] }
export interface GrecoLatinMove { index: number; value: number } // encoded pair, or 0 to clear
