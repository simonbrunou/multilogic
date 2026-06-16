<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { GrecoStore } from '$lib/play/greco.svelte';
  import { generateInstance } from '$lib/load-instance';
  import { createStorage } from '$lib/storage';
  import { getModule } from '../../../engine/puzzles/registry';
  import GrecoBoard from '$lib/components/GrecoBoard.svelte';
  import TimerView from '$lib/components/TimerView.svelte';
  import SolvedBanner from '$lib/components/SolvedBanner.svelte';
  import type { Difficulty } from '../../../engine/core/types';
  import type { Transport } from '$lib/puzzle-service';
  import { SvelteSet } from 'svelte/reactivity';
  import type { GrecoLatinInstance } from '../../../engine/puzzles/grecolatin/types';
  import { difficultyLabel, t, puzzleTypeLabel } from '$lib/i18n';

  const store = new GrecoStore();
  let loading = $state(true);
  let difficulty = $state<Difficulty>('easy');
  let error = $state<string | null>(null);
  const storage = typeof localStorage !== 'undefined' ? createStorage(localStorage) : null;
  let currentTransport: Transport | null = null;
  // Track keys for which we already recorded a solve (non-UI, but SvelteSet satisfies linter).
  const recordedSolves = new SvelteSet<string>();

  async function newGame(diff: Difficulty) {
    loading = true;
    error = null;
    difficulty = diff;
    currentTransport?.dispose?.();

    try {
      const seed = `grecolatin-${Date.now()}-${Math.random()}`;
      const res = await generateInstance('grecolatin', diff, seed, {
        timeoutMs: 6000,
        onTransport: (t) => { currentTransport = t; }
      });
      const inst = getModule('grecolatin').deserializeInstance(res.instance) as GrecoLatinInstance;
      store.load(inst.n, inst.digitClues, inst.letterClues);
    } catch (e) {
      error = e instanceof Error ? e.message : t('play.genFailed');
    } finally {
      loading = false;
    }
  }

  const result = $derived(store.result);

  // Record solve side-effect: only fires when complete+valid; guards against duplicate records
  // by keying on the elapsed time bucket so repeated renders don't double-record.
  $effect(() => {
    if (!result.complete || !result.valid) return;
    store.stopTimer();
    if (!storage) return;
    const key = `${difficulty}:${Math.floor(store.elapsedMs / 250)}`;
    if (recordedSolves.has(key)) return;
    recordedSolves.add(key);
    storage.recordSolve('grecolatin', difficulty, store.elapsedMs);
  });

  onMount(() => { newGame('easy'); });
  onDestroy(() => { store.stopTimer(); currentTransport?.dispose?.(); });
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
