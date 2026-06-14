<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { GameStore } from '$lib/game.svelte';
  import { createPuzzleService, type Bundle } from '$lib/puzzle-service';
  import { createWorkerTransport } from '$lib/worker-transport';
  import { dailySeed, todayISO } from '$lib/daily';
  import { shareText, encodeShare } from '$lib/share';
  import SudokuGrid from '$lib/components/SudokuGrid.svelte';
  import NumberPad from '$lib/components/NumberPad.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import TimerView from '$lib/components/TimerView.svelte';
  import type { Transport } from '$lib/puzzle-service';
  import { PLAY_UI } from '$lib/play/registry';

  const store = new GameStore();
  let loading = $state(true);
  const date = todayISO(new Date());
  let currentTransport: Transport | null = null;

  const sudokuEntry = PLAY_UI['sudoku']!;

  onMount(async () => {
    let bundle: Bundle | null = null;
    try { bundle = await (await fetch('/puzzles.bundle.json')).json(); } catch { bundle = null; }
    const transport = createWorkerTransport();
    currentTransport = transport;
    const svc = createPuzzleService(transport, { timeoutMs: 6000, bundle });
    const res = await svc.request('sudoku', 'medium', dailySeed('sudoku', date));
    const game = sudokuEntry.makeGame(res.instance, res.solution);
    store.load(game, sudokuEntry.hintProvider(res.instance));
    loading = false;
  });
  onDestroy(() => { store.stopTimer(); currentTransport?.dispose?.(); });

  const conflicts = $derived(store.game && store.tick >= 0 ? store.game.conflicts() : new Set<number>());
  const solved = $derived(store.game && store.tick >= 0 ? store.game.isSolved() : false);

  async function share() {
    const text = shareText({ type: 'sudoku', date, timeMs: store.elapsedMs, hints: store.hintsUsed });
    const url = location.origin + '/daily' + encodeShare({ type: 'sudoku', date });
    try { await navigator.clipboard.writeText(`${text}\n${url}`); } catch { /* clipboard unavailable */ }
  }
</script>

<main>
  <header><a href="/">← Puzzles</a><TimerView ms={store.elapsedMs} /><span>Daily · {date}</span></header>
  {#if loading}<p>Generating…</p>{:else if store.game}
    {#if solved}<p class="win">Solved! 🎉</p><button onclick={share}>Share result</button>{/if}
    <SudokuGrid game={store.game} selected={store.selected} tick={store.tick} {conflicts} onselect={(i) => (store.selected = i)} />
    <NumberPad onenter={(n) => store.enter(n)} noteMode={store.noteMode} />
    <Toolbar noteMode={store.noteMode} onnote={() => (store.noteMode = !store.noteMode)} onundo={() => store.undo()} onredo={() => store.redo()} onerase={() => store.erase()} onhint={() => store.hint()} />
  {/if}
</main>
<style>main { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; } header { display: flex; gap: 16px; width: min(92vw, 480px); justify-content: space-between; } .win { color: #1b8f3a; font-weight: 700; }</style>
