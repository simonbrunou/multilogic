<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { GrecoStore } from '$lib/play/greco.svelte';
  import { createPuzzleService, type Bundle } from '$lib/puzzle-service';
  import { createWorkerTransport } from '$lib/worker-transport';
  import { createStorage } from '$lib/storage';
  import { getModule } from '../../../engine/puzzles/registry';
  import GrecoBoard from '$lib/components/GrecoBoard.svelte';
  import TimerView from '$lib/components/TimerView.svelte';
  import type { Difficulty } from '../../../engine/core/types';
  import type { Transport } from '$lib/puzzle-service';
  import { SvelteSet } from 'svelte/reactivity';
  import type { GrecoLatinInstance } from '../../../engine/puzzles/grecolatin/types';
  import { difficultyLabel } from '$lib/i18n';

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

    let bundle: Bundle | null = null;
    try {
      bundle = await (await fetch('/puzzles.bundle.json')).json();
    } catch {
      bundle = null;
    }

    try {
      const transport = createWorkerTransport();
      currentTransport = transport;
      const svc = createPuzzleService(transport, { timeoutMs: 6000, bundle });
      const seed = `grecolatin-${Date.now()}-${Math.random()}`;
      const res = await svc.request('grecolatin', diff, seed);
      const inst = getModule('grecolatin').deserializeInstance(res.instance) as GrecoLatinInstance;
      store.load(inst.n, inst.givens);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Échec de la génération du casse-tête';
    } finally {
      loading = false;
    }
  }

  const result = $derived(store.result);

  // Record solve side-effect: only fires when complete+valid; guards against duplicate records
  // by keying on the elapsed time bucket so repeated renders don't double-record.
  $effect(() => {
    if (!result.complete || !result.valid || !storage) return;
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
    <a href="/">← Casse-têtes</a>
    <TimerView ms={store.elapsedMs} />
    <span>Gréco-latin · {difficultyLabel(difficulty)}</span>
  </header>

  {#if loading}
    <p>Génération…</p>
  {:else if error}
    <p class="error">{error}</p>
    <button onclick={() => newGame(difficulty)}>Réessayer</button>
  {:else}
    <GrecoBoard {store} />
  {/if}

  <div class="diffs">
    {#each ['easy', 'medium', 'hard', 'expert'] as d (d)}
      <button
        class="diff-btn"
        class:active={difficulty === d}
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
    font-family: system-ui, sans-serif;
  }

  header {
    display: flex;
    gap: 16px;
    align-items: center;
    width: min(92vw, 480px);
    justify-content: space-between;
  }

  header a {
    color: #1b3a8f;
    text-decoration: none;
  }

  .diffs {
    display: flex;
    gap: 6px;
    margin-top: 10px;
  }

  .diff-btn {
    padding: 6px 10px;
    border: 1px solid #ccc;
    border-radius: 8px;
    background: #f4f5f7;
    cursor: pointer;
    font-size: 13px;
  }

  .diff-btn.active {
    background: #1b3a8f;
    color: #fff;
    border-color: #1b3a8f;
  }

  .error {
    color: #cc0000;
  }
</style>
