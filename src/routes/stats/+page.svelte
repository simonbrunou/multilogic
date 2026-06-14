<script lang="ts">
  import { onMount } from 'svelte';
  import { createStorage, type Stats } from '$lib/storage';
  import { difficultyLabel } from '$lib/i18n';
  const diffs = ['easy', 'medium', 'hard', 'expert'];
  let rows = $state<{ d: string; s: Stats }[]>([]);
  onMount(() => {
    const storage = createStorage(localStorage);
    rows = diffs.map((d) => ({ d, s: storage.getStats('sudoku', d) }));
  });
  function fmt(ms: number | null) { return ms === null ? '—' : `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`; }
</script>
<main>
  <header><a href="/">← Casse-têtes</a><h1>Statistiques</h1></header>
  <table>
    <thead><tr><th>Difficulté</th><th>Résolus</th><th>Meilleur temps</th></tr></thead>
    <tbody>{#each rows as r (r.d)}<tr><td>{difficultyLabel(r.d)}</td><td>{r.s.solved}</td><td>{fmt(r.s.bestMs)}</td></tr>{/each}</tbody>
  </table>
</main>
<style>main { max-width: 480px; margin: 40px auto; padding: 0 16px; font-family: system-ui, sans-serif; } table { width: 100%; border-collapse: collapse; } th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }</style>
