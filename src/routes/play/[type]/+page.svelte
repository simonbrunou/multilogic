<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import { page } from '$app/state';
  import { GameStore } from '$lib/game.svelte';
  import { generateInstance } from '$lib/load-instance';
  import { createStorage } from '$lib/storage';
  import NumberPad from '$lib/components/NumberPad.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import TimerView from '$lib/components/TimerView.svelte';
  import SolvedBanner from '$lib/components/SolvedBanner.svelte';
  import type { Difficulty, PuzzleType } from '../../../engine/core/types';
  import type { Transport } from '$lib/puzzle-service';
  import { PLAY_UI } from '$lib/play/registry';
  import type { SavedGame } from '$lib/storage';
  import { difficultyLabel, t, puzzleTypeLabel } from '$lib/i18n';

  const puzzleType = $derived(page.params.type as PuzzleType);
  const entry = $derived(PLAY_UI[puzzleType]);
  const slot = $derived(`play:${puzzleType}`);

  const store = new GameStore();
  let loading = $state(true);
  let difficulty = $state<Difficulty>('easy');
  const storage = typeof localStorage !== 'undefined' ? createStorage(localStorage) : null;
  let currentTransport: Transport | null = null;
  let currentInstanceStr = $state('');
  let currentSolutionStr = '';
  // The puzzle type the in-memory board belongs to; guards persist() against a [type]→[type]
  // client navigation reusing this component (board still the old type, slot already the new one).
  let loadedType = '';
  // Whether this board's solve has been counted, so resuming a finished board never re-records it.
  let recorded = false;

  async function newGame(diff: Difficulty) {
    if (!entry) return;
    loading = true;
    difficulty = diff;
    recorded = false;
    currentTransport?.dispose?.();
    const seed = `${puzzleType}-${Date.now()}-${Math.random()}`;
    const res = await generateInstance(puzzleType, diff, seed, {
      timeoutMs: 4000,
      onTransport: (t) => { currentTransport = t; }
    });
    currentInstanceStr = res.instance;
    currentSolutionStr = res.solution;
    loadedType = puzzleType;
    const game = entry.makeGame(res.instance, res.solution);
    store.load(game, entry.hintProvider(res.instance));
    loading = false;
    persist();
  }

  /** Write the live board so a reload resumes the same puzzle + progress (not a fresh one). */
  function persist(): void {
    if (!storage || !entry || !store.game || loading || loadedType !== puzzleType) return;
    const saved: SavedGame = {
      type: puzzleType,
      difficulty,
      instance: currentInstanceStr,
      solution: currentSolutionStr,
      cells: [...store.game.cells],
      notes: store.game.notes.map((s, i) => [i, [...s]] as [number, number[]]).filter(([, d]) => d.length),
      // Read untracked so the timer's 250ms elapsedMs writes don't make this a dependency of the
      // persist $effect (which would turn every move-persist into a 4Hz write storm).
      elapsedMs: untrack(() => store.elapsedMs),
      hintsUsed: untrack(() => store.hintsUsed),
      solved: store.game.isSolved(),
      recorded
    };
    storage.saveGame(slot, saved);
  }

  function resume(saved: SavedGame): boolean {
    if (!entry) return false;
    try {
      const game = entry.makeGame(saved.instance, saved.solution);
      game.restore(saved.cells, saved.notes);
      difficulty = saved.difficulty as Difficulty;
      currentInstanceStr = saved.instance;
      currentSolutionStr = saved.solution;
      loadedType = puzzleType;
      recorded = saved.recorded; // counted once, durably — survives an un-solve + reload
      store.load(game, entry.hintProvider(saved.instance), saved.elapsedMs);
      store.hintsUsed = saved.hintsUsed;
      if (saved.solved) store.stopTimer();
      loading = false;
      return true;
    } catch {
      return false; // corrupt/mismatched save — fall back to a fresh game
    }
  }

  onMount(() => {
    const saved = storage?.loadGame<SavedGame>(`play:${puzzleType}`);
    if (!(saved && saved.type === puzzleType && saved.instance && resume(saved))) newGame('easy');
  });
  onDestroy(() => { persist(); store.stopTimer(); currentTransport?.dispose?.(); });

  // Persist after every move (store.tick bumps on each input/erase/undo/redo) and after a hint
  // (hint() bumps hintsUsed but not tick), so a reload right after a hint keeps the count.
  $effect(() => { void store.tick; void store.hintsUsed; if (!loading) persist(); });

  const conflicts = $derived(store.game && store.tick >= 0 ? store.game.conflicts() : new Set<number>());
  const solved = $derived(store.game && store.tick >= 0 ? store.game.isSolved() : false);
  const maxDigit = $derived(entry && currentInstanceStr ? entry.maxDigit(currentInstanceStr) : 9);

  // Count a solve exactly once: only on the live transition to solved, never when a finished
  // board is resumed from storage (recorded is preset true in that case).
  $effect(() => {
    if (solved && store.game && storage && !recorded && loadedType === puzzleType) {
      recorded = true;
      storage.recordSolve(puzzleType, difficulty, store.elapsedMs);
      persist(); // durably mark recorded so an un-solve + reload can't re-count this board
    }
  });

  const allowZero = $derived(puzzleType === 'yakuso');

  // True once the player has entered anything of their own (so switching difficulty would
  // throw away real work). Givens don't count; notes do.
  const hasProgress = $derived.by(() => {
    void store.tick;
    const g = store.game;
    if (!g) return false;
    return g.cells.some((v, i) => v !== 0 && !g.isGiven(i)) || g.notes.some((n) => n.size > 0);
  });

  // Difficulty awaiting confirmation before we discard an in-progress board.
  let confirmDiff = $state<Difficulty | null>(null);

  function requestNewGame(d: Difficulty) {
    if (solved || !hasProgress) newGame(d);
    else confirmDiff = d;
  }

  // Focus management for the confirm dialog: move focus in when it opens, restore it to the
  // control that triggered it on close, and trap Tab/Escape while it's up (role="alertdialog"
  // promises a modal, so keyboard focus must behave like one).
  let confirmEl = $state<HTMLElement | null>(null);
  let lastFocused: HTMLElement | null = null;

  $effect(() => {
    if (confirmDiff && confirmEl) {
      lastFocused = document.activeElement as HTMLElement | null;
      confirmEl.focus();
    }
  });

  function closeConfirm() {
    confirmDiff = null;
    lastFocused?.focus();
  }

  function onConfirmKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeConfirm();
      return;
    }
    if (e.key !== 'Tab' || !confirmEl) return;
    const f = confirmEl.querySelectorAll<HTMLElement>('button');
    if (f.length === 0) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onkey(e: KeyboardEvent) {
    // While the modal confirm is up, leave the board behind it untouched.
    if (confirmDiff) return;
    const d = Number(e.key);
    if (d >= 1 && d <= maxDigit) store.enter(d);
    else if (e.key === '0' && allowZero) store.enter(0);
    else if (e.key === 'Backspace' || e.key === 'Delete') store.erase();
  }
