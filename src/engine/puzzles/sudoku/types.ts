/** A Sudoku grid is 81 cells in row-major order; 0 = empty, 1..9 = filled. */
export type SudokuGrid = number[];

export interface SudokuInstance {
  /** The puzzle as given (with empties). */
  givens: SudokuGrid;
}

export type SudokuSolution = SudokuGrid;

export interface SudokuState {
  /** Player-entered values, row-major; 0 = empty. */
  cells: SudokuGrid;
}

export interface SudokuMove {
  index: number; // 0..80
  value: number; // 0 to clear, else 1..9
}
