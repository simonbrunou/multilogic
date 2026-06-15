<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { GameStore } from '$lib/game.svelte';
  import { generateInstance } from '$lib/load-instance';
  import { createStorage } from '$lib/storage';
  import { dailySeed, todayISO } from '$lib/daily';
  import { shareText, encodeShare, decodeShare } from '$lib/share';
  import NumberPad from '$lib/components/NumberPad.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import TimerView from '$lib/components/TimerView.svelte';
  import type { PuzzleType } from '../../../engine/core/types';
  import type { Transport } from '$lib/puzzle-service';
  import { PLAY_UI } from '$lib/play/registry';
  import { t, puzzleTypeLabel, locale } from '$lib/i18n';
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
    const res = await generateInstance(type as PuzzleType, 'medium', dailySeed(type, date), {
      timeoutMs: 6000,
      onTransport: (t) => { currentTransport = t; }
    });
    currentInstanceStr = res.instance;
    const game = entryNow.makeGame(res.instance, res.solution);
    store.load(game, entryNow.hintProvider(res.instance));
    loading = false;
  }

  onMount(() => { loadDaily(puzzleType); });
  onDestroy(() => { store.stopTimer(); currentTransport?.dispose?.(); });

  async function share() {
    if (!entry) return;
    const text = shareText({ type: puzzleType, date, timeMs: store.elapsedMs, hints: store.hintsUsed }, locale());
    const url = location.origin + '/daily/' + puzzleType + encodeShare({ type: puzzleType, date });
    try { await navigator.clipboard.writeText(`${text}\n${url}`); } catch { /* clipboard unavailable */ }
  }

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
    <p>{t('daily.notADaily')}</p>
    <a href="/daily">{t('nav.backDaily')}</a>
  {:else}
    <header>
      <a href="/daily">{t('nav.backDaily')}</a>
      <TimerView ms={store.elapsedMs} />
      <span>{t('daily.heading', { label: puzzleTypeLabel(puzzleType), date })}</span>
    </header>

    {#if loading}
      <p>{t('play.generating')}</p>
    {:else if store.game}
      {#if solved}
        <p class="win">{t('play.solved')}</p>
        <button onclick={share}>{t('play.share')}</button>
      {/if}
      <entry.Grid
        game={store.game}
        selected={store.selected}
        tick={store.tick}
        {conflicts}
        onselect={(i: number) => (store.selected = i)}
      />
      <NumberPad onenter={(n) => store.enter(n)} noteMode={store.noteMode} {maxDigit} {allowZero} />
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
