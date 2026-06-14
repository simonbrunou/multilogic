export interface KakuroClue { down?: number; right?: number }
export interface KakuroInstance {
  width: number;
  height: number;
  black: boolean[];               // length width*height; true = black (clue/wall) cell
  clues: (KakuroClue | null)[];   // length width*height; object on black cells, null on white
}
export type KakuroSolution = number[]; // length width*height; 0 on black, 1-9 on white
export interface KakuroState { cells: number[] }
export interface KakuroMove { index: number; value: number }
