import { Page } from '@playwright/test';

/**
 * Shared helper class for Playwright tests.
 * Provides reusable methods to set up common fixtures.
 */
export class TestHelpers {
  constructor(private readonly page: Page) {}

  /**
   * Creates a tag via the Manage Tags modal and closes the modal.
   * Returns the tag name for chaining.
   */
  async createTag(name: string, color = '#3B82F6'): Promise<string> {
    await this.page.click('text=+ Manage Tags');
    await this.page.fill('input[placeholder="Tag name"]', name);
    await this.page.fill('input[placeholder="#3B82F6"]', color);
    await this.page.click('text=Create');
    // Wait for tag to appear in the list before closing
    await this.page.locator(`text=${name}`).first().waitFor({ state: 'visible' });
    await this.page.click('text=Close');
    return name;
  }

  /**
   * Creates a todo with an optional set of tag names already applied.
   * Tags must already exist (use createTag first).
   */
  async createTodo(title: string, tagNames: string[] = []): Promise<void> {
    for (const tagName of tagNames) {
      await this.page.click(`button:has-text("${tagName}")`);
    }
    await this.page.fill('input[placeholder="New todo…"]', title);
    await this.page.click('button[type="submit"]');
    await this.page.locator(`text=${title}`).waitFor({ state: 'visible' });
  }

  /**
   * Adds a subtask to an existing todo by expanding its subtask section.
   * The todo must already be visible on the page.
   */
  async addSubtask(todoTitle: string, subtaskTitle: string): Promise<void> {
    const todoItem = this.page.locator('li', { hasText: todoTitle });
    const expandBtn = todoItem.locator('text=▶ Subtasks');
    if (await expandBtn.isVisible()) {
      await expandBtn.click();
    }
    await todoItem.locator('input[placeholder="Add subtask…"]').fill(subtaskTitle);
    await todoItem.locator('button', { hasText: 'Add' }).click();
    await todoItem.locator(`text=${subtaskTitle}`).waitFor({ state: 'visible' });
  }
}
