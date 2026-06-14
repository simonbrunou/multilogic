<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { GameStore } from '$lib/game.svelte';
  import { createPuzzleService, type Bundle } from '$lib/puzzle-service';
  import { createWorkerTransport } from '$lib/worker-transport';
  import { createStorage } from '$lib/storage';
  import SudokuGrid from '$lib/components/SudokuGrid.svelte';
  import NumberPad from '$lib/components/NumberPad.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import TimerView from '$lib/components/TimerView.svelte';
  import type { Difficulty } from '../../../engine/core/types';

  const store = new GameStore();
  let loading = $state(true);
  let difficulty = $state<Difficulty>('easy');
  const storage = typeof localStorage !== 'undefined' ? createStorage(localStorage) : null;

  async function newGame(diff: Difficulty) {
    loading = true;
    difficulty = diff;
    let bundle: Bundle | null = null;
    try { bundle = await (await fetch('/puzzles.bundle.json')).json(); } catch { bundle = null; }
    const svc = createPuzzleService(createWorkerTransport(), { timeoutMs: 4000, bundle });
    const seed = `sudoku-${Date.now()}-${Math.random()}`;
    const res = await svc.request('sudoku', diff, seed);
    store.load(res.givens, res.solution);
    loading = false;
  }

  onMount(() => { newGame('easy'); });
  onDestroy(() => store.stopTimer());

  const conflicts = $derived(store.game && store.tick >= 0 ? store.game.conflicts() : new Set<number>());
  const solved = $derived(store.game && store.tick >= 0 ? store.game.isSolved() : false);

  $effect(() => {
    if (solved && store.game && storage) {
      storage.recordSolve('sudoku', difficulty, store.elapsedMs);
    }
  });

  function onkey(e: KeyboardEvent) {
    if (e.key >= '1' && e.key <= '9') store.enter(Number(e.key));
    else if (e.key === 'Backspace' || e.key === 'Delete') store.erase();
  }
</script>

<svelte:window onkeydown={onkey} />

<main>
  <header>
    <a href="/">← Puzzles</a>
    <TimerView ms={store.elapsedMs} />
    <span>Sudoku · {difficulty}</span>
  </header>

  {#if loading}
    <p>Generating…</p>
  {:else if store.game}
    {#if solved}<p class="win">Solved! 🎉</p>{/if}
    <SudokuGrid game={store.game} selected={store.selected} tick={store.tick} {conflicts} onselect={(i) => (store.selected = i)} />
    <NumberPad onenter={(n) => store.enter(n)} noteMode={store.noteMode} />
    <Toolbar
      noteMode={store.noteMode}
      onnote={() => (store.noteMode = !store.noteMode)}
      onundo={() => store.undo()}
      onredo={() => store.redo()}
      onerase={() => store.erase()}
      onhint={() => store.hint()}
    />
    <div class="diffs">
      {#each ['easy', 'medium', 'hard', 'expert'] as d (d)}
        <button onclick={() => newGame(d as Difficulty)}>{d}</button>
      {/each}
    </div>
  {/if}
</main>

<style>
  main { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; }
  header { display: flex; gap: 16px; align-items: center; width: min(92vw, 480px); justify-content: space-between; }
  .win { color: #1b8f3a; font-weight: 700; }
  .diffs { display: flex; gap: 6px; margin-top: 14px; }
  .diffs button { padding: 6px 10px; border: 1px solid #ccc; border-radius: 8px; background: #f4f5f7; cursor: pointer; }
</style>
