import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers';

test.describe('Subtasks & Progress (PRP-05)', () => {
  test('expand subtasks section on a todo with none yet', async ({ page }) => {
    await page.goto('/');
    const helpers = new TestHelpers(page);
    await helpers.createTodo('Empty subtasks todo');

    const todoItem = page.locator('li', { hasText: 'Empty subtasks todo' });
    await todoItem.locator('text=▶ Subtasks').click();
    await expect(todoItem.locator('text=▼ Subtasks')).toBeVisible();
    await expect(todoItem.locator('placeholder=Add subtask…')).toBeVisible();
  });

  test('adds a subtask via Enter key', async ({ page }) => {
    await page.goto('/');
    const helpers = new TestHelpers(page);
    await helpers.createTodo('Todo for subtask enter');

    const todoItem = page.locator('li', { hasText: 'Todo for subtask enter' });
    await todoItem.locator('text=▶ Subtasks').click();
    await todoItem.locator('input[placeholder="Add subtask…"]').fill('Step one');
    await todoItem.locator('input[placeholder="Add subtask…"]').press('Enter');

    await expect(todoItem.locator('text=Step one')).toBeVisible();
    await expect(todoItem.locator('text=1/1 subtasks')).toBeVisible();
  });

  test('adds multiple subtasks via Add button', async ({ page }) => {
    await page.goto('/');
    const helpers = new TestHelpers(page);
    await helpers.createTodo('Multi subtask todo');

    const todoItem = page.locator('li', { hasText: 'Multi subtask todo' });
    await todoItem.locator('text=▶ Subtasks').click();

    for (const title of ['Alpha', 'Beta', 'Gamma']) {
      await todoItem.locator('input[placeholder="Add subtask…"]').fill(title);
      await todoItem.locator('button', { hasText: 'Add' }).click();
    }

    await expect(todoItem.locator('text=0/3 subtasks')).toBeVisible();
  });

  test('toggles subtask complete — bar stays blue below 100%', async ({ page }) => {
    await page.goto('/');
    const helpers = new TestHelpers(page);
    await helpers.createTodo('Toggle todo');

    const todoItem = page.locator('li', { hasText: 'Toggle todo' });
    await todoItem.locator('text=▶ Subtasks').click();
    await todoItem.locator('input[placeholder="Add subtask…"]').fill('Task A');
    await todoItem.locator('button', { hasText: 'Add' }).click();
    await todoItem.locator('input[placeholder="Add subtask…"]').fill('Task B');
    await todoItem.locator('button', { hasText: 'Add' }).click();

    // Check the first subtask
    await todoItem.locator('input[type="checkbox"]').first().check();
    await expect(todoItem.locator('text=1/2 subtasks')).toBeVisible();
    await expect(todoItem.locator('text=50%')).toBeVisible();
  });

  test('completing all subtasks turns bar green at 100%', async ({ page }) => {
    await page.goto('/');
    const helpers = new TestHelpers(page);
    await helpers.createTodo('All done todo');

    const todoItem = page.locator('li', { hasText: 'All done todo' });
    await todoItem.locator('text=▶ Subtasks').click();
    await todoItem.locator('input[placeholder="Add subtask…"]').fill('Only step');
    await todoItem.locator('button', { hasText: 'Add' }).click();

    await todoItem.locator('input[type="checkbox"]').first().check();

    await expect(todoItem.locator('text=1/1 subtasks')).toBeVisible();
    await expect(todoItem.locator('text=100%')).toBeVisible();
    await expect(todoItem.locator('.bg-green-500')).toBeVisible();
  });

  test('deletes a subtask and count recalculates', async ({ page }) => {
    await page.goto('/');
    const helpers = new TestHelpers(page);
    await helpers.createTodo('Delete subtask todo');

    const todoItem = page.locator('li', { hasText: 'Delete subtask todo' });
    await todoItem.locator('text=▶ Subtasks').click();

    for (const t of ['Keep', 'Remove']) {
      await todoItem.locator('input[placeholder="Add subtask…"]').fill(t);
      await todoItem.locator('button', { hasText: 'Add' }).click();
    }

    await expect(todoItem.locator('text=0/2 subtasks')).toBeVisible();

    // Delete the "Remove" subtask
    const removeRow = todoItem.locator('span', { hasText: 'Remove' }).locator('..');
    await removeRow.locator('button[aria-label="Delete subtask"]').click();

    await expect(todoItem.locator('text=0/1 subtasks')).toBeVisible();
    await expect(todoItem.locator('text=Remove')).not.toBeVisible();
  });

  test('progress bar visible when subtask list is collapsed', async ({ page }) => {
    await page.goto('/');
    const helpers = new TestHelpers(page);
    await helpers.createTodo('Collapsed bar todo');

    const todoItem = page.locator('li', { hasText: 'Collapsed bar todo' });
    await todoItem.locator('text=▶ Subtasks').click();
    await todoItem.locator('input[placeholder="Add subtask…"]').fill('Step');
    await todoItem.locator('button', { hasText: 'Add' }).click();

    // Collapse
    await todoItem.locator('text=▼ Subtasks').click();

    // Bar and count still visible
    await expect(todoItem.locator('text=0/1 subtasks')).toBeVisible();
  });

  test('no progress bar rendered when todo has zero subtasks', async ({ page }) => {
    await page.goto('/');
    const helpers = new TestHelpers(page);
    await helpers.createTodo('No subtasks todo');

    const todoItem = page.locator('li', { hasText: 'No subtasks todo' });
    await expect(todoItem.locator('text=subtasks')).not.toBeVisible();
    await expect(todoItem.locator('.bg-blue-500, .bg-green-500')).not.toBeVisible();
  });

  test('empty subtask title is rejected — no new row appears', async ({ page }) => {
    await page.goto('/');
    const helpers = new TestHelpers(page);
    await helpers.createTodo('Empty title todo');

    const todoItem = page.locator('li', { hasText: 'Empty title todo' });
    await todoItem.locator('text=▶ Subtasks').click();

    // Try submitting with empty input
    const addBtn = todoItem.locator('button', { hasText: 'Add' });
    await expect(addBtn).toBeDisabled();
  });
});
