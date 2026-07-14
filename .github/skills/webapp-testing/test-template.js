import { test, expect } from "@playwright/test";

test.describe("user flow", () => {
  test("completes the primary path", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/TaskBoard/i);
  });
});
