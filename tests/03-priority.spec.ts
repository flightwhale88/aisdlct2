import { expect, test } from '@playwright/test';
import { createTodo, login } from './helpers';

test.describe('Priority system (PRP 02)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, `priority-${Date.now()}`);
  });

  test('create todos with priority badges and ordering High -> Medium -> Low', async ({ page }) => {
    const dueDate = '2099-12-31T10:00';

    await createTodo(page, { title: 'Low item', priority: 'low', dueDateLocal: dueDate });
    await createTodo(page, { title: 'Medium item', priority: 'medium', dueDateLocal: dueDate });
    await createTodo(page, { title: 'High item', priority: 'high', dueDateLocal: dueDate });

    await expect(page.locator('li', { hasText: 'High item' }).getByText('High', { exact: true })).toBeVisible();
    await expect(
      page.locator('li', { hasText: 'Medium item' }).getByText('Medium', { exact: true })
    ).toBeVisible();
    await expect(page.locator('li', { hasText: 'Low item' }).getByText('Low', { exact: true })).toBeVisible();

    const pendingSection = page.locator('section', {
      has: page.getByRole('heading', { name: /Pending/ }),
    });
    const titles = await pendingSection.locator('li p:first-child').allTextContents();

    expect(titles[0]).toContain('High item');
    expect(titles[1]).toContain('Medium item');
    expect(titles[2]).toContain('Low item');
  });

  test('editing Low to High re-sorts within section', async ({ page }) => {
    const dueDate = '2099-12-31T10:00';

    await createTodo(page, { title: 'Medium baseline', priority: 'medium', dueDateLocal: dueDate });
    await createTodo(page, { title: 'Low to promote', priority: 'low', dueDateLocal: dueDate });

    const targetItem = page.locator('li', { hasText: 'Low to promote' });
    await targetItem.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Edit priority').selectOption('high');
    await page.getByRole('button', { name: 'Update' }).click();

    const pendingSection = page.locator('section', {
      has: page.getByRole('heading', { name: /Pending/ }),
    });

    await expect
      .poll(async () => pendingSection.locator('li p:first-child').allTextContents())
      .toEqual(expect.arrayContaining(['Low to promote', 'Medium baseline']));

    const titles = await pendingSection.locator('li p:first-child').allTextContents();
    expect(titles[0]).toContain('Low to promote');
  });

  test('priority defaults to Medium when omitted', async ({ page }) => {
    await createTodo(page, { title: 'No priority set' });
    await expect(
      page.locator('li', { hasText: 'No priority set' }).getByText('Medium', { exact: true })
    ).toBeVisible();
  });

  test('priority filter shows only matching todos', async ({ page }) => {
    await createTodo(page, { title: 'Only high', priority: 'high' });
    await createTodo(page, { title: 'Only low', priority: 'low' });

    await page.getByLabel('Priority filter').selectOption('high');

    await expect(page.getByText('Only high')).toBeVisible();
    await expect(page.getByText('Only low')).not.toBeVisible();

    await page.getByLabel('Priority filter').selectOption('all');

    await expect(page.getByText('Only high')).toBeVisible();
    await expect(page.getByText('Only low')).toBeVisible();
  });

  test('invalid priority is rejected by API', async ({ page, request }) => {
    await page.goto('/');
    const response = await request.post('/api/todos', {
      data: {
        title: 'Bad priority',
        priority: 'urgent',
      },
      headers: {
        Cookie: (await page.context().cookies())
          .map((cookie) => `${cookie.name}=${cookie.value}`)
          .join('; '),
      },
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('Invalid priority: urgent');
  });
});
