<script lang="ts">
  let { onenter, noteMode = false, maxDigit = 9 }: { onenter: (n: number) => void; noteMode?: boolean; maxDigit?: number } = $props();
  const digits = $derived(Array.from({ length: maxDigit }, (_, i) => i + 1));
</script>
<div class="pad" class:note={noteMode}>
  {#each digits as n (n)}
    <button class="key" onclick={() => onenter(n)}>{n}</button>
  {/each}
</div>
<style>
  .pad { display: grid; grid-template-columns: repeat(9, 1fr); gap: 6px; width: min(92vw, 480px); margin-top: 14px; }
  .pad.note .key { color: #888; }
  .key { aspect-ratio: 1; font-size: clamp(16px, 5vw, 22px); border: 1px solid #ccc; border-radius: 8px; background: #f4f5f7; cursor: pointer; }
  @media (max-width: 520px) { .pad { grid-template-columns: repeat(9, 1fr); } }
</style>
