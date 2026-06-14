<script lang="ts">
  import { todayISO } from '$lib/daily';
  import { t, puzzleTypeLabel } from '$lib/i18n';

  const date = todayISO(new Date());
  const keys = ['sudoku', 'tectonic', 'kakuro', 'grecolatin'];
</script>

<main>
  <header>
    <a href="/">{t('nav.backPuzzles')}</a>
    <h1>{t('daily.title')}</h1>
  </header>
  <ul>
    {#each keys as key (key)}
      <li>
        <a href="/daily/{key}">{t('daily.heading', { label: puzzleTypeLabel(key), date })}</a>
      </li>
    {/each}
  </ul>
</main>

<style>
  main {
    max-width: 480px;
    margin: 40px auto;
    padding: 0 16px;
    font-family: system-ui, sans-serif;
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
    color: #1b3a8f;
  }
  ul {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  li a {
    display: block;
    padding: 10px 14px;
    border: 1px solid #ddd;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    background: #f4f5f7;
  }
  li a:hover {
    background: #e8eaf0;
  }
</style>
