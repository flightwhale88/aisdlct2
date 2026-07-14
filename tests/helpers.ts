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
  const titleInput = page.getByLabel('Todo title');
  const prioritySelect = page.getByLabel('Priority', { exact: true });
  const dueDateInput = page.getByLabel('Due date');
  const addButton = page.getByRole('button', { name: 'Add' });

  await expect(titleInput).toBeVisible();
  await titleInput.fill(input.title);
  await expect(titleInput).toHaveValue(input.title);

  await prioritySelect.selectOption(input.priority ?? 'medium');
  await dueDateInput.fill(input.dueDateLocal ?? '');

  await expect(addButton).toBeEnabled();
  await addButton.click();
}
