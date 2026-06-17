export interface PlayableGame {
  readonly cells: number[];
  readonly notes: Set<number>[];
  isGiven(index: number): boolean;
  input(index: number, value: number): boolean;
  erase(index: number): boolean;
  toggleNote(index: number, digit: number): boolean;
  /** Overwrite cells + notes from a saved game and reset undo/redo history. */
  restore(cells: number[], notes: [number, number[]][]): void;
  undo(): void;
  redo(): void;
  conflicts(): Set<number>;
  isSolved(): boolean;
}
