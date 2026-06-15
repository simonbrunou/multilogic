// Message catalogs for the two supported locales.
//
// `en` is written first; `fr` is typed as `typeof en`, so the compiler guarantees the
// two catalogs stay in lock-step — a missing or mis-shaped key is a build error, not a
// silent untranslated string. Leaves are either plain strings (with `{name}` placeholders
// interpolated by `t`) or functions for cases that need word-order or pluralisation logic.

const en = {
  nav: {
    backPuzzles: '← Puzzles',
    backDaily: '← Daily challenges'
  },
  home: {
    tagline: 'Procedurally generated logic puzzles.',
    playHeading: 'Choose a puzzle',
    more: 'More',
    daily: 'Daily challenges',
    stats: 'Statistics',
    settings: 'Settings'
  },
  settings: {
    title: 'Settings',
    darkMode: 'Dark mode',
    highlightErrors: 'Highlight errors',
    autoNotes: 'Auto notes',
    language: 'Language'
  },
  stats: {
    title: 'Statistics',
    difficulty: 'Difficulty',
    solved: 'Solved',
    bestTime: 'Best time'
  },
  daily: {
    title: 'Daily challenges',
    notADaily: 'This is not a daily challenge.',
    heading: (p: { label: string; date: string }) => `Daily ${p.label} · ${p.date}`
  },
  play: {
    generating: 'Generating…',
    solved: 'Solved!',
    solvedEmoji: 'Solved! 🎉',
    time: (p: { time: string }) => `Time ${p.time}`,
    newGame: 'New game',
    howToPlay: 'How to play',
    share: 'Share result',
    copied: 'Copied!',
    confirmNewTitle: 'Start a new game?',
    confirmNewBody: 'Your current progress will be lost.',
    confirmNewStart: 'Start',
    cancel: 'Cancel',
    retry: 'Try again',
    genFailed: 'Failed to generate puzzle',
    unknownType: (p: { type: string }) => `Unknown puzzle type: ${p.type}`
  },
  error: {
    title: 'Something went wrong.',
    reload: 'Reload'
  },
  toolbar: {
    notes: 'Notes',
    undo: 'Undo',
    redo: 'Redo',
    erase: 'Erase',
    hint: 'Hint'
  },
  greco: {
    letter: 'Letter:',
    digit: 'Digit:',
    erase: 'Erase',
    hint: 'Hint',
    placed: (p: { filled: number; total: number }) => `${p.filled}/${p.total} placed`,
    solvedBanner: 'Solved! You completed the Greco-Latin square!'
  },
  aria: {
    cell: (p: { i: number }) => `cell ${p.i}`,
    cellAt: (p: { row: number; col: number; value: string }) =>
      `row ${p.row}, column ${p.col}, ${p.value}`,
    empty: 'empty',
    letter: (p: { char: string }) => `letter ${p.char}`
  },
  rules: {
    sudoku: 'Fill every row, column, and 3×3 box with the digits 1–9, no repeats.',
    tectonic: 'Fill each outlined region with 1–n. Identical digits may never touch, even diagonally.',
    kakuro: 'Fill the white cells so each run sums to its clue. No digit repeats within a run.',
    grecolatin: 'Place a letter and a digit in every cell so each appears once per row and column, and no letter-digit pair repeats.',
    yakuso: 'Fill each column so its digits add up to the total at its foot. No digit repeats in a column.'
  },
  puzzle: {
    sudoku: 'Sudoku',
    tectonic: 'Tectonic',
    kakuro: 'Kakuro',
    grecolatin: 'Greco-Latin',
    yakuso: 'Yakuso'
  },
  difficulty: {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    expert: 'Expert'
  },
  share: {
    hints: (p: { count: number }) =>
      p.count === 0 ? 'no hints' : `${p.count} hint${p.count === 1 ? '' : 's'}`
  }
};

