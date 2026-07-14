import { v4 as uuidv4 } from "uuid";
import { Task, CreateTaskBody, UpdateTaskBody } from "./types/task";

// Simple in-memory store — no database needed for labs.
// State lives here; tests import `store` directly to reset between runs.

const tasks: Map<string, Task> = new Map();

// Seed a couple of tasks so the API returns something on first run.
function seed(): void {
  const now = new Date().toISOString();
  const seedData: Task[] = [
    {
      id: uuidv4(),
      title: "Set up CI pipeline",
      description: "Add GitHub Actions workflow to run tests on every PR.",
      status: "todo",
      priority: "high",
      tags: ["devops", "ci"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      title: "Write API docs",
      description: "Document all endpoints in docs/API.md.",
      status: "in-progress",
      priority: "medium",
      tags: ["docs"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      title: "Fix login redirect bug",
      status: "done",
      priority: "high",
      tags: ["bug", "auth"],
      createdAt: now,
      updatedAt: now,
    },
  ];
  seedData.forEach((t) => tasks.set(t.id, t));
}

seed();

export const store = {
  // ── read ────────────────────────────────────────────────────────────────
  getAll(): Task[] {
    return [...tasks.values()];
  },

  getById(id: string): Task | undefined {
    return tasks.get(id);
  },

  // ── write ───────────────────────────────────────────────────────────────
  create(body: CreateTaskBody): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: uuidv4(),
      title: body.title,
      description: body.description,
      status: "todo",
      priority: body.priority ?? "medium",
      tags: body.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    tasks.set(task.id, task);
    return task;
  },

  update(id: string, patch: UpdateTaskBody): Task | undefined {
    const existing = tasks.get(id);
    if (!existing) return undefined;
    const updated: Task = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    tasks.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    return tasks.delete(id);
  },

  // ── test helper ─────────────────────────────────────────────────────────
  /** Clear all tasks and re-seed. Call in beforeEach() in tests. */
  reset(): void {
    tasks.clear();
    seed();
  },
};
