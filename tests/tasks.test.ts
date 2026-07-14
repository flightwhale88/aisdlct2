import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { store } from "../src/store";

const app = createApp();

beforeEach(() => {
  store.reset();
});

// ── health ──────────────────────────────────────────────────────────────────
describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

// ── list tasks ───────────────────────────────────────────────────────────────
describe("GET /tasks", () => {
  it("returns all tasks with a count", async () => {
    const res = await request(app).get("/tasks");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tasks)).toBe(true);
    expect(res.body.count).toBe(res.body.tasks.length);
  });

  it("filters by status", async () => {
    const res = await request(app).get("/tasks?status=done");
    expect(res.status).toBe(200);
    res.body.tasks.forEach((t: { status: string }) => {
      expect(t.status).toBe("done");
    });
  });

  it("filters by priority", async () => {
    const res = await request(app).get("/tasks?priority=high");
    expect(res.status).toBe(200);
    res.body.tasks.forEach((t: { priority: string }) => {
      expect(t.priority).toBe("high");
    });
  });
});

// ── create task ──────────────────────────────────────────────────────────────
describe("POST /tasks", () => {
  it("creates a task and returns 201", async () => {
    const res = await request(app)
      .post("/tasks")
      .send({ title: "New test task", priority: "high", tags: ["test"] });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.title).toBe("New test task");
    expect(res.body.status).toBe("todo");   // default
    expect(res.body.priority).toBe("high");
    expect(res.body.tags).toEqual(["test"]);
  });

  it("returns 400 when title is missing", async () => {
    const res = await request(app).post("/tasks").send({ priority: "low" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });

  it("returns 400 for invalid priority", async () => {
    const res = await request(app)
      .post("/tasks")
      .send({ title: "Task", priority: "urgent" });
    expect(res.status).toBe(400);
  });
});

// ── get one task ─────────────────────────────────────────────────────────────
describe("GET /tasks/:id", () => {
  it("returns a task by id", async () => {
    const createRes = await request(app)
      .post("/tasks")
      .send({ title: "Find me" });
    const { id } = createRes.body;

    const res = await request(app).get(`/tasks/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  it("returns 404 for unknown id", async () => {
    const res = await request(app).get("/tasks/does-not-exist");
    expect(res.status).toBe(404);
  });
});

// ── update task ──────────────────────────────────────────────────────────────
describe("PATCH /tasks/:id", () => {
  it("updates status and returns the updated task", async () => {
    const { body: created } = await request(app)
      .post("/tasks")
      .send({ title: "Update me" });

    const res = await request(app)
      .patch(`/tasks/${created.id}`)
      .send({ status: "in-progress" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("in-progress");
    expect(res.body.title).toBe("Update me");  // unchanged
  });

  it("returns 400 for invalid status", async () => {
    const { body: created } = await request(app)
      .post("/tasks")
      .send({ title: "Task" });

    const res = await request(app)
      .patch(`/tasks/${created.id}`)
      .send({ status: "wip" });

    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown id", async () => {
    const res = await request(app).patch("/tasks/nope").send({ status: "done" });
    expect(res.status).toBe(404);
  });
});

// ── delete task ──────────────────────────────────────────────────────────────
describe("DELETE /tasks/:id", () => {
  it("deletes a task and returns 204", async () => {
    const { body: created } = await request(app)
      .post("/tasks")
      .send({ title: "Delete me" });

    const res = await request(app).delete(`/tasks/${created.id}`);
    expect(res.status).toBe(204);

    const check = await request(app).get(`/tasks/${created.id}`);
    expect(check.status).toBe(404);
  });

  it("returns 404 for unknown id", async () => {
    const res = await request(app).delete("/tasks/ghost");
    expect(res.status).toBe(404);
  });
});
