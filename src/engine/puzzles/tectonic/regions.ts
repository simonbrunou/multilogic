import type { PRNG } from '../../core/prng';

const MAX_REGION = 5;

/** Partition a width×height grid into contiguous regions of size 1..5 (seeded). */
export function generateRegions(width: number, height: number, prng: PRNG): number[] {
  const n = width * height;
  const regions = new Array<number>(n).fill(-1);
  const orthog = (i: number): number[] => {
    const r = Math.floor(i / width), c = i % width;
    const out: number[] = [];
    if (r > 0) out.push(i - width);
    if (r < height - 1) out.push(i + width);
    if (c > 0) out.push(i - 1);
    if (c < width - 1) out.push(i + 1);
    return out;
  };
  let regionId = 0;
  const cellOrder = prng.shuffle(Array.from({ length: n }, (_, i) => i));
  for (const start of cellOrder) {
    if (regions[start] !== -1) continue;
    const target = 1 + prng.int(MAX_REGION);
    const members = [start];
    regions[start] = regionId;
    while (members.length < target) {
      const frontier: number[] = [];
      for (const m of members) for (const nb of orthog(m)) if (regions[nb] === -1) frontier.push(nb);
      if (frontier.length === 0) break;
      const pick = frontier[prng.int(frontier.length)];
      if (regions[pick] === -1) { regions[pick] = regionId; members.push(pick); }
    }
    regionId++;
  }
  return regions;
}
