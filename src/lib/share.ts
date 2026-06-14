export interface ShareData {
  type: string;
  date: string;
  timeMs: number;
  hints: number;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function capitalise(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

export function shareText(d: ShareData): string {
  const totalSeconds = Math.floor(d.timeMs / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  const hints = d.hints === 0 ? 'no hints' : `${d.hints} hint${d.hints === 1 ? '' : 's'}`;
  return `Multilogic ${capitalise(d.type)} · ${d.date} · ${mm}:${pad2(ss)} · ${hints}`;
}

/** URL hash encoding the puzzle to land a friend on the same daily seed. */
export function encodeShare(x: { type: string; date: string }): string {
  return `#${x.type}:${x.date}`;
}

export function decodeShare(hash: string): { type: string; date: string } | null {
  const m = /^#?([a-z]+):(\d{4}-\d{2}-\d{2})$/.exec(hash);
  return m ? { type: m[1], date: m[2] } : null;
}
