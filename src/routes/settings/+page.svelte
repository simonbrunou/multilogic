<script lang="ts">
  import { onMount } from 'svelte';
  import { createStorage, type Settings } from '$lib/storage';
  import { t } from '$lib/i18n';
  import { setTheme } from '$lib/theme.svelte';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  let settings = $state<Settings>({ highlightErrors: true, autoNotes: false, theme: 'light' });
  let storage: ReturnType<typeof createStorage> | null = null;
  onMount(() => {
    storage = createStorage(localStorage);
    settings = storage.getSettings();
  });
  function save() { storage?.setSettings(settings); }
  function onTheme(e: Event) {
    settings.theme = (e.currentTarget as HTMLInputElement).checked ? 'dark' : 'light';
    setTheme(settings.theme);
    save();
  }
</script>
<main>
  <header><a href="/">{t('nav.backPuzzles')}</a><h1>{t('settings.title')}</h1></header>
  <label><input type="checkbox" checked={settings.theme === 'dark'} onchange={onTheme} /> {t('settings.darkMode')}</label>
  <label><input type="checkbox" bind:checked={settings.highlightErrors} onchange={save} /> {t('settings.highlightErrors')}</label>
  <label><input type="checkbox" bind:checked={settings.autoNotes} onchange={save} /> {t('settings.autoNotes')}</label>
  <LanguageSwitcher />
</main>
<style>main { max-width: 480px; margin: 40px auto; padding: 0 16px; display: flex; flex-direction: column; gap: 12px; } header { display: flex; align-items: center; gap: 16px; } header a { color: var(--accent); } label { display: flex; gap: 10px; align-items: center; min-height: 44px; } input { width: 20px; height: 20px; accent-color: var(--accent); }</style>
