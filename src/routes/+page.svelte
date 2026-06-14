<script lang="ts">
  import { t, puzzleTypeLabel } from '$lib/i18n';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
</script>

<main>
  <h1>Multilogic</h1>
  <p>{t('home.tagline')}</p>
  <ul>
    <li><a href="/play/sudoku">{puzzleTypeLabel('sudoku')}</a></li>
    <li><a href="/play/tectonic">{puzzleTypeLabel('tectonic')}</a></li>
    <li><a href="/play/kakuro">{puzzleTypeLabel('kakuro')}</a></li>
    <li><a href="/play/grecolatin">{puzzleTypeLabel('grecolatin')}</a></li>
    <li><a href="/daily">{t('home.daily')}</a></li>
    <li><a href="/stats">{t('home.stats')}</a></li>
    <li><a href="/settings">{t('home.settings')}</a></li>
  </ul>
  <LanguageSwitcher />
</main>
<style>main { max-width: 480px; margin: 40px auto; padding: 0 16px; font-family: system-ui, sans-serif; } a { color: #1b3a8f; }</style>
