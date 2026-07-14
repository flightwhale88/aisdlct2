import { test, expect, Page, BrowserContext } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createTag(
  page: Page,
  name: string,
  color = '#3B82F6',
): Promise<void> {
  await page.click('text=+ Manage Tags');
  await page.fill('input[placeholder="Tag name"]', name);
  // Set the hex input to the desired color
  await page.fill('input[placeholder="#3B82F6"]', color);
  await page.click('text=Create');
  // Wait for tag to appear in the list
  await expect(page.locator(`text=${name}`).first()).toBeVisible();
}

async function closeModal(page: Page): Promise<void> {
  await page.click('text=Close');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Tag System', () => {
  // Note: In a full app these tests would authenticate first via WebAuthn.
  // For the tag feature tests we rely on the app being already authenticated.
  // The virtual authenticator setup is in playwright.config.ts.

  test('creates a tag via the Manage Tags modal', async ({ page }) => {
    await page.goto('/');

    await createTag(page, 'Work', '#EF4444');

    // Tag should appear in the pill selector below the form
    await closeModal(page);
    await expect(page.locator('button', { hasText: 'Work' }).first()).toBeVisible();
  });

  test('shows a clear error when creating a duplicate tag name', async ({ page }) => {
    await page.goto('/');
    await createTag(page, 'DupeTest');

    // Try creating the same name again
    await page.fill('input[placeholder="Tag name"]', 'DupeTest');
    await page.click('text=Create');

    await expect(page.locator('text=A tag with this name already exists')).toBeVisible();
    await closeModal(page);
  });

  test('edits a tag name and color', async ({ page }) => {
    await page.goto('/');
    await createTag(page, 'EditMe', '#3B82F6');

    // Click Edit on that tag
    const editButton = page.locator('li', { hasText: 'EditMe' }).locator('text=Edit');
    await editButton.click();

    const nameInput = page.locator('li', { hasText: 'EditMe' }).locator('input[type="text"]').first();
    await nameInput.fill('Edited');
    await page.locator('li', { hasText: 'Edited' }).locator('text=Save').click();

    await expect(page.locator('text=Edited').first()).toBeVisible();
    await closeModal(page);
  });

  test('deletes a tag and it disappears from all todos', async ({ page }) => {
    await page.goto('/');
    await createTag(page, 'ToDelete');
    await closeModal(page);

    // Create a todo with that tag attached
    await page.click('button', { hasText: 'ToDelete' }); // select the tag pill
    await page.fill('input[placeholder="New todo…"]', 'Todo with tag');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Todo with tag')).toBeVisible();

    // Now delete the tag
    await page.click('text=+ Manage Tags');
    page.on('dialog', (d) => d.accept()); // auto-confirm the delete dialog
    await page.locator('li', { hasText: 'ToDelete' }).locator('text=Delete').click();
    await expect(page.locator('text=ToDelete')).not.toBeVisible();
    await closeModal(page);

    // The todo should still exist but with no tag pills
    await expect(page.locator('text=Todo with tag')).toBeVisible();
  });

  test('assigns two tags to one todo and both pills render on the card', async ({ page }) => {
    await page.goto('/');
    await createTag(page, 'TagA', '#10B981');
    await closeModal(page);
    await page.click('text=+ Manage Tags');
    await createTag(page, 'TagB', '#F59E0B');
    await closeModal(page);

    // Select both tags
    await page.click('button', { hasText: 'TagA' });
    await page.click('button', { hasText: 'TagB' });

    await page.fill('input[placeholder="New todo…"]', 'Multi-tagged todo');
    await page.click('button[type="submit"]');

    const todoItem = page.locator('li', { hasText: 'Multi-tagged todo' });
    await expect(todoItem.locator('text=TagA')).toBeVisible();
    await expect(todoItem.locator('text=TagB')).toBeVisible();
  });

  test('filters the todo list by tag and clears with All Tags', async ({ page }) => {
    await page.goto('/');
    await createTag(page, 'FilterTag', '#8B5CF6');
    await closeModal(page);

    // Create a tagged todo and an untagged todo
    await page.click('button', { hasText: 'FilterTag' });
    await page.fill('input[placeholder="New todo…"]', 'Tagged task');
    await page.click('button[type="submit"]');

    await page.fill('input[placeholder="New todo…"]', 'Untagged task');
    await page.click('button[type="submit"]');

    // Filter by FilterTag
    const filterPill = page.locator('section, div').filter({ hasText: 'Filter:' }).locator('button', { hasText: 'FilterTag' });
    await filterPill.click();

    await expect(page.locator('text=Tagged task')).toBeVisible();
    await expect(page.locator('text=Untagged task')).not.toBeVisible();

    // Clear filter
    await page.click('button', { hasText: 'All Tags' });
    await expect(page.locator('text=Untagged task')).toBeVisible();
  });

  test('clicking a tag pill on a todo card applies that tag as active filter', async ({
    page,
  }) => {
    await page.goto('/');
    await createTag(page, 'CardFilter', '#EC4899');
    await closeModal(page);

    await page.click('button', { hasText: 'CardFilter' });
    await page.fill('input[placeholder="New todo…"]', 'Filterable todo');
    await page.click('button[type="submit"]');

    await page.fill('input[placeholder="New todo…"]', 'Other todo');
    await page.click('button[type="submit"]');

    // Click the tag pill directly on the todo card
    const todoCard = page.locator('li', { hasText: 'Filterable todo' });
    await todoCard.locator('button', { hasText: 'CardFilter' }).click();

    await expect(page.locator('text=Filterable todo')).toBeVisible();
    await expect(page.locator('text=Other todo')).not.toBeVisible();
  });
});
