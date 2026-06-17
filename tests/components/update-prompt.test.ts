import { expect, test, afterEach } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import UpdatePrompt from '../../src/lib/components/UpdatePrompt.svelte';

// Stub navigator.serviceWorker so we can drive the update lifecycle deterministically (the real
// container has no registered worker in the test page). Restored after each test.
function stubSW(sw: object) {
  Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
}
afterEach(() => {
  if (Object.getOwnPropertyDescriptor(navigator, 'serviceWorker')) {
    delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
  }
});

const noopReg = { waiting: null, installing: null, addEventListener() {}, update: async () => {} };
const container = (reg: object, controller: unknown = {}) =>
  ({ controller, ready: Promise.resolve(reg), addEventListener() {}, removeEventListener() {} });

test('renders nothing when no worker is waiting', async () => {
  stubSW(container(noopReg));
  render(UpdatePrompt);
  await new Promise((r) => setTimeout(r, 30)); // let ready.then settle without surfacing anything
  expect(page.getByRole('status').elements()).toHaveLength(0);
});

test('does not prompt on first install (no controller yet) even with a waiting worker', async () => {
  const worker = { postMessage() {}, state: 'installed' };
  stubSW(container({ ...noopReg, waiting: worker }, null)); // controller null ⇒ first install
  render(UpdatePrompt);
  await new Promise((r) => setTimeout(r, 30));
  expect(page.getByRole('status').elements()).toHaveLength(0);
});

test('shows the prompt for a waiting worker and posts SKIP_WAITING on accept', async () => {
  const posts: unknown[] = [];
  const worker = { postMessage: (m: unknown) => posts.push(m), state: 'installed' };
  stubSW(container({ ...noopReg, waiting: worker }));
  render(UpdatePrompt);
  await expect.element(page.getByRole('status')).toBeInTheDocument();
  await page.getByRole('button').click();
  expect(posts).toEqual([{ type: 'SKIP_WAITING' }]);
});
