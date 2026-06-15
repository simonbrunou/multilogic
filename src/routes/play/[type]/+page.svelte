<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { GameStore } from '$lib/game.svelte';
  import { generateInstance } from '$lib/load-instance';
  import { createStorage } from '$lib/storage';
  import NumberPad from '$lib/components/NumberPad.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import TimerView from '$lib/components/TimerView.svelte';
  import type { Difficulty, PuzzleType } from '../../../engine/core/types';
  import type { Transport } from '$lib/puzzle-service';
  import { PLAY_UI } from '$lib/play/registry';
  import { difficultyLabel, t, puzzleTypeLabel } from '$lib/i18n';

  const puzzleType = $derived(page.params.type as PuzzleType);
  const entry = $derived(PLAY_UI[puzzleType]);

  const store = new GameStore();
  let loading = $state(true);
  let difficulty = $state<Difficulty>('easy');
  const storage = typeof localStorage !== 'undefined' ? createStorage(localStorage) : null;
  let currentTransport: Transport | null = null;
  let currentInstanceStr = $state('');

  async function newGame(diff: Difficulty) {
    if (!entry) return;
    loading = true;
    difficulty = diff;
    currentTransport?.dispose?.();
    const seed = `${puzzleType}-${Date.now()}-${Math.random()}`;
    const res = await generateInstance(puzzleType, diff, seed, {
      timeoutMs: 4000,
      onTransport: (t) => { currentTransport = t; }
    });
    currentInstanceStr = res.instance;
    const game = entry.makeGame(res.instance, res.solution);
    store.load(game, entry.hintProvider(res.instance));
    loading = false;
  }

  onMount(() => { newGame('easy'); });
  onDestroy(() => { store.stopTimer(); currentTransport?.dispose?.(); });

  const conflicts = $derived(store.game && store.tick >= 0 ? store.game.conflicts() : new Set<number>());
  const solved = $derived(store.game && store.tick >= 0 ? store.game.isSolved() : false);
  const maxDigit = $derived(entry && currentInstanceStr ? entry.maxDigit(currentInstanceStr) : 9);

  $effect(() => {
    if (solved && store.game && storage) {
      storage.recordSolve(puzzleType, difficulty, store.elapsedMs);
    }
  });

  const allowZero = $derived(puzzleType === 'yakuso');

  function onkey(e: KeyboardEvent) {
    const d = Number(e.key);
    if (d >= 1 && d <= maxDigit) store.enter(d);
    else if (e.key === '0' && allowZero) store.enter(0);
    else if (e.key === 'Backspace' || e.key === 'Delete') store.erase();
  }
</script>

<svelte:window onkeydown={onkey} />

<main>
  {#if !entry}
    <p>{t('play.unknownType', { type: puzzleType })}</p>
    <a href="/">{t('nav.backPuzzles')}</a>
  {:else}
    <header>
      <a href="/">{t('nav.backPuzzles')}</a>
      <TimerView ms={store.elapsedMs} />
      <span>{puzzleTypeLabel(puzzleType)} · {difficultyLabel(difficulty)}</span>
    </header>

    {#if loading}
      <p>{t('play.generating')}</p>
    {:else if store.game}
      {#if solved}<p class="win">{t('play.solvedEmoji')}</p>{/if}
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
      <div class="diffs">
        {#each ['easy', 'medium', 'hard', 'expert'] as d (d)}
          <button onclick={() => newGame(d as Difficulty)}>{difficultyLabel(d)}</button>
        {/each}
      </div>
    {/if}
  {/if}
</main>

<style>
  main { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; }
  header { display: flex; gap: 16px; align-items: center; width: min(92vw, 480px); justify-content: space-between; }
  .win { color: #1b8f3a; font-weight: 700; }
  .diffs { display: flex; gap: 6px; margin-top: 14px; }
  .diffs button { padding: 6px 10px; border: 1px solid #ccc; border-radius: 8px; background: #f4f5f7; cursor: pointer; }
</style>
