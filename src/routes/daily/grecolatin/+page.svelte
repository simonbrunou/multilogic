<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { GrecoStore } from '$lib/play/greco.svelte';
  import { createPuzzleService, type Bundle } from '$lib/puzzle-service';
  import { createWorkerTransport } from '$lib/worker-transport';
  import { createStorage } from '$lib/storage';
  import { getModule } from '../../../engine/puzzles/registry';
  import { dailySeed, todayISO } from '$lib/daily';
  import { shareText, encodeShare, decodeShare } from '$lib/share';
  import GrecoBoard from '$lib/components/GrecoBoard.svelte';
  import TimerView from '$lib/components/TimerView.svelte';
  import type { Transport } from '$lib/puzzle-service';
  import type { GrecoLatinInstance } from '../../../engine/puzzles/grecolatin/types';
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
    if (!result.complete || !result.valid || !storage) return;
    const key = `grecolatin:daily:${Math.floor(store.elapsedMs / 250)}`;
    if (recordedSolves.has(key)) return;
    recordedSolves.add(key);
    storage.recordSolve('grecolatin', 'daily', store.elapsedMs);
  });

  onMount(async () => {
    date = resolveDate();
    loading = true;
    error = null;
    let bundle: Bundle | null = null;
    try { bundle = await (await fetch('/puzzles.bundle.json')).json(); } catch { bundle = null; }
    try {
      const transport = createWorkerTransport();
      currentTransport = transport;
      const svc = createPuzzleService(transport, { timeoutMs: 6000, bundle });
      const res = await svc.request('grecolatin', 'medium', dailySeed('grecolatin', date));
      const inst = getModule('grecolatin').deserializeInstance(res.instance) as GrecoLatinInstance;
      store.load(inst.n, inst.givens);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to generate puzzle';
    } finally {
      loading = false;
    }
  });

  onDestroy(() => { store.stopTimer(); currentTransport?.dispose?.(); });

  async function share() {
    const text = shareText({ type: 'grecolatin', date, timeMs: store.elapsedMs, hints: store.hintsUsed });
    const url = location.origin + '/daily/grecolatin' + encodeShare({ type: 'grecolatin', date });
    try { await navigator.clipboard.writeText(`${text}\n${url}`); } catch { /* clipboard unavailable */ }
  }
</script>

<main>
  <header>
    <a href="/daily">← Daily Puzzles</a>
    <TimerView ms={store.elapsedMs} />
    <span>Daily Greco-Latin · {date}</span>
  </header>

  {#if loading}
    <p>Generating…</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else}
    <GrecoBoard {store} />
    {#if result.complete && result.valid}
      <div class="win-area">
        <p class="win">Solved!</p>
        <button onclick={share}>Share result</button>
      </div>
    {/if}
  {/if}
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
  .win-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .win {
    color: #1b8f3a;
    font-weight: 700;
    margin: 0;
  }
  .error {
    color: #cc0000;
  }
</style>
