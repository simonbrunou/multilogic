<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
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
  import type { GrecoLatinInstance } from '../../../engine/puzzles/grecolatin/types';
  import { t, puzzleTypeLabel, locale } from '$lib/i18n';
  import { SvelteSet } from 'svelte/reactivity';

  const store = new GrecoStore();
  let loading = $state(true);
  let error = $state<string | null>(null);
  let date = $state(todayISO(new Date()));
  let currentTransport: Transport | null = null;
  const storage = typeof localStorage !== 'undefined' ? createStorage(localStorage) : null;
  // Tracks keys for which we already recorded a solve to prevent duplicate records.
  const recordedSolves = new SvelteSet<string>();

  function resolveDate(): string {
    if (typeof location !== 'undefined') {
      const decoded = decodeShare(location.hash);
      if (decoded && decoded.type === 'grecolatin') return decoded.date;
    }
    return todayISO(new Date());
  }

  const result = $derived(store.result);

  $effect(() => {
    if (!result.complete || !result.valid) return;
    store.stopTimer();
    if (!storage) return;
    const key = `grecolatin:daily:${Math.floor(store.elapsedMs / 250)}`;
    if (recordedSolves.has(key)) return;
    recordedSolves.add(key);
    storage.recordSolve('grecolatin', 'daily', store.elapsedMs);
  });

  onMount(async () => {
    date = resolveDate();
    loading = true;
    error = null;
    try {
      const res = await generateInstance('grecolatin', 'medium', dailySeed('grecolatin', date), {
        timeoutMs: 6000,
        onTransport: (t) => { currentTransport = t; }
      });
      const inst = getModule('grecolatin').deserializeInstance(res.instance) as GrecoLatinInstance;
      store.load(inst.n, inst.givens);
    } catch (e) {
      error = e instanceof Error ? e.message : t('play.genFailed');
    } finally {
      loading = false;
    }
  });

  onDestroy(() => { store.stopTimer(); currentTransport?.dispose?.(); });

  async function share() {
    const text = shareText({ type: 'grecolatin', date, timeMs: store.elapsedMs, hints: store.hintsUsed }, locale());
    const url = location.origin + '/daily/grecolatin' + encodeShare({ type: 'grecolatin', date });
    try { await navigator.clipboard.writeText(`${text}\n${url}`); } catch { /* clipboard unavailable */ }
  }
</script>

<main>
  <header>
    <a href="/daily">{t('nav.backDaily')}</a>
    <TimerView ms={store.elapsedMs} />
    <span>{t('daily.heading', { label: puzzleTypeLabel('grecolatin'), date })}</span>
  </header>

  {#if loading}
    <p>{t('play.generating')}</p>
  {:else if error}
    <p class="error">{error}</p>
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
  .error {
    color: var(--danger);
  }
</style>
