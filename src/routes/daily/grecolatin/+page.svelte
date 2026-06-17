<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import { GrecoStore } from '$lib/play/greco.svelte';
  import { generateInstance } from '$lib/load-instance';
  import { createStorage } from '$lib/storage';
  import { getModule } from '../../../engine/puzzles/registry';
  import { dailySeed, todayISO } from '$lib/daily';
  import { shareText, encodeShare, decodeShare } from '$lib/share';
  import GrecoBoard from '$lib/components/GrecoBoard.svelte';
  import TimerView from '$lib/components/TimerView.svelte';
  import SolvedBanner from '$lib/components/SolvedBanner.svelte';
  import type { Transport } from '$lib/puzzle-service';
  import type { SavedGreco } from '$lib/storage';
  import type { GrecoLatinInstance } from '../../../engine/puzzles/grecolatin/types';
  import { t, puzzleTypeLabel, locale } from '$lib/i18n';

  const store = new GrecoStore();
  let loading = $state(true);
  let error = $state<string | null>(null);
  let date = $state(todayISO(new Date()));
  let currentInstanceStr = '';
  let currentTransport: Transport | null = null;
  const storage = typeof localStorage !== 'undefined' ? createStorage(localStorage) : null;
  const slot = $derived(`daily:grecolatin:${date}`);
  // Whether this daily's solve has been counted, so resuming a finished daily never re-records it.
  let recorded = false;

  function resolveDate(): string {
    if (typeof location !== 'undefined') {
      const decoded = decodeShare(location.hash);
      if (decoded && decoded.type === 'grecolatin') return decoded.date;
    }
    return todayISO(new Date());
  }

  const result = $derived(store.result);

  // Record a solve exactly once: live transition only, never on resuming an already-finished daily.
  $effect(() => {
    if (!result.complete || !result.valid) return;
    store.stopTimer();
    if (!storage || recorded) return;
    recorded = true;
    storage.recordSolve('grecolatin', 'daily', store.elapsedMs);
    persist(); // durably mark recorded so an un-solve + reload can't re-count this daily
  });

  // Persist after every placement so a reload restores the finished daily (no re-acing).
  $effect(() => { void store.digits; void store.letters; if (!loading) persist(); });

  function persist(): void {
    if (!storage || loading || error || !currentInstanceStr) return;
    const saved: SavedGreco = {
      type: 'grecolatin',
      difficulty: 'daily',
      instance: currentInstanceStr,
      digits: [...store.digits],
      letters: [...store.letters],
      // Untracked so the 250ms timer writes don't make persist a 4Hz write storm.
      elapsedMs: untrack(() => store.elapsedMs),
      hintsUsed: untrack(() => store.hintsUsed),
      solved: result.complete && result.valid,
      recorded
    };
    storage.saveGame(slot, saved);
  }

  function resume(saved: SavedGreco): boolean {
    try {
      const inst = getModule('grecolatin').deserializeInstance(saved.instance) as GrecoLatinInstance;
      store.load(inst.n, inst.digitClues, inst.letterClues);
      store.restoreState(saved.digits, saved.letters, saved.elapsedMs);
      store.hintsUsed = saved.hintsUsed;
      currentInstanceStr = saved.instance;
      recorded = saved.recorded;
      if (saved.solved) store.stopTimer();
      loading = false;
      return true;
    } catch {
      return false;
    }
  }

  onMount(async () => {
    date = resolveDate();
    storage?.pruneDailies([todayISO(new Date()), date]);
    const saved = storage?.loadGame<SavedGreco>(`daily:grecolatin:${date}`);
    if (saved && saved.instance && resume(saved)) return;
    loading = true;
    error = null;
    try {
      const res = await generateInstance('grecolatin', 'medium', dailySeed('grecolatin', date), {
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
  });

  onDestroy(() => { persist(); store.stopTimer(); currentTransport?.dispose?.(); });

  async function share() {
    const text = shareText({ type: 'grecolatin', date, timeMs: store.elapsedMs, hints: store.hintsUsed }, locale());
    const url = location.origin + '/daily/grecolatin' + encodeShare({ type: 'grecolatin', date });
    try { await navigator.clipboard.writeText(`${text}\n${url}`); } catch { /* clipboard unavailable */ }
  }
</script>

<svelte:head>
  <title>{t('daily.heading', { label: puzzleTypeLabel('grecolatin'), date })} — Multilogic</title>
</svelte:head>

<main>
  <header>
    <a href="/daily">{t('nav.backDaily')}</a>
    <TimerView ms={store.elapsedMs} />
    <h1 class="page-title">{t('daily.heading', { label: puzzleTypeLabel('grecolatin'), date })}</h1>
  </header>

  {#if loading}
    <p>{t('play.generating')}</p>
  {:else if error}
    <p class="error" role="alert">{error}</p>
  {:else}
    {#if result.complete && result.valid}
      <SolvedBanner timeMs={store.elapsedMs} hints={store.hintsUsed} onshare={share} />
    {/if}
    <GrecoBoard {store} />
  {/if}
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
  .page-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 400;
  }
  .error {
    color: var(--danger);
  }
</style>
