<script lang="ts">
  import { t } from '$lib/i18n';
  let { noteMode, onnote, onundo, onredo, onerase, onhint }:
    { noteMode: boolean; onnote: () => void; onundo: () => void; onredo: () => void; onerase: () => void; onhint: () => void } = $props();
</script>
<div class="toolbar">
  <button class:active={noteMode} onclick={onnote}>✏️ {t('toolbar.notes')}</button>
  <button onclick={onundo}>↶ {t('toolbar.undo')}</button>
  <button onclick={onredo}>↷ {t('toolbar.redo')}</button>
  <button onclick={onerase}>⌫ {t('toolbar.erase')}</button>
  <button onclick={onhint}>💡 {t('toolbar.hint')}</button>
</div>
<style>
  .toolbar { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 12px; }
  button { padding: 8px 12px; border: 1px solid #ccc; border-radius: 8px; background: #f4f5f7; cursor: pointer; font-size: 13px; }
  button.active { background: #cfe3ff; border-color: #7aa7ff; }
</style>
