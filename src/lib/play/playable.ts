export interface PlayableGame {
  readonly cells: number[];
  readonly notes: Set<number>[];
  isGiven(index: number): boolean;
  input(index: number, value: number): boolean;
  erase(index: number): boolean;
  toggleNote(index: number, digit: number): boolean;
  undo(): void;
  redo(): void;
  conflicts(): Set<number>;
  isSolved(): boolean;
}
