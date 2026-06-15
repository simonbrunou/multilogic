import type { HandleClientError } from '@sveltejs/kit';

// Central client-side error capture. SvelteKit calls this for uncaught errors during
// navigation, `load`, and rendering. Today it logs to the console; this is the single
// place to forward to a reporter (e.g. GlitchTip / Sentry `captureException`) later
// without touching any call sites. Component render errors are caught separately by the
// top-level <svelte:boundary> in +layout.svelte.
export const handleError: HandleClientError = ({ error, event, status, message }) => {
  console.error('[multilogic] client error', {
    status,
    message,
    path: event.url?.pathname,
    error
  });
};
