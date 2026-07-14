# TaskBoard API — Agent Instructions

## Stack
- **Runtime:** Node 20 · TypeScript 5 (strict mode)
- **Framework:** Express 4
- **Testing:** Vitest + Supertest (all tests in `tests/`)
- **IDs:** uuid v4 — always use `uuidv4()` from the `uuid` package
- **Storage:** in-memory `store` in `src/store.ts` — no database

## Commands
```
pnpm install          # install deps
pnpm dev              # start dev server with hot reload (port 3000)
pnpm test             # run tests once
pnpm test:watch       # tests in watch mode
pnpm test:coverage    # coverage report
pnpm lint             # ESLint
```

## Project layout
```
src/
  app.ts          — Express app factory (import this in tests)
  server.ts       — entry point (binds port)
  store.ts        — in-memory data store + store.reset() for tests
  types/task.ts   — Task, CreateTaskBody, UpdateTaskBody interfaces
  routes/tasks.ts — /tasks router
  middleware/
    validation.ts — validateCreateTask, validateUpdateTask
tests/
  tasks.test.ts   — existing API tests (keep all passing)
docs/
  API.md          — endpoint reference
  LABS.md         — lab exercises for students
```

## Conventions
- Functional style — no classes in route handlers
- Explicit return types on all exported functions
- Return `res.status(N).json({ error: "..." })` for errors (never throw from routes)
- Use `store.reset()` in `beforeEach()` in every test file
- Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`

## Boundaries
- **Never** install a real database — use the in-memory store
- **Never** edit `src/types/task.ts` unless the lab explicitly says to
- **Never** change the shape of existing API responses (additive changes only)
- **Ask** before adding a new dependency
