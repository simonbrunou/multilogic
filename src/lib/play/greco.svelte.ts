import { encodePair, validateGrid } from '../../engine/puzzles/grecolatin/rules';
import type { ValidationResult } from '../../engine/puzzles/grecolatin/rules';

export class GrecoStore {
	n = $state(5);
	givens = $state<number[]>([]);
	cells = $state<number[]>([]);
	selected = $state<number | null>(null);
	symbol = $state(0);
	colour = $state(0);
	elapsedMs = $state(0);

	private timer: ReturnType<typeof setInterval> | null = null;
	private startedAt = 0;

	get result(): ValidationResult {
		return validateGrid(this.n, this.cells);
	}

	load(n: number, givens: number[]): void {
		this.n = n;
		this.givens = [...givens];
		this.cells = [...givens];
		this.selected = null;
		this.symbol = 0;
		this.colour = 0;
		this.elapsedMs = 0;
		this.startTimer();
	}

	select(i: number): void {
		if (this.givens[i] === 0) {
			this.selected = i;
		}
	}

	place(): void {
		const i = this.selected;
		if (i === null) return;
		if (this.givens[i] !== 0) return;
		const encoded = encodePair(this.symbol, this.colour, this.n);
		const next = [...this.cells];
		next[i] = encoded;
		this.cells = next;
	}

	clear(): void {
		const i = this.selected;
		if (i === null) return;
		if (this.givens[i] !== 0) return;
		const next = [...this.cells];
		next[i] = 0;
		this.cells = next;
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
