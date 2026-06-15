<script lang="ts">
  import { t } from '$lib/i18n';

  let {
    timeMs,
    hints = null,
    onnewgame = null,
    onshare = null
  }: {
    timeMs: number;
    hints?: number | null;
    onnewgame?: (() => void) | null;
    onshare?: (() => void | Promise<void>) | null;
  } = $props();

  const time = $derived.by(() => {
    const s = Math.floor(timeMs / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  let copied = $state(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  async function share() {
    await onshare?.();
    copied = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied = false), 2000);
  }
</script>

<!-- A live region so screen readers announce the win the moment it appears. -->
<section class="solved" role="status" aria-live="polite">
  <p class="title">{t('play.solved')} 🎉</p>
  <p class="time">{t('play.time', { time })}</p>
  {#if hints !== null}
    <p class="hints">{t('share.hints', { count: hints })}</p>
  {/if}
  {#if onnewgame || onshare}
    <div class="actions">
      {#if onnewgame}
        <button class="btn btn-primary" onclick={onnewgame}>{t('play.newGame')}</button>
      {/if}
      {#if onshare}
        <button class="btn" onclick={share}>{copied ? t('play.copied') : t('play.share')}</button>
      {/if}
    </div>
  {/if}
</section>

<style>
  .solved {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 16px 24px;
    border-radius: 14px;
    background: var(--success-bg);
    color: var(--success-contrast);
    text-align: center;
    animation: pop 0.32s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 800;
  }
  .time {
    margin: 0;
    font-variant-numeric: tabular-nums;
    font-size: 1rem;
    opacity: 0.92;
  }
  .hints {
    margin: 0;
    font-size: 0.8rem;
    opacity: 0.8;
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }
  /* Inside the banner the neutral button sits on a colored surface, so give it a readable skin. */
  .actions .btn {
    background: color-mix(in oklch, var(--success-contrast) 16%, transparent);
    border-color: color-mix(in oklch, var(--success-contrast) 40%, transparent);
    color: var(--success-contrast);
  }
  .actions .btn:hover {
    background: color-mix(in oklch, var(--success-contrast) 26%, transparent);
  }
  .actions .btn-primary {
    background: var(--success-contrast);
    border-color: var(--success-contrast);
    color: var(--success);
  }
  .actions .btn-primary:hover {
    background: color-mix(in oklch, var(--success-contrast) 88%, var(--success));
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
