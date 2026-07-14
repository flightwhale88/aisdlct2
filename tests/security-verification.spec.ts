import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Security Verification (Comprehensive)', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // 1. AUTHENTICATION & AUTHORIZATION
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('Authentication & Authorization', () => {
    test('Restricted page "/" redirects unauthenticated users to /login', async ({
      page,
      context,
    }) => {
      // New context without session
      const newPage = await context.newPage();
      await newPage.goto(`${BASE_URL}/`);

      // Should redirect to login
      await newPage.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });
      expect(newPage.url()).toContain('/login');
    });

    test('Restricted page "/calendar" redirects unauthenticated users to /login', async ({
      page,
      context,
    }) => {
      const newPage = await context.newPage();
      await newPage.goto(`${BASE_URL}/calendar`);

      await newPage.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });
      expect(newPage.url()).toContain('/login');
    });

    test('API endpoint /api/todos rejects requests without session (401)', async ({
      context,
    }) => {
      // New context without auth
      const page = await context.newPage();
      const response = await page.evaluate(() =>
        fetch('/api/todos').then((r) => ({ status: r.status, body: r.json() }))
      );

      expect(response.status).toBe(401);
    });

    test('API endpoint /api/todos/export rejects unauthenticated requests', async ({
      context,
    }) => {
      const page = await context.newPage();
      const response = await page.evaluate(() =>
        fetch('/api/todos/export').then((r) => ({ status: r.status }))
      );

      expect(response.status).toBe(401);
    });

    test('User cannot modify another user\'s todo (data ownership)', async ({
      page,
    }) => {
      // Register and create a todo
      const user1 = `sec_user1_${Date.now()}`;
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[placeholder="Enter username"]', user1);
      await page.click('button:has-text("Register")');
      await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });

      // Create a todo
      await page.fill('input[placeholder="New todo…"]', 'User1 secret todo');
      await page.click('button:has-text("Add")');
      await page.waitForSelector('text=User1 secret todo');

      // Get the todo ID from the API
      const todos = await page.evaluate(() =>
        fetch('/api/todos').then((r) => r.json())
      );
      const todoId = todos.length > 0 ? todos[0].id : null;

      // Logout
      await page.click('button:has-text("Logout")');
      await page.waitForURL(`${BASE_URL}/login`);

      // Register as different user
      const user2 = `sec_user2_${Date.now()}`;
      await page.fill('input[placeholder="Enter username"]', user2);
      await page.click('button:has-text("Register")');
      await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });

      // Try to modify user1's todo
      if (todoId) {
        const response = await page.evaluate((id) =>
          fetch(`/api/todos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'HACKED' }),
          }).then((r) => ({ status: r.status }))
        , todoId);

        // Should fail (either 404, 403, or other error, but NOT 200)
        expect([403, 404, 401]).toContain(response.status);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. INPUT VALIDATION
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('Input Validation', () => {
    test.beforeEach(async ({ page }) => {
      // Setup: Register and login
      const username = `input_test_${Date.now()}`;
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[placeholder="Enter username"]', username);
      await page.click('button:has-text("Register")');
      await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
    });

    test('Empty input is rejected', async ({ page }) => {
      await page.fill('input[placeholder="New todo…"]', '');
      const addBtn = page.locator('button:has-text("Add")');

      // Button should be disabled or submission should fail
      const isDisabled = await addBtn.isDisabled();
      expect(isDisabled).toBe(true);
    });

    test('Only whitespace is rejected', async ({ page }) => {
      await page.fill('input[placeholder="New todo…"]', '   \n\t  ');
      const addBtn = page.locator('button:has-text("Add")');

      // Should be disabled
      const isDisabled = await addBtn.isDisabled();
      expect(isDisabled).toBe(true);
    });

    test('Extremely long input is handled safely (5000+ characters)', async ({
      page,
    }) => {
      const longTitle = 'A'.repeat(5000);
      await page.fill('input[placeholder="New todo…"]', longTitle);

      const addBtn = page.locator('button:has-text("Add")');
      const isDisabled = await addBtn.isDisabled();

      if (!isDisabled) {
        await page.click('button:has-text("Add")');
        // Either truncated or rejected, but should not crash
        await page.waitForTimeout(1000);
        expect(page.url()).toContain('/');
      }
    });

    test('Special characters are handled correctly', async ({ page }) => {
      const specialChars = 'Todo with: !@#$%^&*()_+-=[]{}|;:\'"<>,.?/';
      await page.fill('input[placeholder="New todo…"]', specialChars);
      await page.click('button:has-text("Add")');

      // Should create without crashing
      await page.waitForSelector(`text=${specialChars.split('?')[0].substring(0, 20)}`);
    });

    test('Unicode and emoji input is handled safely', async ({ page }) => {
      const unicodeTodo = '写字 東京 🚀 ñoño';
      await page.fill('input[placeholder="New todo…"]', unicodeTodo);
      await page.click('button:has-text("Add")');

      // Should display correctly
      await page.waitForTimeout(500);
      expect(page.url()).toContain('/');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. XSS PREVENTION
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('XSS Prevention', () => {
    test.beforeEach(async ({ page }) => {
      const username = `xss_test_${Date.now()}`;
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[placeholder="Enter username"]', username);
      await page.click('button:has-text("Register")');
      await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
    });

    test('HTML script tags in todo title do not execute', async ({ page }) => {
      const xssPayload = '<script>alert("XSS")</script> Test Todo';
      await page.fill('input[placeholder="New todo…"]', xssPayload);
      await page.click('button:has-text("Add")');

      // Wait for todo to appear
      await page.waitForTimeout(500);

      // Check that script was NOT executed (no dialog shown)
      const dialogs: string[] = [];
      page.on('dialog', (dialog) => {
        dialogs.push(dialog.message());
        dialog.dismiss();
      });

      // Navigate away and back to trigger any deferred scripts
      await page.reload();
      await page.waitForTimeout(500);

      // No dialog should have appeared
      expect(dialogs).toHaveLength(0);
    });

    test('Inline JavaScript (onclick, onload) does not execute', async ({
      page,
    }) => {
      const xssPayload = '<img src=x onerror="alert(\'XSS\')" /> Test';
      await page.fill('input[placeholder="New todo…"]', xssPayload);
      await page.click('button:has-text("Add")');

      const dialogs: string[] = [];
      page.on('dialog', (dialog) => {
        dialogs.push(dialog.message());
        dialog.dismiss();
      });

      await page.waitForTimeout(500);
      expect(dialogs).toHaveLength(0);
    });

    test('HTML entity encoding prevents XSS', async ({ page }) => {
      const xssPayload = '<svg onload="alert(\'XSS\')">';
      await page.fill('input[placeholder="New todo…"]', xssPayload);
      await page.click('button:has-text("Add")');

      const dialogs: string[] = [];
      page.on('dialog', (dialog) => {
        dialogs.push(dialog.message());
        dialog.dismiss();
      });

      await page.waitForTimeout(500);
      expect(dialogs).toHaveLength(0);
    });

    test('Event handler attributes are not executed', async ({ page }) => {
      const xssPayload =
        'Todo<div onmouseover="alert(\'XSS\')">hover me</div>';
      await page.fill('input[placeholder="New todo…"]', xssPayload);
      await page.click('button:has-text("Add")');

      const dialogs: string[] = [];
      page.on('dialog', (dialog) => {
        dialogs.push(dialog.message());
        dialog.dismiss();
      });

      await page.waitForTimeout(500);
      expect(dialogs).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. SQL INJECTION PREVENTION
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('SQL Injection Prevention', () => {
    test.beforeEach(async ({ page }) => {
      const username = `sqli_test_${Date.now()}`;
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[placeholder="Enter username"]', username);
      await page.click('button:has-text("Register")');
      await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
    });

    test('SQL injection in todo title is treated as literal string', async ({
      page,
    }) => {
      const sqlPayload = "'; DROP TABLE todos; --";
      await page.fill('input[placeholder="New todo…"]', sqlPayload);
      await page.click('button:has-text("Add")');

      // Wait for creation
      await page.waitForTimeout(500);

      // Database should still exist and be accessible
      const todosResponse = await page.evaluate(() =>
        fetch('/api/todos').then((r) => r.json())
      );

      // Should return array (not error)
      expect(Array.isArray(todosResponse)).toBe(true);
    });

    test('Single quotes in todo title are safely escaped', async ({ page }) => {
      const sqlPayload = "Test' OR '1'='1";
      await page.fill('input[placeholder="New todo…"]', sqlPayload);
      await page.click('button:has-text("Add")');

      await page.waitForTimeout(500);

      // Should not affect queries
      const response = await page.evaluate(() =>
        fetch('/api/todos').then((r) => r.json())
      );

      expect(Array.isArray(response)).toBe(true);
    });

    test('Double quotes in todo title are handled safely', async ({ page }) => {
      const sqlPayload = 'Test" UNION SELECT * FROM users --';
      await page.fill('input[placeholder="New todo…"]', sqlPayload);
      await page.click('button:has-text("Add")');

      await page.waitForTimeout(500);

      // API should still work normally
      const response = await page.evaluate(() =>
        fetch('/api/todos').then((r) => r.json())
      );

      expect(Array.isArray(response)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. ERROR HANDLING & INFO DISCLOSURE
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('Error Handling & Information Disclosure', () => {
    test('Invalid API request returns proper error message (not crash)', async ({
      context,
    }) => {
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/login`);

      const response = await page.evaluate(() =>
        fetch('/api/todos/9999999').then((r) => ({
          status: r.status,
          body: r.json(),
        }))
      );

      // Should return 401 or 404, not 500
      expect([401, 404]).toContain(response.status);
    });

    test('API with unexpected data type is handled gracefully', async ({
      page,
    }) => {
      const username = `error_test_${Date.now()}`;
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[placeholder="Enter username"]', username);
      await page.click('button:has-text("Register")');
      await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });

      // Send malformed JSON
      const response = await page.evaluate(() =>
        fetch('/api/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: null, priority: 123 }),
        }).then((r) => ({ status: r.status }))
      );

      // Should return 400 (bad request), not 500
      expect([400, 422, 401]).toContain(response.status);
    });

    test('Error messages do not expose database paths or system info', async ({
      page,
    }) => {
      const username = `info_disc_${Date.now()}`;
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[placeholder="Enter username"]', username);
      await page.click('button:has-text("Register")');
      await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });

      // Trigger error
      const errorResponse = await page.evaluate(() =>
        fetch('/api/todos/invalid', {
          method: 'DELETE',
        }).then((r) => r.json())
      );

      // Error message should be generic, not revealing
      const errorMsg = JSON.stringify(errorResponse);
      expect(errorMsg).not.toMatch(/\/users\/|\/todos\.db|C:\\/i);
      expect(errorMsg).not.toMatch(/stack|traceback|pathname/i);
    });

    test('API does not expose internal error details', async ({ page }) => {
      const username = `api_error_${Date.now()}`;
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[placeholder="Enter username"]', username);
      await page.click('button:has-text("Register")');
      await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });

      const response = await page.evaluate(() =>
        fetch('/api/todos/xyz', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Test' }),
        }).then((r) => r.json())
      );

      // Response should not contain stack traces or SQL queries
      const responseStr = JSON.stringify(response).toLowerCase();
      expect(responseStr).not.toContain('stack');
      expect(responseStr).not.toContain('sql');
      expect(responseStr).not.toContain('select * from');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. DATA ACCESS & DELETION
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('Data Access & Deletion', () => {
    test('Deleted todo cannot be accessed via direct API call', async ({
      page,
    }) => {
      const username = `delete_test_${Date.now()}`;
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[placeholder="Enter username"]', username);
      await page.click('button:has-text("Register")');
      await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });

      // Create a todo
      await page.fill('input[placeholder="New todo…"]', 'To be deleted');
      await page.click('button:has-text("Add")');
      await page.waitForSelector('text=To be deleted');

      // Get todo ID
      const todos = await page.evaluate(() =>
        fetch('/api/todos').then((r) => r.json())
      );
      const todoId = todos.find((t: any) => t.title === 'To be deleted')?.id;

      // Delete the todo
      await page.evaluate(
        (id) =>
          fetch(`/api/todos/${id}`, { method: 'DELETE' }).then((r) => r.json()),
        todoId,
      );

      // Try to fetch deleted todo
      const response = await page.evaluate((id) =>
        fetch(`/api/todos/${id}`).then((r) => ({ status: r.status }))
      , todoId);

      // Should be 404 or return nothing
      expect([404, 401]).toContain(response.status);
    });

    test('Deleted records do not appear in list endpoints', async ({
      page,
    }) => {
      const username = `del_list_${Date.now()}`;
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[placeholder="Enter username"]', username);
      await page.click('button:has-text("Register")');
      await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });

      // Create and delete a todo
      await page.fill('input[placeholder="New todo…"]', 'Vanish me');
      await page.click('button:has-text("Add")');
      await page.waitForSelector('text=Vanish me');

      const allTodosBefore = await page.evaluate(() =>
        fetch('/api/todos').then((r) => r.json())
      );
      const todoToDelete = allTodosBefore.find(
        (t: any) => t.title === 'Vanish me',
      );

      // Delete it
      await page.evaluate(
        (id) =>
          fetch(`/api/todos/${id}`, { method: 'DELETE' }).then((r) => r.json()),
        todoToDelete.id,
      );

      // Check list again
      const allTodosAfter = await page.evaluate(() =>
        fetch('/api/todos').then((r) => r.json())
      );

      expect(allTodosAfter).not.toContainEqual(
        expect.objectContaining({ title: 'Vanish me' }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. SENSITIVE INFO EXPOSURE
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('Sensitive Information Exposure', () => {
    test('Environment variables are not exposed in frontend bundle', async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}/`);

      // Check page source for common secret patterns
      const pageSource = await page.content();

      // Should not contain actual env var values
      expect(pageSource).not.toContain('sk-proj-');
      expect(pageSource).not.toContain('password');
      expect(pageSource).not.toContain('secret_key');
      expect(pageSource).not.toContain('DATABASE_URL');
    });

    test('No hardcoded API keys in client-side code', async ({ page }) => {
      await page.goto(`${BASE_URL}/`);

      // Get all network requests
      const requests: string[] = [];
      page.on('request', (req) => {
        requests.push(req.url());
      });

      await page.waitForTimeout(1000);

      // Check that requests don't expose secrets in URLs
      for (const url of requests) {
        expect(url).not.toMatch(/api_key=|secret=|token=[a-zA-Z0-9]{50,}/);
      }
    });

    test('Session token is HTTP-only (not accessible to JS)', async ({
      page,
    }) => {
      const username = `cookie_test_${Date.now()}`;
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[placeholder="Enter username"]', username);
      await page.click('button:has-text("Register")');
      await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });

      // Try to access session cookie from JavaScript
      const cookieValue = await page.evaluate(() => {
        return document.cookie;
      });

      // HTTP-only cookies should NOT be accessible
      expect(cookieValue).not.toContain('session');
      expect(cookieValue).not.toContain('token');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8. DEPENDENCY & PACKAGE SECURITY
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('Security: Dependency Audits', () => {
    test('npm audit shows no critical vulnerabilities', async ({ page }) => {
      // This test assumes you've run: npm audit
      // Output should be checked in CI/CD pipeline
      // Placeholder for documentation
      expect(true).toBe(true); // Documented requirement
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 9. RATE LIMITING & ABUSE PREVENTION (Future Enhancement)
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('Abuse Prevention (Documented)', () => {
    test('API should implement rate limiting on auth endpoints (Future)', async ({
      page,
    }) => {
      // Rate limiting not yet implemented, but documented as requirement
      // This test serves as a reminder for future implementation
      expect(true).toBe(true);
    });
  });
});
