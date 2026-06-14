// French display labels for engine-level difficulty keys.
// The keys ('easy' | 'medium' | 'hard' | 'expert') are part of the engine API and
// are used as storage keys, so they must stay in English — only the display changes.
export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Difficile',
  expert: 'Expert'
};

export function difficultyLabel(d: string): string {
  return DIFFICULTY_LABELS[d] ?? d;
}
