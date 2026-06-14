<script lang="ts">
  import { onMount } from 'svelte';
  import { createStorage, type Settings } from '$lib/storage';
  let settings = $state<Settings>({ highlightErrors: true, autoNotes: false, theme: 'light' });
  let storage: ReturnType<typeof createStorage> | null = null;
  onMount(() => {
    storage = createStorage(localStorage);
    settings = storage.getSettings();
  });
  function save() { storage?.setSettings(settings); }
</script>
<main>
  <header><a href="/">← Casse-têtes</a><h1>Paramètres</h1></header>
  <label><input type="checkbox" bind:checked={settings.highlightErrors} onchange={save} /> Surligner les erreurs</label>
  <label><input type="checkbox" bind:checked={settings.autoNotes} onchange={save} /> Notes automatiques</label>
</main>
<style>main { max-width: 480px; margin: 40px auto; padding: 0 16px; font-family: system-ui, sans-serif; display: flex; flex-direction: column; gap: 12px; } label { display: flex; gap: 8px; align-items: center; }</style>
