import { db, type CreateTodoInput } from '@/lib/db';

export const TEST_USER_ID = 1;

export function resetTestDatabase(): void {
  db.exec(`
    DELETE FROM subtasks;
    DELETE FROM todos;
    DELETE FROM users;
  `);
}

export function seedTestUser(userId: number = TEST_USER_ID): number {
  db.prepare('INSERT INTO users (id) VALUES (?)').run(userId);
  return userId;
}

export function makeTodoInput(overrides: Partial<CreateTodoInput> = {}): CreateTodoInput {
  return {
    user_id: TEST_USER_ID,
    title: 'Smoke test todo',
    due_date: null,
    priority: 'medium',
    is_recurring: false,
    recurrence_pattern: null,
    reminder_minutes: null,
    ...overrides,
  };
}