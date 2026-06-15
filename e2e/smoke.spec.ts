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

test('kakuro play page renders a grid and accepts input', async ({ page }) => {
  await page.goto('/play/kakuro');
  await expect(page.locator('.cell.white').first()).toBeVisible({ timeout: 30000 });
  const empty = page.locator('.cell.white').first();
  await empty.click();
  await page.keyboard.press('1');
  await expect(page.locator('.cell.white').filter({ hasText: /[1-9]/ }).first()).toBeVisible();
});

test('yakuso play page renders a grid and accepts input', async ({ page }) => {
  await page.goto('/play/yakuso');
  await expect(page.locator('.cell.input').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.cell.total').first()).toBeVisible(); // totals row shown
  const empty = page.locator('.cell.input').first();
  await empty.click();
  await page.keyboard.press('1');
  await expect(page.locator('.cell.input').filter({ hasText: /[1-9]/ }).first()).toBeVisible();
});

test('grecolatin play page renders a board', async ({ page }) => {
  await page.goto('/play/grecolatin');
  await expect(page.locator('.cell').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.cell')).toHaveCount(25); // default order 5 → 25 cells
});

test('daily hub lists all four daily puzzles', async ({ page }) => {
  await page.goto('/daily');
  await expect(page.getByRole('link', { name: /Sudoku/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Tectonic/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Kakuro/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Gréco-latin/ })).toBeVisible();
});

test('daily tectonic renders a grid', async ({ page }) => {
  await page.goto('/daily/tectonic');
  await expect(page.locator('.cell')).toHaveCount(25, { timeout: 30000 });
});

test('daily grecolatin renders a board', async ({ page }) => {
  await page.goto('/daily/grecolatin');
  await expect(page.locator('.cell').first()).toBeVisible({ timeout: 30000 });
});

test('grecolatin hint selects a suggested cell', async ({ page }) => {
  await page.goto('/play/grecolatin');
  await expect(page.locator('.cell').first()).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: /indice/i }).click();
  await expect(page.locator('.cell.selected')).toHaveCount(1);
});
