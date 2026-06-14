import { test, expect } from '@playwright/test';

test('home lists Sudoku and play page renders a grid', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Sudoku', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tectonic', exact: true })).toBeVisible();

  await page.goto('/play/sudoku');
  await expect(page.locator('.cell')).toHaveCount(81, { timeout: 30000 });

  const emptyCell = page.locator('.cell:not(.given)').first();
  await emptyCell.click();
  await page.keyboard.press('1');
  await expect(page.locator('.cell:not(.given)').filter({ hasText: /[1-9]/ }).first()).toBeVisible();
});

test('tectonic play page renders a grid and accepts input', async ({ page }) => {
  await page.goto('/play/tectonic');
  await expect(page.locator('.cell')).toHaveCount(25, { timeout: 30000 }); // default 5x5
  const empty = page.locator('.cell:not(.given)').first();
  await empty.click();
  await page.keyboard.press('1');
  await expect(page.locator('.cell:not(.given)').filter({ hasText: /[1-9]/ }).first()).toBeVisible();
});
