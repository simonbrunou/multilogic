<script lang="ts">
  import { t } from '$lib/i18n';
  let { noteMode, onnote, onundo, onredo, onerase, onhint }:
    { noteMode: boolean; onnote: () => void; onundo: () => void; onredo: () => void; onerase: () => void; onhint: () => void } = $props();
</script>
<div class="toolbar">
  <button class="btn" class:is-active={noteMode} aria-pressed={noteMode} onclick={onnote}><span aria-hidden="true">✏️</span> {t('toolbar.notes')}</button>
  <button class="btn" onclick={onundo}><span aria-hidden="true">↶</span> {t('toolbar.undo')}</button>
  <button class="btn" onclick={onredo}><span aria-hidden="true">↷</span> {t('toolbar.redo')}</button>
  <button class="btn" onclick={onerase}><span aria-hidden="true">⌫</span> {t('toolbar.erase')}</button>
  <button class="btn" onclick={onhint}><span aria-hidden="true">💡</span> {t('toolbar.hint')}</button>
</div>
<style>
  .toolbar { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 12px; }
</style>
