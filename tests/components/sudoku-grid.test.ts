import { expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import SudokuGrid from '../../src/lib/components/SudokuGrid.svelte';
import type { PlayableGame } from '../../src/lib/play/playable';

// Minimal stand-in covering only the surface SudokuGrid reads: cells, isGiven, notes.
function fakeGame(opts: { cells?: number[]; givens?: number[]; notes?: Map<number, number[]> } = {}): PlayableGame {
  const cells = opts.cells ?? new Array(81).fill(0);
  const givens = new Set(opts.givens ?? []);
  const notes = Array.from({ length: 81 }, (_, i) => new Set(opts.notes?.get(i) ?? []));
  return {
    cells,
    isGiven: (i: number) => givens.has(i),
    notes
  } as unknown as PlayableGame;
}

test('renders 81 cells', async () => {
  render(SudokuGrid, { game: fakeGame(), selected: null, onselect: () => {} });
  await expect.element(page.getByRole('grid')).toBeInTheDocument();
  expect(page.getByRole('button').elements()).toHaveLength(81);
});

test('shows values and marks given cells', async () => {
  const cells = new Array(81).fill(0);
  cells[0] = 5;
  render(SudokuGrid, { game: fakeGame({ cells, givens: [0] }), selected: null, onselect: () => {} });
  const buttons = page.getByRole('button').elements();
  expect(buttons[0].textContent).toBe('5');
  expect(buttons[0].classList.contains('given')).toBe(true);
  expect(buttons[1].classList.contains('given')).toBe(false);
});

test('emits the cell index on click', async () => {
  const onselect = vi.fn();
  render(SudokuGrid, { game: fakeGame(), selected: null, onselect });
  await page.getByRole('button').nth(3).click();
  expect(onselect).toHaveBeenCalledWith(3);
});

test('highlights the selected cell', async () => {
  render(SudokuGrid, { game: fakeGame(), selected: 4, onselect: () => {} });
  await expect.element(page.getByRole('grid')).toBeInTheDocument();
  const buttons = page.getByRole('button').elements();
  expect(buttons[4].classList.contains('selected')).toBe(true);
  expect(buttons[0].classList.contains('selected')).toBe(false);
});

test('renders pencil-mark notes for empty cells', async () => {
  render(SudokuGrid, {
    game: fakeGame({ notes: new Map([[10, [3, 1, 7]]]) }),
    selected: null,
    onselect: () => {}
  });
  const buttons = page.getByRole('button').elements();
  // notes are sorted and joined
  expect(buttons[10].querySelector('.notes')?.textContent).toBe('137');
});
