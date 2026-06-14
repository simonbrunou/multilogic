import { deriveSeed } from '../engine/core/prng';

/** YYYY-MM-DD in UTC for a given Date. */
export function todayISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Deterministic seed string for a type's daily puzzle on a given ISO date. */
export function dailySeed(type: string, dateISO: string): string {
  return deriveSeed(type, 'daily', dateISO);
}
