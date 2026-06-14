export interface ShareData {
  type: string;
  date: string;
  timeMs: number;
  hints: number;
}

const TYPE_LABELS: Record<string, string> = {
  sudoku: 'Sudoku',
  tectonic: 'Tectonic',
  kakuro: 'Kakuro',
  grecolatin: 'Greco-Latin'
};

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? (type.length ? type[0].toUpperCase() + type.slice(1) : type);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function shareText(d: ShareData): string {
  const totalSeconds = Math.floor(d.timeMs / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  const hints = d.hints === 0 ? 'no hints' : `${d.hints} hint${d.hints === 1 ? '' : 's'}`;
  return `Multilogic ${typeLabel(d.type)} · ${d.date} · ${mm}:${pad2(ss)} · ${hints}`;
}

/** URL hash encoding the puzzle to land a friend on the same daily seed. */
export function encodeShare(x: { type: string; date: string }): string {
  return `#${x.type}:${x.date}`;
}

export function decodeShare(hash: string): { type: string; date: string } | null {
  const m = /^#?([a-z]+):(\d{4}-\d{2}-\d{2})$/.exec(hash);
  return m ? { type: m[1], date: m[2] } : null;
}
