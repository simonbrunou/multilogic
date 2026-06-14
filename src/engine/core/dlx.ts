/**
 * Generic exact-cover solver via Knuth's Dancing Links (Algorithm X).
 * Columns are 0-indexed. addRow(rowId, columns) registers a row covering those columns.
 * solve(limit) returns up to `limit` solutions, each an array of the rowIds chosen.
 */

interface Node {
  L: Node; R: Node; U: Node; D: Node;
  C: Column;
  rowId: number;
}
interface Column extends Node {
  size: number;
  name: number;
}

export class Dlx {
  private readonly header: Column;
  private readonly columns: Column[];

  constructor(numColumns: number) {
    const header = this.makeColumn(-1);
    header.L = header; header.R = header;
    this.header = header;
    this.columns = [];
    let prev: Column = header;
    for (let i = 0; i < numColumns; i++) {
      const col = this.makeColumn(i);
      col.L = prev; col.R = header;
      prev.R = col; header.L = col;
      this.columns.push(col);
      prev = col;
    }
  }

  private makeColumn(name: number): Column {
    const col = { size: 0, name } as Column;
    col.U = col; col.D = col; col.L = col; col.R = col;
    col.C = col; col.rowId = -1;
    return col;
  }

  /**
   * DETERMINISM CONTRACT (relied on by seed-reproducible generators, e.g. sudoku/fullgrid.ts):
   * nodes are appended to the BOTTOM of each column, and `solve` iterates `col.D`
   * (top-to-bottom = insertion order). Together with `chooseColumn`'s left-to-right
   * tie-breaking, this makes branch order a deterministic function of insertion order.
   * Do NOT change append order, D-iteration, or tie-breaking without updating those generators.
   */
  addRow(rowId: number, cols: number[]): void {
    if (cols.length === 0) {
      throw new Error(`addRow(${rowId}): empty column list`);
    }
    for (const c of cols) {
      if (c < 0 || c >= this.columns.length) {
        throw new RangeError(`addRow(${rowId}): column ${c} out of range [0, ${this.columns.length})`);
      }
    }
    if (new Set(cols).size !== cols.length) {
      throw new Error(`addRow(${rowId}): duplicate column index in ${JSON.stringify(cols)}`);
    }

    let first: Node | null = null;
    for (const c of cols) {
      const col = this.columns[c];
      const node = { rowId } as Node;
      node.C = col;
      // link vertically above the column header (i.e. at the bottom of the column)
      node.D = col; node.U = col.U;
      col.U.D = node; col.U = node;
      col.size++;
      // link horizontally within the row
      if (first === null) {
        node.L = node; node.R = node;
        first = node;
      } else {
        node.L = first.L; node.R = first;
        first.L.R = node; first.L = node;
      }
    }
  }

  private cover(col: Column): void {
    col.R.L = col.L; col.L.R = col.R;
    for (let i = col.D; i !== col; i = i.D) {
      for (let j = i.R; j !== i; j = j.R) {
        j.D.U = j.U; j.U.D = j.D;
        j.C.size--;
      }
    }
  }

  private uncover(col: Column): void {
    for (let i = col.U; i !== col; i = i.U) {
      for (let j = i.L; j !== i; j = j.L) {
        j.C.size++;
        j.D.U = j; j.U.D = j;
      }
    }
    col.R.L = col; col.L.R = col;
  }

  // NOTE: ties are broken left-to-right via strict `<` (first/lowest-index column of min size wins).
  // This `<` is load-bearing for seed-reproducible generation — do not change to `<=`.
  private chooseColumn(): Column | null {
    let best: Column | null = null;
    let min = Infinity;
    for (let c = this.header.R; c !== this.header; c = c.R) {
      const col = c as Column;
      if (col.size < min) { min = col.size; best = col; if (min === 0) break; }
    }
    return best;
  }

  solve(limit = Infinity): number[][] {
    const solutions: number[][] = [];
    const stack: number[] = [];

    const search = (): void => {
      if (solutions.length >= limit) return;
      if (this.header.R === this.header) {
        solutions.push([...stack]);
        return;
      }
      const col = this.chooseColumn();
      if (col === null || col.size === 0) return; // dead end
      this.cover(col);
      for (let r = col.D; r !== col && solutions.length < limit; r = r.D) {
        stack.push(r.rowId);
        for (let j = r.R; j !== r; j = j.R) this.cover(j.C);
        search();
        for (let j = r.L; j !== r; j = j.L) this.uncover(j.C);
        stack.pop();
      }
      this.uncover(col);
    };

    search();
    return solutions;
  }
}
