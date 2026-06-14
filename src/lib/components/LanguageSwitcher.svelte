<script lang="ts">
  import { locale, setLocale, localeNames, t, type Locale } from '$lib/i18n';

  const locales = Object.keys(localeNames) as Locale[];
</script>

<label class="lang">
  <span>{t('settings.language')}</span>
  <select value={locale()} onchange={(e) => setLocale(e.currentTarget.value as Locale)}>
    {#each locales as l (l)}
      <option value={l}>{localeNames[l]}</option>
    {/each}
  </select>
</label>

<style>
  .lang {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  select {
    padding: 4px 8px;
    border: 1px solid #ccc;
    border-radius: 6px;
    background: #f4f5f7;
    cursor: pointer;
    font: inherit;
  }
</style>
