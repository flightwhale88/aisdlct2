import { test, expect } from '@playwright/test';

const TEST_USERNAME = `testuser_${Date.now()}`;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('WebAuthn Authentication (PRP-11)', () => {
  test.beforeEach(async ({ page }) => {
    // Enable virtual authenticator for testing
    // Playwright already configures this in playwright.config.ts
    await page.goto(`${BASE_URL}/login`);
  });

  test('Register a new user with a virtual authenticator', async ({ page }) => {
    await page.fill('input[placeholder="Enter username"]', TEST_USERNAME);
    
    // Note: In virtual authenticator mode, the biometric prompt is automatic
    await page.click('button:has-text("Register")');
    
    // Wait for redirect to home page
    await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
    expect(page.url()).toContain('/');
  });

  test('Register with a username that already exists', async ({ page }) => {
    const existingUser = `existing_${Date.now()}`;
    
    // First registration
    await page.fill('input[placeholder="Enter username"]', existingUser);
    await page.click('button:has-text("Register")');
    await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
    
    // Go back to login
    await page.goto(`${BASE_URL}/login`);
    
    // Try to register with same username
    await page.fill('input[placeholder="Enter username"]', existingUser);
    await page.click('button:has-text("Register")');
    
    // Should see error message
    const errorElement = page.locator('[role="alert"]');
    await expect(errorElement).toContainText('already taken');
    
    // Should not navigate away
    expect(page.url()).toContain('/login');
  });

  test('Login with a previously-registered virtual authenticator', async ({ page }) => {
    const loginUser = `login_${Date.now()}`;
    
    // First, register
    await page.fill('input[placeholder="Enter username"]', loginUser);
    await page.click('button:has-text("Register")');
    await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
    
    // Logout
    await page.click('button:has-text("Logout")');
    await page.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });
    
    // Now login with same user
    await page.fill('input[placeholder="Enter username"]', loginUser);
    await page.click('button:has-text("Login")');
    
    // Should redirect to home
    await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
    expect(page.url()).toContain('/');
  });

  test('Login with an unregistered username', async ({ page }) => {
    const unknownUser = `unknown_${Date.now()}`;
    
    await page.fill('input[placeholder="Enter username"]', unknownUser);
    await page.click('button:has-text("Login")');
    
    // Should see error
    const errorElement = page.locator('[role="alert"]');
    await expect(errorElement).toBeVisible({ timeout: 5000 });
    
    // Should stay on login page
    expect(page.url()).toContain('/login');
  });

  test('Logout clears session and redirects to login', async ({ page }) => {
    const logoutUser = `logout_${Date.now()}`;
    
    // Register
    await page.fill('input[placeholder="Enter username"]', logoutUser);
    await page.click('button:has-text("Register")');
    await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
    
    // Click logout
    await page.click('button:has-text("Logout")');
    
    // Should be redirected to login
    await page.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });
    expect(page.url()).toContain('/login');
    
    // Navigating back to / should redirect to login again
    await page.goto(`${BASE_URL}/`);
    await page.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });

  test('Session persists across page reload', async ({ page }) => {
    const reloadUser = `reload_${Date.now()}`;
    
    // Register
    await page.fill('input[placeholder="Enter username"]', reloadUser);
    await page.click('button:has-text("Register")');
    await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
    
    // Reload page
    await page.reload();
    
    // Should still be on home page (session valid)
    expect(page.url()).toContain('/');
  });

  test('Unauthenticated access to protected routes redirects to login', async ({ page }) => {
    // Try to access protected route directly
    await page.goto(`${BASE_URL}/`);
    
    // Should be redirected to login
    await page.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });

  test('Calendar route is protected', async ({ page }) => {
    // Try to access calendar while not authenticated
    await page.goto(`${BASE_URL}/calendar`);
    
    // Should be redirected to login
    await page.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });

  test('Login redirects already-authenticated user to home', async ({ page }) => {
    const redirectUser = `redirect_${Date.now()}`;
    
    // Register
    await page.fill('input[placeholder="Enter username"]', redirectUser);
    await page.click('button:has-text("Register")');
    await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
    
    // Go back to login while authenticated
    await page.goto(`${BASE_URL}/login`);
    
    // Should be redirected to home
    await page.waitForURL(`${BASE_URL}/`, { timeout: 5000 });
    expect(page.url()).toContain('/');
  });

  test('Register a second authenticator for the same username', async ({ page, browser }) => {
    const multiAuthUser = `multiauth_${Date.now()}`;
    
    // First registration in first browser context
    await page.fill('input[placeholder="Enter username"]', multiAuthUser);
    await page.click('button:has-text("Register")');
    await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
    
    // Logout
    await page.click('button:has-text("Logout")');
    await page.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });
    
    // Register second authenticator in new context (simulates different device)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto(`${BASE_URL}/login`);
    
    await page2.fill('input[placeholder="Enter username"]', multiAuthUser);
    await page2.click('button:has-text("Register")');
    
    // Should fail with username already exists error
    const errorElement = page2.locator('[role="alert"]');
    await expect(errorElement).toContainText('already taken');
    
    await context2.close();
  });

  test('GET /api/auth/me returns current user when authenticated', async ({ page }) => {
    const meUser = `me_${Date.now()}`;
    
    // Register
    await page.fill('input[placeholder="Enter username"]', meUser);
    await page.click('button:has-text("Register")');
    await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
    
    // Call /api/auth/me
    const response = await page.evaluate(() =>
      fetch('/api/auth/me').then((r) => r.json())
    );
    
    expect(response.userId).toBeTruthy();
    expect(response.username).toBe(meUser);
    expect(response.created_at).toBeTruthy();
  });

  test('GET /api/auth/me returns 401 when not authenticated', async ({ page }) => {
    // Don't authenticate, just try to access /api/auth/me
    const response = await page.evaluate(() =>
      fetch('/api/auth/me').then((r) => ({ status: r.status, body: r.json() }))
    );
    
    expect(response.status).toBe(401);
  });
});
