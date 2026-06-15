<script lang="ts">
  import { t, puzzleTypeLabel } from '$lib/i18n';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';

  const puzzles = ['sudoku', 'tectonic', 'kakuro', 'grecolatin', 'yakuso'];
</script>

<main>
  <header class="hero">
    <h1>Multilogic</h1>
    <p class="tagline">{t('home.tagline')}</p>
  </header>

  <nav class="puzzles" aria-label={t('home.playHeading')}>
    {#each puzzles as p (p)}
      <a class="puzzle" href="/play/{p}">
        <span class="monogram" aria-hidden="true">{puzzleTypeLabel(p).charAt(0)}</span>
        <span class="text">
          <span class="name">{puzzleTypeLabel(p)}</span>
          <span class="desc">{t(`rules.${p}`)}</span>
        </span>
        <span class="chevron" aria-hidden="true">→</span>
      </a>
    {/each}
  </nav>

  <nav class="more" aria-label={t('home.more')}>
    <a href="/daily">{t('home.daily')}</a>
    <a href="/stats">{t('home.stats')}</a>
    <a href="/settings">{t('home.settings')}</a>
  </nav>

  <LanguageSwitcher />
</main>

<style>
  main {
    max-width: 520px;
    margin: 0 auto;
    padding: 40px 16px 56px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }
  .hero h1 {
    margin: 0;
    font-size: clamp(2rem, 9vw, 2.75rem);
    letter-spacing: -0.02em;
    color: var(--accent);
  }
  .tagline {
    margin: 6px 0 0;
    color: var(--text-muted);
    font-size: 1rem;
  }
  .puzzles {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .puzzle {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    transition:
      transform 0.15s ease,
      border-color 0.15s ease,
      background 0.15s ease;
  }
  .puzzle:hover {
    border-color: var(--accent);
    background: var(--surface-2);
    transform: translateY(-1px);
  }
  .monogram {
    flex: none;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: var(--selected-bg);
    color: var(--accent-strong);
    font-weight: 800;
    font-size: 1.1rem;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .name {
    font-weight: 700;
    font-size: 1.05rem;
  }
  .desc {
    color: var(--text-muted);
    font-size: 0.82rem;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .chevron {
    flex: none;
    margin-inline-start: auto;
    color: var(--text-muted);
    font-size: 1.1rem;
  }
  .more {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 20px;
    padding-top: 4px;
    border-top: 1px solid var(--border);
  }
  .more a {
    color: var(--accent);
    padding: 8px 0;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
</style>
