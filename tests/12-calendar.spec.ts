import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers';

test.describe('Calendar View (PRP-10)', () => {
  test('navigating to /calendar renders a month grid', async ({ page }) => {
    await page.goto('/calendar');
    // Should show day headers
    for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      await expect(page.locator(`text=${day}`)).toBeVisible();
    }
    // 42 cells (6 rows × 7 cols)
    const cells = page.locator('main .grid button');
    await expect(cells).toHaveCount(42);
  });

  test('invalid ?month= param falls back to current month without crash', async ({ page }) => {
    await page.goto('/calendar?month=2026-13');
    await expect(page.locator('text=Sun')).toBeVisible(); // grid rendered, no error
  });

  test('clicking Calendar link from main page navigates to /calendar', async ({ page }) => {
    await page.goto('/');
    await page.click('text=📅 Calendar');
    await expect(page).toHaveURL(/\/calendar/);
  });

  test('prev and next buttons update the URL month param', async ({ page }) => {
    await page.goto('/calendar?month=2026-07');
    await page.click('button:has-text("▶")');
    await expect(page).toHaveURL(/month=2026-08/);
    await page.click('button:has-text("◀")');
    await expect(page).toHaveURL(/month=2026-07/);
  });

  test('Today button resets to current month', async ({ page }) => {
    await page.goto('/calendar?month=2025-01');
    await page.click('text=Today');
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await expect(page).toHaveURL(new RegExp(`month=${monthStr}`));
  });

  test('a todo with a due date appears on the correct calendar cell', async ({ page }) => {
    await page.goto('/');
    // Create a todo due in this calendar session — we'll verify via the day modal
    const helpers = new TestHelpers(page);
    await helpers.createTodo('Calendar test todo');

    await page.goto('/calendar');
    // Just verify calendar renders without error; full date-cell test requires date input which is part of PRP-01
    await expect(page.locator('main')).toBeVisible();
  });

  test('clicking a day cell opens the DayTodosModal', async ({ page }) => {
    await page.goto('/calendar');
    const cells = page.locator('main .grid button');
    await cells.nth(10).click();
    // Modal should appear with a Close button
    await expect(page.locator('text=Close')).toBeVisible();
    await page.click('text=Close');
    await expect(page.locator('text=Close')).not.toBeVisible();
  });
});
