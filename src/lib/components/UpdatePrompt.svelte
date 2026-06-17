<script lang="ts">
  // "New version available — reload" prompt for the PWA. A new build installs but waits (the
  // service worker never auto-skipWaiting, so a running session's hashed chunks are never swapped
  // underneath it). This surfaces the waiting worker and, when the user accepts, asks it to take
  // over; once it controls the page we reload onto the new version.
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';

  let waiting = $state<ServiceWorker | null>(null);
  let accepting = $state(false);

  onMount(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const sw = navigator.serviceWorker;

    // A controller change on an already-controlled session means a new build has taken over —
    // either because the user accepted here, or accepted in another tab (skipWaiting + claim
    // controls every client). Reload so all tabs converge on the new version; in-progress puzzle
    // state is persisted and restored, so this is non-destructive. A first install (no prior
    // controller) must NOT reload — that controllerchange is just the initial claim.
    const hadController = !!sw.controller;
    const onControllerChange = () => { if (hadController) location.reload(); };
    sw.addEventListener('controllerchange', onControllerChange);

    let reg: ServiceWorkerRegistration | undefined;
    // Only surface an update once a worker already controls the page (else it's the first install).
    const consider = (w: ServiceWorker | null) => { if (w && sw.controller) waiting = w; };

    // The browser checks for a new worker on navigation / ~daily; we also nudge it on mount and on
    // refocus, throttled so a user flipping tabs doesn't spam the network with SW-script fetches.
    let lastCheck = 0;
    const check = () => {
      const now = Date.now();
      if (now - lastCheck < 30_000) return;
      lastCheck = now;
      reg?.update().catch(() => {});
    };

    // `ready` (not the one-shot getRegistration(), which can resolve undefined during startup
    // before SvelteKit's auto-registration lands) resolves with the active registration.
    sw.ready.then((r) => {
      reg = r;
      consider(r.waiting); // a build that finished installing while we were away
      r.addEventListener('updatefound', () => {
        const nw = r.installing;
        nw?.addEventListener('statechange', () => { if (nw.state === 'installed') consider(nw); });
      });
      check();
    });

    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      sw.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  });

  function accept() {
    accepting = true;
    waiting?.postMessage({ type: 'SKIP_WAITING' });
    // controllerchange reloads once the new worker activates; defensive fallback if the page is
    // somehow already uncontrolled.
    if (!navigator.serviceWorker.controller) location.reload();
  }
</script>

{#if waiting}
  <div class="update" role="status" aria-live="polite">
    <span class="msg">{t('update.available')}</span>
    <button class="btn" onclick={accept} disabled={accepting}>{t('update.reload')}</button>
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
  .btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .btn:not(:disabled):hover {
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
