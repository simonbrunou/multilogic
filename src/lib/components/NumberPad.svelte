<script lang="ts">
  let { onenter, noteMode = false, maxDigit = 9, allowZero = false }: { onenter: (n: number) => void; noteMode?: boolean; maxDigit?: number; allowZero?: boolean } = $props();
  const digits = $derived(Array.from({ length: maxDigit }, (_, i) => i + 1));
  const keys = $derived(allowZero ? [...digits, 0] : digits);
  // Enough width for one row on roomy screens; on narrow phones the flex row wraps instead of
  // squeezing keys below the 44px touch-target floor.
  const maxw = $derived(keys.length * 58);
</script>
<div class="pad" class:note={noteMode} style="--maxw: {maxw}px;">
  {#each keys as n (n)}
    <button class="key" onclick={() => onenter(n)}>{n}</button>
  {/each}
</div>
<style>
  .pad { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin: 14px auto 0; width: min(92vw, var(--maxw)); }
  .pad.note .key { color: var(--text-muted); }
  .key { width: clamp(44px, 12vw, 52px); aspect-ratio: 1; min-height: 44px; padding: 0; font-size: clamp(16px, 5vw, 22px); border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--text); cursor: pointer; }
  .key:hover { background: var(--surface-3); }
</style>
