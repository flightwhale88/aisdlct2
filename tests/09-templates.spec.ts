import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers';

test.describe('Template System (PRP-07)', () => {
  test('saves a todo as a template and it appears in the dropdown', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="New todo…"]', 'Weekly Review');
    await page.click('text=💾 Save as Template');

    await page.fill('input[placeholder="Template name *"]', 'Weekly Review Template');
    await page.fill('input[placeholder="Category: Work, Personal, Finance…"]', 'Work');
    await page.click('text=Save Template');

    // Dropdown should now contain the template
    await expect(page.locator('select option', { hasText: 'Weekly Review Template (Work)' })).toBeAttached();
  });

  test('uses a template to create a todo instantly', async ({ page }) => {
    await page.goto('/');

    // First create a template
    await page.fill('input[placeholder="New todo…"]', 'Daily Standup');
    await page.click('text=💾 Save as Template');
    await page.fill('input[placeholder="Template name *"]', 'Standup Template');
    await page.click('text=Save Template');

    // Use the template
    await page.selectOption('select:has(option[value=""]:disabled)', { label: /Standup Template/ });

    // A new todo should appear in the list
    await expect(page.locator('li', { hasText: 'Daily Standup' }).first()).toBeVisible();
  });

  test('Template Manager shows all templates with badges', async ({ page }) => {
    await page.goto('/');
    const helpers = new TestHelpers(page);

    // Create a template
    await page.fill('input[placeholder="New todo…"]', 'Budget Review');
    await page.click('text=💾 Save as Template');
    await page.fill('input[placeholder="Template name *"]', 'Budget Template');
    await page.fill('input[placeholder="Category: Work, Personal, Finance…"]', 'Finance');
    await page.click('text=Save Template');

    // Open Template Manager
    await page.click('text=📋 Templates');
    await expect(page.locator('text=Budget Template')).toBeVisible();
    await expect(page.locator('text=Finance')).toBeVisible();
  });

  test('uses a template from the Template Manager modal', async ({ page }) => {
    await page.goto('/');

    // Create template
    await page.fill('input[placeholder="New todo…"]', 'Exercise');
    await page.click('text=💾 Save as Template');
    await page.fill('input[placeholder="Template name *"]', 'Exercise Template');
    await page.click('text=Save Template');

    // Use via manager
    await page.click('text=📋 Templates');
    await page.locator('li', { hasText: 'Exercise Template' }).locator('text=Use').click();

    // Modal closes and todo is created
    await expect(page.locator('text=📋 Templates')).toBeVisible(); // modal closed
    await expect(page.locator('li', { hasText: 'Exercise' }).first()).toBeVisible();
  });

  test('deletes a template and it disappears from the manager and dropdown', async ({ page }) => {
    await page.goto('/');

    await page.fill('input[placeholder="New todo…"]', 'To Delete Todo');
    await page.click('text=💾 Save as Template');
    await page.fill('input[placeholder="Template name *"]', 'Delete Me Template');
    await page.click('text=Save Template');

    await page.click('text=📋 Templates');
    page.on('dialog', (d) => d.accept());
    await page.locator('li', { hasText: 'Delete Me Template' }).locator('text=Delete').click();

    await expect(page.locator('text=Delete Me Template')).not.toBeVisible();
  });

  test('Save as Template button only appears when title is non-empty', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=💾 Save as Template')).not.toBeVisible();
    await page.fill('input[placeholder="New todo…"]', 'Something');
    await expect(page.locator('text=💾 Save as Template')).toBeVisible();
    await page.fill('input[placeholder="New todo…"]', '');
    await expect(page.locator('text=💾 Save as Template')).not.toBeVisible();
  });
});
