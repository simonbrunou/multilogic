import { encodePair, decodePair, validateGrid } from '../../engine/puzzles/grecolatin/rules';
import type { ValidationResult } from '../../engine/puzzles/grecolatin/rules';
import { hintCell } from '../../engine/puzzles/grecolatin/hint';

export class GrecoStore {
	n = $state(5);
	givens = $state<number[]>([]);
	// Digit and letter are tracked independently so a player can place just one dimension
	// while thinking. -1 = empty, 0..n-1 = a placed value.
	digits = $state<number[]>([]);
	letters = $state<number[]>([]);
	selected = $state<number | null>(null);
	elapsedMs = $state(0);
	hintsUsed = $state(0);

	private timer: ReturnType<typeof setInterval> | null = null;
	private startedAt = 0;

	/** Encoded grid for the rules engine: a cell counts only when BOTH dimensions are placed. */
	get cells(): number[] {
		return this.digits.map((d, i) =>
			d >= 0 && this.letters[i] >= 0 ? encodePair(d, this.letters[i], this.n) : 0,
		);
	}

	get result(): ValidationResult {
		return validateGrid(this.n, this.cells);
	}

	load(n: number, givens: number[]): void {
		this.n = n;
		this.givens = [...givens];
		this.digits = givens.map((g) => (g !== 0 ? decodePair(g, n)!.a : -1));
		this.letters = givens.map((g) => (g !== 0 ? decodePair(g, n)!.b : -1));
		this.selected = null;
		this.elapsedMs = 0;
		this.hintsUsed = 0;
		this.startTimer();
	}

	select(i: number): void {
		if (this.givens[i] === 0) {
			this.selected = i;
		}
	}

	/** Set the digit of the selected cell; tapping the same digit again clears it. */
	setDigit(d: number): void {
		const i = this.selected;
		if (i === null || this.givens[i] !== 0) return;
		const next = [...this.digits];
		next[i] = next[i] === d ? -1 : d;
		this.digits = next;
	}

	/** Set the letter of the selected cell; tapping the same letter again clears it. */
	setLetter(l: number): void {
		const i = this.selected;
		if (i === null || this.givens[i] !== 0) return;
		const next = [...this.letters];
		next[i] = next[i] === l ? -1 : l;
		this.letters = next;
	}

	clear(): void {
		const i = this.selected;
		if (i === null || this.givens[i] !== 0) return;
		const nd = [...this.digits];
		nd[i] = -1;
		this.digits = nd;
		const nl = [...this.letters];
		nl[i] = -1;
		this.letters = nl;
	}

	hint(): void {
		const inst = { n: this.n, givens: this.givens };
		const result = hintCell(inst, this.cells);
		if (!result) return;
		const { index, value } = result;
		const p = decodePair(value, this.n);
		if (!p) return;
		const nd = [...this.digits];
		nd[index] = p.a;
		this.digits = nd;
		const nl = [...this.letters];
		nl[index] = p.b;
		this.letters = nl;
		this.selected = index;
		this.hintsUsed += 1;
	}

	private startTimer(): void {
		this.stopTimer();
		this.startedAt = Date.now() - this.elapsedMs;
		this.timer = setInterval(() => {
			this.elapsedMs = Date.now() - this.startedAt;
		}, 250);
	}

	stopTimer(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}
}
