<script lang="ts">
  import { onMount } from 'svelte';
  import { todayISO } from '$lib/daily';
  import { createStorage } from '$lib/storage';
  import { t, puzzleTypeLabel } from '$lib/i18n';

  const date = todayISO(new Date());
  const keys = ['sudoku', 'tectonic', 'kakuro', 'grecolatin', 'yakuso'];

  // Which of today's dailies are already finished (read from the saved board on the client).
  let done = $state<Record<string, boolean>>({});
  onMount(() => {
    const s = createStorage(localStorage);
    done = Object.fromEntries(
      keys.map((k) => [k, !!s.loadGame<{ solved: boolean }>(`daily:${k}:${date}`)?.solved])
    );
  });
</script>

<svelte:head>
  <title>{t('daily.title')} — Multilogic</title>
</svelte:head>

<main>
  <header>
    <a href="/">{t('nav.backPuzzles')}</a>
    <h1>{t('daily.title')}</h1>
  </header>
  <ul>
    {#each keys as key (key)}
      <li>
        <a href="/daily/{key}">
          <span>{t('daily.heading', { label: puzzleTypeLabel(key), date })}</span>
          {#if done[key]}<span class="done" aria-label={t('play.solved')}>✓</span>{/if}
        </a>
      </li>
    {/each}
  </ul>
</main>

<style>
  main {
    max-width: 480px;
    margin: 40px auto;
    padding: 0 16px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }
  h1 {
    margin: 0;
    font-size: 1.4rem;
  }
  a {
    color: var(--accent);
  }
  ul {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  li a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    background: var(--surface-2);
    color: var(--text);
  }
  li a:hover {
    background: var(--surface-3);
  }
  .done {
    flex: none;
    color: var(--success, var(--accent));
    font-weight: 800;
  }
</style>
