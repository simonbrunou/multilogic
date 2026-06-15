<script lang="ts">
  let { onenter, noteMode = false, maxDigit = 9, allowZero = false }: { onenter: (n: number) => void; noteMode?: boolean; maxDigit?: number; allowZero?: boolean } = $props();
  const digits = $derived(Array.from({ length: maxDigit }, (_, i) => i + 1));
  const keys = $derived(allowZero ? [...digits, 0] : digits);
  const cols = $derived(Math.min(keys.length, 9));
</script>
<div class="pad" class:note={noteMode} style="grid-template-columns: repeat({cols}, 1fr); width: min(92vw, {cols * 52}px);">
  {#each keys as n (n)}
    <button class="key" onclick={() => onenter(n)}>{n}</button>
  {/each}
</div>
<style>
  .pad { display: grid; gap: 6px; margin-top: 14px; }
  .pad.note .key { color: #888; }
  .key { aspect-ratio: 1; font-size: clamp(16px, 5vw, 22px); border: 1px solid #ccc; border-radius: 8px; background: #f4f5f7; cursor: pointer; }
</style>
