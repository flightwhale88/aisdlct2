---
applyTo: "**/*.test.ts"
---
- Always import `store` from `../src/store` and call `store.reset()` in `beforeEach()`.
- Use `describe` blocks that mirror the route they test: `describe("GET /tasks/:id", ...)`.
- Name each test: `"returns X when Y"` — one focused assertion per test where possible.
- Use Vitest (`import { describe, it, expect, beforeEach } from "vitest"`), not Jest.
- Use Supertest against `createApp()` — never spin up a real server.
