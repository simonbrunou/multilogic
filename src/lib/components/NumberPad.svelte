<script lang="ts">
  let { onenter, noteMode = false, maxDigit = 9, allowZero = false }: { onenter: (n: number) => void; noteMode?: boolean; maxDigit?: number; allowZero?: boolean } = $props();
  const digits = $derived(Array.from({ length: maxDigit }, (_, i) => i + 1));
  const keys = $derived(allowZero ? [...digits, 0] : digits);
  const cols = $derived(Math.min(keys.length, 9));
</script>
<div class="pad" class:note={noteMode} style="grid-template-columns: repeat({cols}, minmax(0, 1fr)); width: min(92vw, {cols * 52}px);">
  {#each keys as n (n)}
    <button class="key" onclick={() => onenter(n)}>{n}</button>
  {/each}
</div>
<style>
  .pad { display: grid; gap: 6px; margin-top: 14px; }
  .pad.note .key { color: var(--text-muted); }
  .key { aspect-ratio: 1; min-width: 0; min-height: 44px; padding: 0; font-size: clamp(16px, 5vw, 22px); border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--text); cursor: pointer; }
  .key:hover { background: var(--surface-3); }
</style>
