<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { GameStore } from '$lib/game.svelte';
  import { createPuzzleService, type Bundle } from '$lib/puzzle-service';
  import { createWorkerTransport } from '$lib/worker-transport';
  import { createStorage } from '$lib/storage';
  import { dailySeed, todayISO } from '$lib/daily';
  import { shareText, encodeShare, decodeShare } from '$lib/share';
  import NumberPad from '$lib/components/NumberPad.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import TimerView from '$lib/components/TimerView.svelte';
  import type { PuzzleType } from '../../../engine/core/types';
  import type { Transport } from '$lib/puzzle-service';
  import { PLAY_UI } from '$lib/play/registry';
  import { SvelteSet } from 'svelte/reactivity';

  const puzzleType = $derived(page.params.type as PuzzleType);
  const entry = $derived(PLAY_UI[puzzleType]);

  // Resolve date: from shared URL hash or today
  function resolveDate(type: string): string {
    if (typeof location !== 'undefined') {
      const decoded = decodeShare(location.hash);
      if (decoded && decoded.type === type) return decoded.date;
    }
    return todayISO(new Date());
  }

  const store = new GameStore();
  let loading = $state(true);
  let date = $state(todayISO(new Date()));
  let currentInstanceStr = $state('');
  let currentTransport: Transport | null = null;
  const storage = typeof localStorage !== 'undefined' ? createStorage(localStorage) : null;
  // Tracks keys for which we already recorded a solve to prevent duplicate records.
  const recordedSolves = new SvelteSet<string>();

  const conflicts = $derived(store.game && store.tick >= 0 ? store.game.conflicts() : new Set<number>());
  const solved = $derived(store.game && store.tick >= 0 ? store.game.isSolved() : false);
  const maxDigit = $derived(entry && currentInstanceStr ? entry.maxDigit(currentInstanceStr) : 9);

  $effect(() => {
    if (!solved || !store.game || !storage) return;
    const key = `${puzzleType}:daily:${Math.floor(store.elapsedMs / 250)}`;
    if (recordedSolves.has(key)) return;
    recordedSolves.add(key);
    storage.recordSolve(puzzleType, 'daily', store.elapsedMs);
  });

  async function loadDaily(type: string) {
    const entryNow = PLAY_UI[type as PuzzleType];
    if (!entryNow) return;
    loading = true;
    currentTransport?.dispose?.();
    date = resolveDate(type);
    let bundle: Bundle | null = null;
    try { bundle = await (await fetch('/puzzles.bundle.json')).json(); } catch { bundle = null; }
    const transport = createWorkerTransport();
    currentTransport = transport;
    const svc = createPuzzleService(transport, { timeoutMs: 6000, bundle });
    const res = await svc.request(type as PuzzleType, 'medium', dailySeed(type, date));
    currentInstanceStr = res.instance;
    const game = entryNow.makeGame(res.instance, res.solution);
    store.load(game, entryNow.hintProvider(res.instance));
    loading = false;
  }

  onMount(() => { loadDaily(puzzleType); });
  onDestroy(() => { store.stopTimer(); currentTransport?.dispose?.(); });

  async function share() {
    if (!entry) return;
    const text = shareText({ type: puzzleType, date, timeMs: store.elapsedMs, hints: store.hintsUsed });
    const url = location.origin + '/daily/' + puzzleType + encodeShare({ type: puzzleType, date });
    try { await navigator.clipboard.writeText(`${text}\n${url}`); } catch { /* clipboard unavailable */ }
  }

  function onkey(e: KeyboardEvent) {
    const d = Number(e.key);
    if (d >= 1 && d <= maxDigit) store.enter(d);
    else if (e.key === 'Backspace' || e.key === 'Delete') store.erase();
  }
</script>

<svelte:window onkeydown={onkey} />

<main>
  {#if !entry}
    <p>Not a daily puzzle.</p>
    <a href="/daily">← Daily Puzzles</a>
  {:else}
    <header>
      <a href="/daily">← Daily Puzzles</a>
      <TimerView ms={store.elapsedMs} />
      <span>Daily {entry.label} · {date}</span>
    </header>

    {#if loading}
      <p>Generating…</p>
    {:else if store.game}
      {#if solved}
        <p class="win">Solved!</p>
        <button onclick={share}>Share result</button>
      {/if}
      <entry.Grid
        game={store.game}
        selected={store.selected}
        tick={store.tick}
        {conflicts}
        onselect={(i) => (store.selected = i)}
      />
      <NumberPad onenter={(n) => store.enter(n)} noteMode={store.noteMode} {maxDigit} />
      <Toolbar
        noteMode={store.noteMode}
        onnote={() => (store.noteMode = !store.noteMode)}
        onundo={() => store.undo()}
        onredo={() => store.redo()}
        onerase={() => store.erase()}
        onhint={() => store.hint()}
      />
    {/if}
  {/if}
</main>

<style>
  main { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; }
  header { display: flex; gap: 16px; align-items: center; width: min(92vw, 480px); justify-content: space-between; }
  header a { color: #1b3a8f; text-decoration: none; }
  .win { color: #1b8f3a; font-weight: 700; }
</style>
