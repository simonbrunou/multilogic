import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import UpdatePrompt from '../../src/lib/components/UpdatePrompt.svelte';

// Safe default: with no waiting service worker (no update pending — the case for ~every page
// view), the prompt renders nothing. Guards against the toast showing spuriously, e.g. on a
// first install where `navigator.serviceWorker.controller` is still null.
test('renders nothing when there is no pending update', async () => {
  render(UpdatePrompt);
  // give onMount's async getRegistration()/update() a chance to (not) surface a worker
  await new Promise((r) => setTimeout(r, 50));
  expect(page.getByRole('status').elements()).toHaveLength(0);
});