const fr: typeof en = {
  nav: {
    backPuzzles: '← Casse-têtes',
    backDaily: '← Défis du jour'
  },
  home: {
    tagline: 'Casse-têtes de logique générés de façon procédurale.',
    playHeading: 'Choisissez un casse-tête',
    more: 'Plus',
    daily: 'Défis du jour',
    stats: 'Statistiques',
    settings: 'Paramètres'
  },
  settings: {
    title: 'Paramètres',
    darkMode: 'Mode sombre',
    highlightErrors: 'Surligner les erreurs',
    autoNotes: 'Notes automatiques',
    language: 'Langue'
  },
  stats: {
    title: 'Statistiques',
    difficulty: 'Difficulté',
    solved: 'Résolus',
    bestTime: 'Meilleur temps'
  },
  daily: {
    title: 'Défis du jour',
    notADaily: "Ce n'est pas un défi quotidien.",
    heading: (p) => `${p.label} du jour · ${p.date}`
  },
  play: {
    generating: 'Génération…',
    solved: 'Résolu !',
    solvedEmoji: 'Résolu ! 🎉',
    time: (p) => `Temps ${p.time}`,
    newGame: 'Nouvelle partie',
    howToPlay: 'Comment jouer',
    share: 'Partager le résultat',
    copied: 'Copié !',
    confirmNewTitle: 'Commencer une nouvelle partie ?',
    confirmNewBody: 'Votre progression actuelle sera perdue.',
    confirmNewStart: 'Commencer',
    cancel: 'Annuler',
    retry: 'Réessayer',
    genFailed: 'Échec de la génération du casse-tête',
    unknownType: (p) => `Type de casse-tête inconnu : ${p.type}`
  },
  error: {
    title: 'Une erreur est survenue.',
    reload: 'Recharger'
  },
  toolbar: {
    notes: 'Notes',
    undo: 'Annuler',
    redo: 'Rétablir',
    erase: 'Effacer',
    hint: 'Indice'
  },
  greco: {
    letter: 'Lettre :',
    digit: 'Chiffre :',
    erase: 'Effacer',
    hint: 'Indice',
    placed: (p) => `${p.filled}/${p.total} placées`,
    solvedBanner: 'Résolu ! Vous avez complété le carré gréco-latin !'
  },
  aria: {
    cell: (p) => `case ${p.i}`,
    cellAt: (p) => `ligne ${p.row}, colonne ${p.col}, ${p.value}`,
    empty: 'vide',
    letter: (p) => `lettre ${p.char}`
  },
  rules: {
    sudoku: 'Remplissez chaque ligne, colonne et boîte 3×3 avec les chiffres 1 à 9, sans répétition.',
    tectonic: 'Remplissez chaque région délimitée avec 1 à n. Deux chiffres identiques ne peuvent jamais se toucher, même en diagonale.',
    kakuro: 'Remplissez les cases blanches pour que chaque série atteigne la somme indiquée. Aucun chiffre ne se répète dans une série.',
    grecolatin: 'Placez une lettre et un chiffre dans chaque case : chacun apparaît une fois par ligne et par colonne, et aucune paire lettre-chiffre ne se répète.',
    yakuso: 'Remplissez chaque colonne pour que ses chiffres totalisent la valeur indiquée en bas. Aucun chiffre ne se répète dans une colonne.'
  },
  puzzle: {
    sudoku: 'Sudoku',
    tectonic: 'Tectonic',
    kakuro: 'Kakuro',
    grecolatin: 'Gréco-latin',
    yakuso: 'Yakuso'
  },
  difficulty: {
    easy: 'Facile',
    medium: 'Moyen',
    hard: 'Difficile',
    expert: 'Expert'
  },
  share: {
    hints: (p) =>
      p.count === 0 ? 'aucun indice' : `${p.count} indice${p.count === 1 ? '' : 's'}`
  }
};

const catalogs = { en, fr };

export type Locale = keyof typeof catalogs;

/** Each locale's name in its own language, for the language switcher. */
export const localeNames: Record<Locale, string> = {
  en: 'English',
  fr: 'Français'
};

// --- Pure resolvers ---------------------------------------------------------
// These are plain functions of `locale`, with no reactive state, so they're safe to
// use from non-component code (e.g. share text) and from unit tests. The runes store
// wraps them with the active locale.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Params = Record<string, any>;

/** Resolve a dotted key in a given locale. See `t` in the store for behaviour. */
export function tr(loc: Locale, key: string, params: Params = {}): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = catalogs[loc];
  for (const part of key.split('.')) {
    node = node?.[part];
  }
  if (node == null) return key;
  if (typeof node === 'function') return node(params);
  return String(node).replace(/\{(\w+)\}/g, (_, k: string) =>
    k in params ? String(params[k]) : `{${k}}`
  );
}

/** Localised difficulty name in a given locale, falling back to the raw key. */
export function difficultyName(loc: Locale, d: string): string {
  const diffs = catalogs[loc].difficulty as Record<string, string>;
  return diffs[d] ?? d;
}

/** Localised puzzle-type name in a given locale, falling back to a capitalised id. */
export function puzzleName(loc: Locale, type: string): string {
  const names = catalogs[loc].puzzle as Record<string, string>;
  return names[type] ?? (type ? type[0].toUpperCase() + type.slice(1) : type);
}
