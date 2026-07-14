import { expect, test } from '@playwright/test';
import { createTodo, login } from './helpers';

test.describe('Search and filtering (PRP 08)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, `search-${Date.now()}`);
  });

  test('search by title is case insensitive', async ({ page }) => {
    await createTodo(page, { title: 'Team Meeting Notes', priority: 'high' });
    await createTodo(page, { title: 'Buy apples', priority: 'low' });

    await page.getByPlaceholder('Search todos and subtasks...').fill('meeting');
    await expect(page.getByText('Team Meeting Notes')).toBeVisible();
    await expect(page.getByText('Buy apples')).not.toBeVisible();

    await page.getByLabel('Clear search').click();
    await expect(page.getByText('Buy apples')).toBeVisible();
  });

  test('combines priority and completion filters', async ({ page }) => {
    await createTodo(page, { title: 'High active', priority: 'high' });
    await createTodo(page, { title: 'Low active', priority: 'low' });

    await page.getByLabel('Toggle High active').check();

    await page.getByLabel('Priority filter').selectOption('high');
    await page.getByRole('button', { name: '▶ Advanced' }).click();
    await page.getByLabel('Completion status').selectOption('completed');

    await expect(page.getByText('High active')).toBeVisible();
    await expect(page.getByText('Low active')).not.toBeVisible();
  });
});
