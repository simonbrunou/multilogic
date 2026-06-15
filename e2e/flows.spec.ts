import { test, expect } from '@playwright/test';

// The Playwright config pins locale to fr-FR, so the app starts in French unless the user
// has overridden it (persisted in localStorage).

test('language choice persists across a reload', async ({ page }) => {
  await page.goto('/settings');
  // Starts French.
  await expect(page.getByRole('heading', { name: 'Paramètres' })).toBeVisible();

  await page.locator('select').selectOption('en');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.reload();
  // The persisted English locale should survive the reload (no flash back to French).
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

test('a shared daily link lands on the shared date', async ({ page }) => {
  await page.goto('/daily/sudoku#sudoku:2024-01-01');
  await expect(page.locator('.cell')).toHaveCount(81, { timeout: 30000 });
  // resolveDate() decodes the hash, so the heading shows the shared date, not today.
  await expect(page.getByText('2024-01-01')).toBeVisible();
});

test('undo and redo round-trip a digit entry', async ({ page }) => {
  await page.goto('/play/sudoku');
  await expect(page.locator('.cell')).toHaveCount(81, { timeout: 30000 });

  const cell = page.locator('.cell:not(.given)').first();
  await cell.click();
  await page.keyboard.press('1');
  await expect(cell).toHaveText('1');

  await page.getByRole('button', { name: /annuler/i }).click();
  await expect(cell).toHaveText('');

  await page.getByRole('button', { name: /rétablir/i }).click();
  await expect(cell).toHaveText('1');
});
