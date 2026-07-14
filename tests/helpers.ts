import { expect, Page } from '@playwright/test';

export async function login(page: Page, username = 'e2e-user'): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL('/');
}

export async function createTodo(
  page: Page,
  input: { title: string; priority?: 'high' | 'medium' | 'low'; dueDateLocal?: string }
): Promise<void> {
  await page.getByLabel('Todo title').fill(input.title);

  if (input.priority) {
    await page.getByLabel('Priority', { exact: true }).selectOption(input.priority);
  }

  if (input.dueDateLocal) {
    await page.getByLabel('Due date').fill(input.dueDateLocal);
  }

  await page.getByRole('button', { name: 'Add' }).click();
}