</script>

<svelte:head>
  <title>{entry ? `${puzzleTypeLabel(puzzleType)} · ${difficultyLabel(difficulty)} — Multilogic` : 'Multilogic'}</title>
</svelte:head>

<svelte:window onkeydown={onkey} />

<main>
  {#if !entry}
    <p>{t('play.unknownType', { type: puzzleType })}</p>
    <a href="/">{t('nav.backPuzzles')}</a>
  {:else}
    <header>
      <a href="/">{t('nav.backPuzzles')}</a>
      <TimerView ms={store.elapsedMs} />
      <h1 class="page-title">{puzzleTypeLabel(puzzleType)} · {difficultyLabel(difficulty)}</h1>
    </header>

    <details class="howto">
      <summary>{t('play.howToPlay')}</summary>
      <p>{t(`rules.${puzzleType}`)}</p>
    </details>

    {#if loading}
      <p>{t('play.generating')}</p>
    {:else if store.game}
      {#if solved}
        <SolvedBanner
          timeMs={store.elapsedMs}
          hints={store.hintsUsed}
          onnewgame={() => newGame(difficulty)}
        />
      {/if}
      <entry.Grid game={store.game} selected={store.selected} tick={store.tick} {conflicts} onselect={(i: number) => (store.selected = i)} />
      <NumberPad onenter={(n) => store.enter(n)} noteMode={store.noteMode} {maxDigit} {allowZero} />
      <Toolbar
        noteMode={store.noteMode}
        onnote={() => (store.noteMode = !store.noteMode)}
        onundo={() => store.undo()}
        onredo={() => store.redo()}
        onerase={() => store.erase()}
        onhint={() => store.hint()}
      />

      {#if confirmDiff}
        <div
          class="confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-body"
          tabindex="-1"
          bind:this={confirmEl}
          onkeydown={onConfirmKeydown}
        >
          <p class="confirm-title" id="confirm-title">{t('play.confirmNewTitle')}</p>
          <p class="confirm-body" id="confirm-body">{t('play.confirmNewBody')}</p>
          <div class="confirm-actions">
            <button class="btn" onclick={closeConfirm}>{t('play.cancel')}</button>
            <button
              class="btn btn-primary"
              onclick={() => {
                const d = confirmDiff;
                confirmDiff = null;
                if (d) newGame(d);
              }}>{t('play.confirmNewStart')}</button
            >
          </div>
        </div>
      {/if}

      <div class="diffs">
        {#each ['easy', 'medium', 'hard', 'expert'] as d (d)}
          <button class="btn" class:is-active={difficulty === d} onclick={() => requestNewGame(d as Difficulty)}>{difficultyLabel(d)}</button>
        {/each}
      </div>
    {/if}
  {/if}
</main>

<style>
  main { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; }
  header { display: flex; gap: 16px; align-items: center; width: min(92vw, 480px); justify-content: space-between; }
  header a { color: var(--accent); }
  /* The page heading doubles as the in-header status line; keep it at body weight/size so the
     visual layout is unchanged while screen-reader users still get a real h1 to navigate to. */
  .page-title { margin: 0; font-size: 1rem; font-weight: 400; }
  .howto { width: min(92vw, 480px); font-size: 0.85rem; color: var(--text-muted); }
  .howto summary { cursor: pointer; padding: 4px 0; min-height: 44px; display: flex; align-items: center; color: var(--accent); }
  .howto p { margin: 4px 0 0; line-height: 1.5; }
  .diffs { display: flex; gap: 6px; margin-top: 14px; flex-wrap: wrap; justify-content: center; }
  .confirm { display: flex; flex-direction: column; align-items: center; gap: 4px; width: min(92vw, 360px); margin-top: 12px; padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); text-align: center; }
  .confirm-title { margin: 0; font-weight: 700; }
  .confirm-body { margin: 0; font-size: 0.85rem; color: var(--text-muted); }
  .confirm-actions { display: flex; gap: 8px; margin-top: 10px; }
</style>
