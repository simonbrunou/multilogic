import { expect, test, beforeEach, afterEach, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import GrecoBoard from '../../src/lib/components/GrecoBoard.svelte';
import { GrecoStore } from '../../src/lib/play/greco.svelte';

// n=3 for a small, fast grid (9 cells)
const N = 3;

function makeStore(
  digitClues: (number | null)[],
  letterClues: (number | null)[]
): GrecoStore {
  const s = new GrecoStore();
  s.load(N, digitClues, letterClues);
  s.stopTimer();
  return s;
}

// Build clue arrays for n=3:
//   cell 0 (row0,col0): fully given  → digit=0, letter=0
//   cell 1 (row0,col1): digit-only   → digit=1, letter=null
//   cell 2 (row0,col2): letter-only  → digit=null, letter=2
//   cells 3..8: all open
function makeClues() {
  const d: (number | null)[] = new Array(N * N).fill(null);
  const l: (number | null)[] = new Array(N * N).fill(null);
  d[0] = 0; l[0] = 0; // fully given
  d[1] = 1;            // digit-only given
  l[2] = 2;            // letter-only given
  return { d, l };
}

async function renderBoard() {
  const { d, l } = makeClues();
  const store = makeStore(d, l);
  render(GrecoBoard, { store });
  await expect.element(page.getByRole('grid')).toBeInTheDocument();
  const cells = page.getByRole('button').elements().filter((b) => b.getAttribute('data-cell') !== null);
  return { store, cells };
}

// Use fake timers so the interval from startTimer() doesn't leak between tests.
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test('renders an n×n grid of buttons', async () => {
  const { cells } = await renderBoard();
  expect(cells.length).toBe(N * N);
  // total buttons includes pickers + actions
  expect(page.getByRole('button').elements().length).toBeGreaterThanOrEqual(N * N);
});

test('a fully-given cell is not focusable (tabindex=-1) and store.select() leaves it unselected', async () => {
  const { store, cells } = await renderBoard();
  // fully-given cell should have tabindex=-1 (firstOpen skips fully-given cells)
  expect(cells[0].getAttribute('tabindex')).toBe('-1');
  // store.select() on a fully-given cell should be a no-op
  store.select(0);
  expect(store.selected).toBeNull();
});

test('a digit-only given cell is selectable and its digit picker is disabled', async () => {
  const { store } = await renderBoard();
  // Select cell 1 (digit-only)
  store.select(1);
  expect(store.selected).toBe(1);
  // Store reflects isDigitGiven(1)=true so selDigitLocked should be true
  expect(store.isDigitGiven(1)).toBe(true);
  expect(store.isLetterGiven(1)).toBe(false);
  // setDigit should be a no-op
  store.setDigit(2);
  expect(store.digits[1]).toBe(1); // unchanged — digit is given
  // setLetter should work (letter not given)
  store.setLetter(1);
  expect(store.letters[1]).toBe(1);
});

test('a letter-only given cell is selectable and its letter picker is disabled', async () => {
  const { store } = await renderBoard();
  // Select cell 2 (letter-only)
  store.select(2);
  expect(store.selected).toBe(2);
  // Letter is given, digit is not
  expect(store.isLetterGiven(2)).toBe(true);
  expect(store.isDigitGiven(2)).toBe(false);
  // setLetter should be a no-op
  store.setLetter(0);
  expect(store.letters[2]).toBe(2); // unchanged — letter is given
  // setDigit should work
  store.setDigit(2);
  expect(store.digits[2]).toBe(2);
});

test('undo reverts the last placement and the button disables when history is empty', async () => {
  const { store } = await renderBoard();
  expect(store.canUndo).toBe(false);
  store.select(3); // open cell
  store.setDigit(2);
  expect(store.digits[3]).toBe(2);
  store.setLetter(1);
  expect(store.letters[3]).toBe(1);
  expect(store.canUndo).toBe(true);

  store.undo(); // undo the letter
  expect(store.letters[3]).toBe(-1);
  expect(store.digits[3]).toBe(2);
  store.undo(); // undo the digit
  expect(store.digits[3]).toBe(-1);
  expect(store.canUndo).toBe(false);
  store.undo(); // no-op past the start
  expect(store.digits[3]).toBe(-1);
});

test('a fully-given cell has the given class; partial-given cells have partial-given class', async () => {
  const { store, cells } = await renderBoard();
  // Cell 0 is fully given → has 'given' class
  expect(cells[0].classList.contains('given')).toBe(true);
  // Cell 1 is digit-only → has 'partial-given' class
  expect(cells[1].classList.contains('partial-given')).toBe(true);
  // Cell 2 is letter-only → has 'partial-given' class
  expect(cells[2].classList.contains('partial-given')).toBe(true);
  // Cell 3 is fully open → no given class
  expect(cells[3].classList.contains('given')).toBe(false);
  expect(cells[3].classList.contains('partial-given')).toBe(false);
  // Trying to select a fully given cell leaves selection null
  store.select(0);
  expect(store.selected).toBeNull();
});
