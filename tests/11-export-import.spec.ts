import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers';
import path from 'path';
import fs from 'fs';

test.describe('Export & Import (PRP-09)', () => {
  test('Export JSON button triggers a file download', async ({ page }) => {
    await page.goto('/');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('text=Export JSON'),
    ]);

    expect(download.suggestedFilename()).toMatch(/^todos-\d{4}-\d{2}-\d{2}\.json$/);
  });

  test('Export CSV button triggers a file download', async ({ page }) => {
    await page.goto('/');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('text=Export CSV'),
    ]);

    expect(download.suggestedFilename()).toMatch(/^todos-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test('imports a valid JSON file and shows success banner', async ({ page }) => {
    await page.goto('/');
    const helpers = new TestHelpers(page);
    await helpers.createTodo('Exportable todo');

    // Export the JSON
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('text=Export JSON'),
    ]);

    const tmpPath = path.join(process.cwd(), 'tmp-export.json');
    await download.saveAs(tmpPath);

    // Import it back
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Import');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tmpPath);

    await expect(page.locator('text=/Successfully imported \\d+ todos/')).toBeVisible();

    fs.unlinkSync(tmpPath);
  });

  test('import of invalid JSON shows error banner', async ({ page }) => {
    await page.goto('/');

    // Write a non-JSON file
    const tmpPath = path.join(process.cwd(), 'bad.json');
    fs.writeFileSync(tmpPath, 'not json at all');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Import');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tmpPath);

    await expect(page.locator('text=Invalid JSON format')).toBeVisible();
    fs.unlinkSync(tmpPath);
  });

  test('import of wrong-schema JSON shows format error', async ({ page }) => {
    await page.goto('/');

    const tmpPath = path.join(process.cwd(), 'wrong-schema.json');
    fs.writeFileSync(tmpPath, JSON.stringify({ version: 1, todos: [{ bad: 'data' }] }));

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Import');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tmpPath);

    await expect(page.locator('text=Please check the file format')).toBeVisible();
    fs.unlinkSync(tmpPath);
  });

  test('round-trip: export → import restores todos with tags and subtasks', async ({ page }) => {
    await page.goto('/');
    const helpers = new TestHelpers(page);

    await helpers.createTag('RoundtripTag', '#FF5733');
    await helpers.createTodo('Round-trip todo', ['RoundtripTag']);
    await helpers.addSubtask('Round-trip todo', 'Sub step');

    // Export
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('text=Export JSON'),
    ]);
    const tmpPath = path.join(process.cwd(), 'roundtrip.json');
    await download.saveAs(tmpPath);

    // Import
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Import');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tmpPath);

    await expect(page.locator('text=/Successfully imported \\d+ todos/')).toBeVisible();

    // Verify restored todo has the tag
    const items = page.locator('li', { hasText: 'Round-trip todo' });
    await expect(items).toHaveCount(2); // original + imported
    await expect(items.last().locator('text=RoundtripTag')).toBeVisible();

    fs.unlinkSync(tmpPath);
  });
});
