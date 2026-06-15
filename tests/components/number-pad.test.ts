import { expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import NumberPad from '../../src/lib/components/NumberPad.svelte';

test('renders one key per digit up to maxDigit', async () => {
  render(NumberPad, { onenter: () => {}, maxDigit: 5 });
  await expect.element(page.getByRole('button', { name: '5' })).toBeInTheDocument();
  expect(page.getByRole('button').elements()).toHaveLength(5);
  expect(page.getByRole('button', { name: '6' }).elements()).toHaveLength(0);
});

test('emits the clicked digit via onenter', async () => {
  const onenter = vi.fn();
  render(NumberPad, { onenter, maxDigit: 9 });
  await page.getByRole('button', { name: '7' }).click();
  expect(onenter).toHaveBeenCalledWith(7);
});

test('applies the note class when noteMode is on', async () => {
  render(NumberPad, { onenter: () => {}, maxDigit: 9, noteMode: true });
  await expect.element(page.getByRole('button', { name: '1' })).toBeInTheDocument();
  expect(document.querySelector('.pad.note')).not.toBeNull();
});
