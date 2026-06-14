export interface TectonicInstance {
  width: number;
  height: number;
  regions: number[]; // length width*height, region id per cell
  givens: number[];  // length width*height, 0 = empty
}
export type TectonicSolution = number[];
export interface TectonicState { cells: number[] }
export interface TectonicMove { index: number; value: number }
