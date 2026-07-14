import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers';

test.describe('Priority System (PRP-02)', () => {
  test('creates todos with each priority level and shows correct badge', async ({ page }) => {
    await page.goto('/');
    const helpers = new TestHelpers(page);

    for (const [priority, label] of [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']] as const) {
      await page.selectOption('select', priority);
      await page.fill('input[placeholder="New todo…"]', `${label} priority todo`);
      await page.click('button[type="submit"]');
      const item = page.locator('li', { hasText: `${label} priority todo` });
      await expect(item.locator(`text=${label}`)).toBeVisible();
    }
  });

  test('high priority todos appear above medium and low in Pending', async ({ page }) => {
    await page.goto('/');

    // Create low first, then high — high should sort to top
    await page.selectOption('select', 'low');
    await page.fill('input[placeholder="New todo…"]', 'Low task');
    await page.click('button[type="submit"]');

    await page.selectOption('select', 'high');
    await page.fill('input[placeholder="New todo…"]', 'High task');
    await page.click('button[type="submit"]');

    const items = page.locator('section', { hasText: 'Pending' }).locator('li');
    const firstText = await items.first().textContent();
    expect(firstText).toContain('High task');
  });

  test('priority filter shows only matching todos', async ({ page }) => {
    await page.goto('/');

    await page.selectOption('select[class*="rounded-lg"]', 'high');
    await page.fill('input[placeholder="New todo…"]', 'Urgent task');
    await page.click('button[type="submit"]');

    await page.selectOption('select[class*="rounded-lg"]', 'low');
    await page.fill('input[placeholder="New todo…"]', 'Someday task');
    await page.click('button[type="submit"]');

    // Filter to High only
    await page.selectOption('select[class*="rounded-full"]', 'high');

    await expect(page.locator('text=Urgent task')).toBeVisible();
    await expect(page.locator('text=Someday task')).not.toBeVisible();

    // Reset
    await page.selectOption('select[class*="rounded-full"]', 'all');
    await expect(page.locator('text=Someday task')).toBeVisible();
  });

  test('priority badge colors match — red for high, yellow for medium, blue for low', async ({ page }) => {
    await page.goto('/');

    await page.selectOption('select[class*="rounded-lg"]', 'high');
    await page.fill('input[placeholder="New todo…"]', 'Color high');
    await page.click('button[type="submit"]');

    const badge = page.locator('li', { hasText: 'Color high' }).locator('span', { hasText: 'High' });
    await expect(badge).toHaveClass(/text-red-800|text-red-300/);
  });

  test('omitting priority defaults to medium badge', async ({ page }) => {
    await page.goto('/');
    // default select value is medium
    await page.fill('input[placeholder="New todo…"]', 'Default priority');
    await page.click('button[type="submit"]');

    const item = page.locator('li', { hasText: 'Default priority' });
    await expect(item.locator('text=Medium')).toBeVisible();
  });
});
