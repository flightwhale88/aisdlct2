import { expect, test } from '@playwright/test';
import { createTodo, login } from './helpers';

test.describe('Todo CRUD (PRP 01)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, `crud-${Date.now()}`);
  });

  test('create todo with title only appears in Pending', async ({ page }) => {
    await createTodo(page, { title: 'Buy milk' });
    await expect(page.getByRole('heading', { name: /Pending \(1\)/ })).toBeVisible();
    await expect(page.getByText('Buy milk')).toBeVisible();
  });

  test('empty title is rejected client-side', async ({ page }) => {
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Title is required')).toBeVisible();
  });

  test('can edit and delete todo', async ({ page }) => {
    await createTodo(page, { title: 'Original task' });
    await page.getByRole('button', { name: 'Edit' }).first().click();

    await page.getByLabel('Edit title').fill('Updated task');
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByText('Updated task')).toBeVisible();

    await page.getByRole('button', { name: 'Delete' }).first().click();
    await expect(page.getByText('Updated task')).not.toBeVisible();
  });

  test('toggle complete moves todo to Completed', async ({ page }) => {
    await createTodo(page, { title: 'Finish report' });
    await page.getByLabel('Toggle Finish report').check();

    await expect(page.getByRole('heading', { name: /Completed \(1\)/ })).toBeVisible();
  });
});
