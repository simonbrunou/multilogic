<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import { page } from '$app/state';
  import { GameStore } from '$lib/game.svelte';
  import { generateInstance } from '$lib/load-instance';
  import { createStorage } from '$lib/storage';
  import { dailySeed, todayISO } from '$lib/daily';
  import { shareText, encodeShare, decodeShare } from '$lib/share';
  import NumberPad from '$lib/components/NumberPad.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import TimerView from '$lib/components/TimerView.svelte';
  import SolvedBanner from '$lib/components/SolvedBanner.svelte';
  import type { PuzzleType } from '../../../engine/core/types';
  import type { Transport } from '$lib/puzzle-service';
  import { PLAY_UI } from '$lib/play/registry';
  import type { SavedGame } from '$lib/storage';
  import { t, puzzleTypeLabel, locale } from '$lib/i18n';

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
  let currentSolutionStr = '';
  let currentTransport: Transport | null = null;
  const storage = typeof localStorage !== 'undefined' ? createStorage(localStorage) : null;
  const slot = $derived(`daily:${puzzleType}:${date}`);
  // Guards against a [type]→[type] client nav reusing this component (see play/[type]).
  let loadedType = '';
  // Whether this daily's solve has been counted, so resuming a finished daily never re-records it.
  let recorded = false;

  const conflicts = $derived(store.game && store.tick >= 0 ? store.game.conflicts() : new Set<number>());
  const solved = $derived(store.game && store.tick >= 0 ? store.game.isSolved() : false);
  const maxDigit = $derived(entry && currentInstanceStr ? entry.maxDigit(currentInstanceStr) : 9);

  // Count a solve exactly once: live transition only, never on resuming an already-finished daily.
  $effect(() => {
    if (solved && store.game && storage && !recorded && loadedType === puzzleType) {
      recorded = true;
      storage.recordSolve(puzzleType, 'daily', store.elapsedMs);
      persist(); // durably mark recorded so an un-solve + reload can't re-count this daily
    }
  });

  async function loadDaily(type: string) {
    const entryNow = PLAY_UI[type as PuzzleType];
    if (!entryNow) return;
    loading = true;
    recorded = false;
    currentTransport?.dispose?.();
    date = resolveDate(type);
    const res = await generateInstance(type as PuzzleType, 'medium', dailySeed(type, date), {
      timeoutMs: 6000,
      onTransport: (t) => { currentTransport = t; }
    });
    currentInstanceStr = res.instance;
    currentSolutionStr = res.solution;
    loadedType = type;
    const game = entryNow.makeGame(res.instance, res.solution);
    store.load(game, entryNow.hintProvider(res.instance));
    loading = false;
    persist();
  }

  /** Persist today's daily so a reload restores the finished board (no re-acing for a faster time). */
  function persist(): void {
    if (!storage || !entry || !store.game || loading || loadedType !== puzzleType) return;
    const saved: SavedGame = {
      type: puzzleType,
      difficulty: 'daily',
      instance: currentInstanceStr,
      solution: currentSolutionStr,
      cells: [...store.game.cells],
      notes: store.game.notes.map((s, i) => [i, [...s]] as [number, number[]]).filter(([, d]) => d.length),
      // Untracked so the 250ms timer writes don't make persist a 4Hz write storm (see play/[type]).
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
      currentInstanceStr = saved.instance;
      currentSolutionStr = saved.solution;
      loadedType = puzzleType;
      recorded = saved.recorded;
      store.load(game, entry.hintProvider(saved.instance), saved.elapsedMs);
      store.hintsUsed = saved.hintsUsed;
      if (saved.solved) store.stopTimer();
      loading = false;
      return true;
    } catch {
      return false;
    }
  }

  onMount(() => {
    date = resolveDate(puzzleType);
    storage?.pruneDailies([todayISO(new Date()), date]);
    const saved = storage?.loadGame<SavedGame>(`daily:${puzzleType}:${date}`);
    if (!(saved && saved.type === puzzleType && saved.instance && resume(saved))) loadDaily(puzzleType);
  });
  onDestroy(() => { persist(); store.stopTimer(); currentTransport?.dispose?.(); });

  // Persist after every move (store.tick bumps on each input/erase/undo/redo).
  $effect(() => { void store.tick; if (!loading) persist(); });

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

<svelte:head>
  <title>{entry ? `${t('daily.heading', { label: puzzleTypeLabel(puzzleType), date })} — Multilogic` : 'Multilogic'}</title>
</svelte:head>

<svelte:window onkeydown={onkey} />

<main>
  {#if !entry}
    <p>{t('daily.notADaily')}</p>
    <a href="/daily">{t('nav.backDaily')}</a>
  {:else}
    <header>
      <a href="/daily">{t('nav.backDaily')}</a>
      <TimerView ms={store.elapsedMs} />
      <h1 class="page-title">{t('daily.heading', { label: puzzleTypeLabel(puzzleType), date })}</h1>
    </header>

    <details class="howto">
      <summary>{t('play.howToPlay')}</summary>
      <p>{t(`rules.${puzzleType}`)}</p>
    </details>

    {#if loading}
      <p>{t('play.generating')}</p>
    {:else if store.game}
      {#if solved}
        <SolvedBanner timeMs={store.elapsedMs} hints={store.hintsUsed} onshare={share} />
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
  header a { color: var(--accent); text-decoration: none; }
  .page-title { margin: 0; font-size: 1rem; font-weight: 400; }
  .howto { width: min(92vw, 480px); font-size: 0.85rem; color: var(--text-muted); }
  .howto summary { cursor: pointer; padding: 4px 0; min-height: 44px; display: flex; align-items: center; color: var(--accent); }
  .howto p { margin: 4px 0 0; line-height: 1.5; }
</style>
