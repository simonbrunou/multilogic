<script lang="ts">
  import { todayISO } from '$lib/daily';
  import { PLAY_UI } from '$lib/play/registry';

  const date = todayISO(new Date());

  const DAILY_TYPES = [
    { key: 'sudoku',     label: PLAY_UI['sudoku']?.label    ?? 'Sudoku'      },
    { key: 'tectonic',  label: PLAY_UI['tectonic']?.label  ?? 'Tectonic'    },
    { key: 'kakuro',    label: PLAY_UI['kakuro']?.label     ?? 'Kakuro'      },
    { key: 'grecolatin', label: 'Gréco-latin' }
  ];
</script>

<main>
  <header>
    <a href="/">← Casse-têtes</a>
    <h1>Défis du jour</h1>
  </header>
  <ul>
    {#each DAILY_TYPES as { key, label } (key)}
      <li>
        <a href="/daily/{key}">{label} du jour · {date}</a>
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
