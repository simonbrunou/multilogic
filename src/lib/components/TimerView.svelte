<script lang="ts">
  import { t } from '$lib/i18n';
  let { ms }: { ms: number } = $props();
  const fmt = $derived.by(() => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
</script>
<!-- role="timer" carries an implicit aria-live="off", so the value is readable on demand
     without the once-a-second ticking spamming the screen reader. -->
<span class="timer" role="timer"><span class="sr-only">{t('aria.timer')} </span><span aria-hidden="true">⏱</span> {fmt}</span>
<style>.timer { font-variant-numeric: tabular-nums; color: var(--text-muted); }</style>
