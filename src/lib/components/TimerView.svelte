<script lang="ts">
  let { ms }: { ms: number } = $props();
  const fmt = $derived.by(() => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
</script>
<span class="timer">⏱ {fmt}</span>
<style>.timer { font-variant-numeric: tabular-nums; color: #555; }</style>
