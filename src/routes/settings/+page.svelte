<script lang="ts">
  import { onMount } from 'svelte';
  import { createStorage, type Settings } from '$lib/storage';
  import { t } from '$lib/i18n';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  let settings = $state<Settings>({ highlightErrors: true, autoNotes: false, theme: 'light' });
  let storage: ReturnType<typeof createStorage> | null = null;
  onMount(() => {
    storage = createStorage(localStorage);
    settings = storage.getSettings();
  });
  function save() { storage?.setSettings(settings); }
</script>
<main>
  <header><a href="/">{t('nav.backPuzzles')}</a><h1>{t('settings.title')}</h1></header>
  <label><input type="checkbox" bind:checked={settings.highlightErrors} onchange={save} /> {t('settings.highlightErrors')}</label>
  <label><input type="checkbox" bind:checked={settings.autoNotes} onchange={save} /> {t('settings.autoNotes')}</label>
  <LanguageSwitcher />
</main>
<style>main { max-width: 480px; margin: 40px auto; padding: 0 16px; font-family: system-ui, sans-serif; display: flex; flex-direction: column; gap: 12px; } label { display: flex; gap: 8px; align-items: center; }</style>
