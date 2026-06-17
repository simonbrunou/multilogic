<script lang="ts">
  // "New version available — reload" prompt for the PWA. The service worker installs a new build
  // but waits (we never auto-skipWaiting, so a running session's hashed chunks are never swapped
  // underneath it). Here we surface a waiting worker, and only when the user accepts do we ask it
  // to take over and then reload onto the new version.
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';

  let waiting = $state<ServiceWorker | null>(null);
  let userAccepted = false;

  onMount(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    // The new worker activates (after we ask it to skip waiting) → load the new version. Guarded
    // so the first-install controllerchange (clients.claim on a fresh visit) never reloads.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (userAccepted) location.reload();
    });

    let reg: ServiceWorkerRegistration | undefined;
    // A worker counts as an update only when one already controls the page (else it's first install).
    const consider = (w: ServiceWorker | null) => {
      if (w && navigator.serviceWorker.controller) waiting = w;
    };

    navigator.serviceWorker.getRegistration().then(async (r) => {
      reg = r;
      if (!reg) return;
      consider(reg.waiting); // a build that finished installing while we were away
      reg.addEventListener('updatefound', () => {
        const nw = reg!.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed') consider(nw);
        });
      });
      try {
        await reg.update(); // check now (the browser otherwise only checks on navigation / ~daily)
        consider(reg.waiting);
      } catch {
        /* offline or transient — the navigation/visibility checks will catch it later */
      }
    });

    // Re-check when an installed app is brought back to the foreground.
    const onVisible = () => {
      if (document.visibilityState === 'visible') reg?.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });

  function reload() {
    userAccepted = true;
    waiting?.postMessage({ type: 'SKIP_WAITING' });
    // controllerchange (above) reloads once the new worker activates. Fallback in case it is
    // already controlling (e.g. the worker was already active by the time we posted).
    if (waiting?.state === 'activated' || !navigator.serviceWorker.controller) location.reload();
  }
</script>

{#if waiting}
  <div class="update" role="status" aria-live="polite">
    <span class="msg">{t('update.available')}</span>
    <button class="btn" onclick={reload}>{t('update.reload')}</button>
  </div>
{/if}

<style>
  .update {
    position: fixed;
    left: 50%;
    bottom: max(16px, env(safe-area-inset-bottom));
    transform: translateX(-50%);
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: min(92vw, 420px);
    padding: 10px 12px 10px 16px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text);
    box-shadow: 0 6px 20px oklch(0% 0 0 / 0.18);
    animation: rise 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .msg {
    font-size: 0.9rem;
  }
  .btn {
    flex: none;
    min-height: 36px;
    padding: 6px 14px;
    border: none;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-contrast);
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .btn:hover {
    background: var(--accent-strong);
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, 8px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .update {
      animation: none;
    }
  }
</style>
