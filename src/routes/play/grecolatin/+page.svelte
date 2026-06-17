<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import { GrecoStore } from '$lib/play/greco.svelte';
  import { generateInstance } from '$lib/load-instance';
  import { createStorage } from '$lib/storage';
  import { getModule } from '../../../engine/puzzles/registry';
  import GrecoBoard from '$lib/components/GrecoBoard.svelte';
  import TimerView from '$lib/components/TimerView.svelte';
  import SolvedBanner from '$lib/components/SolvedBanner.svelte';
  import type { Difficulty } from '../../../engine/core/types';
  import type { Transport } from '$lib/puzzle-service';
  import type { SavedGreco } from '$lib/storage';
  import type { GrecoLatinInstance } from '../../../engine/puzzles/grecolatin/types';
  import { difficultyLabel, t, puzzleTypeLabel } from '$lib/i18n';

  const store = new GrecoStore();
  let loading = $state(true);
  let difficulty = $state<Difficulty>('easy');
  let error = $state<string | null>(null);
  const storage = typeof localStorage !== 'undefined' ? createStorage(localStorage) : null;
  const SLOT = 'play:grecolatin';
  let currentInstanceStr = '';
  let currentTransport: Transport | null = null;
  // Whether this board's solve has been counted, so resuming a finished board never re-records it.
  let recorded = false;

  async function newGame(diff: Difficulty) {
    loading = true;
    error = null;
    difficulty = diff;
    recorded = false;
    currentTransport?.dispose?.();

    try {
      const seed = `grecolatin-${Date.now()}-${Math.random()}`;
      const res = await generateInstance('grecolatin', diff, seed, {
        timeoutMs: 6000,
        onTransport: (t) => { currentTransport = t; }
      });
      currentInstanceStr = res.instance;
      const inst = getModule('grecolatin').deserializeInstance(res.instance) as GrecoLatinInstance;
      store.load(inst.n, inst.digitClues, inst.letterClues);
    } catch (e) {
      error = e instanceof Error ? e.message : t('play.genFailed');
    } finally {
      loading = false;
      persist();
    }
  }

  function persist(): void {
    if (!storage || loading || error || !currentInstanceStr) return;
    const saved: SavedGreco = {
      type: 'grecolatin',
      difficulty,
      instance: currentInstanceStr,
      digits: [...store.digits],
      letters: [...store.letters],
      // Untracked so the 250ms timer writes don't make persist a 4Hz write storm.
      elapsedMs: untrack(() => store.elapsedMs),
      hintsUsed: untrack(() => store.hintsUsed),
      solved: result.complete && result.valid,
      recorded
    };
    storage.saveGame(SLOT, saved);
  }

  function resume(saved: SavedGreco): boolean {
    try {
      const inst = getModule('grecolatin').deserializeInstance(saved.instance) as GrecoLatinInstance;
      store.load(inst.n, inst.digitClues, inst.letterClues);
      store.restoreState(saved.digits, saved.letters, saved.elapsedMs);
      store.hintsUsed = saved.hintsUsed;
      currentInstanceStr = saved.instance;
      difficulty = saved.difficulty as Difficulty;
      recorded = saved.recorded;
      if (saved.solved) store.stopTimer();
      loading = false;
      return true;
    } catch {
      return false;
    }
  }

  const result = $derived(store.result);

  // Record a solve exactly once: on the live transition to complete+valid, never when a finished
  // board is resumed from storage (recorded is preset true in that case).
  $effect(() => {
    if (!result.complete || !result.valid) return;
    store.stopTimer();
    if (!storage || recorded) return;
    recorded = true;
    storage.recordSolve('grecolatin', difficulty, store.elapsedMs);
    persist(); // durably mark recorded so an un-solve + reload can't re-count this board
  });

  // Persist after every placement so a reload resumes the same puzzle + progress.
  $effect(() => { void store.digits; void store.letters; if (!loading) persist(); });

  onMount(() => {
    const saved = storage?.loadGame<SavedGreco>(SLOT);
    if (!(saved && saved.instance && resume(saved))) newGame('easy');
  });
  onDestroy(() => { persist(); store.stopTimer(); currentTransport?.dispose?.(); });
</script>

<main>
  <header>
    <a href="/">{t('nav.backPuzzles')}</a>
    <TimerView ms={store.elapsedMs} />
    <span>{puzzleTypeLabel('grecolatin')} · {difficultyLabel(difficulty)}</span>
  </header>

  {#if loading}
    <p>{t('play.generating')}</p>
  {:else if error}
    <p class="error">{error}</p>
    <button class="btn" onclick={() => newGame(difficulty)}>{t('play.retry')}</button>
  {:else}
    {#if result.complete && result.valid}
      <SolvedBanner
        timeMs={store.elapsedMs}
        hints={store.hintsUsed}
        onnewgame={() => newGame(difficulty)}
      />
    {/if}
    <GrecoBoard {store} />
  {/if}

  <div class="diffs">
    {#each ['easy', 'medium', 'hard', 'expert'] as d (d)}
      <button
        class="btn"
        class:is-active={difficulty === d}
        onclick={() => newGame(d as Difficulty)}
      >{difficultyLabel(d)}</button>
    {/each}
  </div>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 12px;
  }

  header {
    display: flex;
    gap: 16px;
    align-items: center;
    width: min(92vw, 480px);
    justify-content: space-between;
  }

  header a {
    color: var(--accent);
    text-decoration: none;
  }

  .diffs {
    display: flex;
    gap: 6px;
    margin-top: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .error {
    color: var(--danger);
  }
</style>
