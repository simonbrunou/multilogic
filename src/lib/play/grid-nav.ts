// Keyboard navigation for puzzle grids: roving-tabindex + arrow keys.
//
// One Svelte action drives every grid (Sudoku, Tectonic, Kakuro, Yakuso, Greco-Latin) so the
// behaviour lives in exactly one place. The grid component owns layout (column count) and which
// cells are focusable; this module owns "given the current cell and an arrow, where next?" plus
// moving DOM focus to follow the selection. Cells opt in with `data-cell={index}` and a roving
// `tabindex` (0 for the current cell, -1 for the rest).

/**
 * Next focusable cell index for an arrow key. Left/Right walk focusable cells in reading order;
 * Up/Down move within the same column, skipping non-focusable cells (Kakuro black squares,
 * Yakuso givens/totals). Returns null for non-arrow keys or when there is nowhere to move.
 */
function nextGridCell(
  current: number | null,
  cols: number,
  total: number,
  focusable: (i: number) => boolean,
  key: string
): number | null {
  if (!key.startsWith('Arrow')) return null;

  const order: number[] = [];
  for (let i = 0; i < total; i++) if (focusable(i)) order.push(i);
  if (order.length === 0) return null;

  // No (or stale) selection: the first arrow press enters the grid at the first focusable cell.
  if (current === null || !focusable(current)) return order[0];

  switch (key) {
    case 'ArrowLeft': {
      const idx = order.indexOf(current);
      return idx > 0 ? order[idx - 1] : current;
    }
    case 'ArrowRight': {
      const idx = order.indexOf(current);
      return idx < order.length - 1 ? order[idx + 1] : current;
    }
    case 'ArrowUp':
      return scanColumn(current, cols, total, focusable, -1) ?? current;
    case 'ArrowDown':
      return scanColumn(current, cols, total, focusable, 1) ?? current;
    default:
      return null;
  }
}

/** First focusable cell in the same column, moving in `dir` (±1 row at a time). */
function scanColumn(
  current: number,
  cols: number,
  total: number,
  focusable: (i: number) => boolean,
  dir: number
): number | null {
  for (let i = current + dir * cols; i >= 0 && i < total; i += dir * cols) {
    if (focusable(i)) return i;
  }
  return null;
}

export interface GridKeyboardOptions {
  cols: number;
  total: number;
  focusable: (i: number) => boolean;
  selected: number | null;
  onselect: (i: number) => void;
}

/**
 * Svelte action for a grid container. Handles arrow-key movement and keeps DOM focus on the
 * current cell. Focus only follows the selection while focus is already inside the grid, so
 * clicking elsewhere or typing on the number pad never yanks focus back.
 */
export function gridKeyboard(node: HTMLElement, options: GridKeyboardOptions) {
  let opts = options;

  function onKeydown(e: KeyboardEvent) {
    const next = nextGridCell(opts.selected, opts.cols, opts.total, opts.focusable, e.key);
    if (next === null) return;
    e.preventDefault();
    if (next === opts.selected) return;
    opts.onselect(next);
    // Track locally so a burst of arrow presses doesn't read a stale selection while the
    // parent's reactive update is still in flight, and move focus to the new cell now (the
    // target button already exists in the DOM, so we don't need to wait for a re-render).
    opts.selected = next;
    node.querySelector<HTMLElement>(`[data-cell="${next}"]`)?.focus();
  }

  node.addEventListener('keydown', onKeydown);

  return {
    update(next: GridKeyboardOptions) {
      opts = next;
    },
    destroy() {
      node.removeEventListener('keydown', onKeydown);
    }
  };
}
