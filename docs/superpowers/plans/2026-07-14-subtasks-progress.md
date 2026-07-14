# Subtasks & Progress Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build PRP 05 subtasks and progress tracking end-to-end in the Next.js todo app target, including database, API routes, UI, and tests.

**Architecture:** Keep subtask logic in a narrow slice: `lib/db.ts` owns persistence and ownership checks, `lib/progress.ts` owns the pure percentage calculation, API routes handle auth + validation, and `app/page.tsx` composes the collapsible checklist UI with live progress display. Because the current workspace is an Express TaskBoard API, this plan also includes the minimum Next.js app scaffold needed to match the PRP target before feature work starts.

**Tech Stack:** Next.js App Router, React 19, TypeScript 5, better-sqlite3, Playwright, Vitest, Tailwind CSS 4.

## Global Constraints

- All date/time behavior must use Singapore time via `lib/timezone.ts`; do not use `new Date()` directly for application logic.
- Use `better-sqlite3` synchronously for database access.
- Enable `PRAGMA foreign_keys = ON` at database initialization so `ON DELETE CASCADE` works for subtasks.
- Subtasks are single-level only; no nested subtasks.
- Completing subtasks must not auto-complete the parent todo.
- Completing the parent todo must not auto-complete subtasks.
- Subtask IDs are owned through the parent todo; cross-user access must return `404`, not `403`.
- Deleting a todo must remove all subtasks automatically through foreign keys.
- The progress bar must be hidden entirely when a todo has zero subtasks.
- Empty or whitespace-only subtask titles must be rejected client-side and server-side.

---

### Task 1: Establish the Next.js todo app baseline that PRP 05 expects

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `lib/auth.ts`
- Create: `lib/timezone.ts`
- Create: `lib/db.ts`
- Create: `app/api/todos/route.ts`
- Create: `app/api/todos/[id]/route.ts`
- Create: `tests/helpers.ts`
- Create: `playwright.config.ts`

**Interfaces:**
- Consumes: PRP 01 todo CRUD contract, authenticated session shape, Singapore timezone helpers.
- Produces: the todo model, auth guard, and API surface that subtasks will extend.

- [ ] **Step 1: Write the failing smoke test for the target app shape**

Create a small test or startup check that asserts the Next.js app exports the expected todo routes and that the db module initializes with foreign keys enabled.

- [ ] **Step 2: Run the smoke check and confirm it fails before the scaffold exists**

Run: `pnpm test -- --runInBand` or the repo's equivalent smoke command
Expected: failure because the Next.js target files do not exist yet.

- [ ] **Step 3: Add the minimal Next.js scaffold and baseline todo CRUD files**

Create the files listed above with a minimal app shell, a db module that defines the todo schema from PRP 01, and helper utilities for auth/timezone.

- [ ] **Step 4: Run the smoke check again**

Run: `pnpm test`
Expected: the scaffold imports cleanly and the basic startup/smoke test passes.

- [ ] **Step 5: Commit the scaffold once it is stable**

Use a conventional commit such as: `feat: scaffold nextjs todo app baseline`

---

### Task 2: Add subtask persistence and progress calculation

**Files:**
- Modify: `lib/db.ts`
- Create: `lib/progress.ts`
- Create: `tests/progress.test.ts`
- Create: `tests/subtask-db.test.ts`

**Interfaces:**
- Consumes: `todo_id` ownership from `lib/db.ts`, todo delete cascade from PRP 01.
- Produces: `Subtask`, `CreateSubtaskDto`, `UpdateSubtaskDto`, `subtaskDB`, and `calculateProgress(subtasks)`.

- [ ] **Step 1: Write the failing unit tests for progress math and subtask ordering**

`tests/progress.test.ts` should cover: `[] -> { completed: 0, total: 0, percent: 0 }`, partial completion rounding, and 100% completion.

`tests/subtask-db.test.ts` should cover: create appends at `max(position) + 1`, find returns `ORDER BY position ASC`, delete leaves sibling positions unchanged, and todo deletion cascade removes subtasks.

- [ ] **Step 2: Run the new tests and verify they fail**

Run: `pnpm test tests/progress.test.ts tests/subtask-db.test.ts`
Expected: failures because `calculateProgress` and `subtaskDB` are not implemented yet.

- [ ] **Step 3: Implement the subtasks table and DB helpers**

Add the subtasks schema, enable foreign keys on the SQLite connection, and implement `findByTodoId`, `create`, `update`, and `delete` on `subtaskDB`.

- [ ] **Step 4: Implement the pure progress helper**

Add `calculateProgress(subtasks)` to `lib/progress.ts` so the UI and API can share the same math.

- [ ] **Step 5: Rerun the tests until both suites pass**

Run: `pnpm test tests/progress.test.ts tests/subtask-db.test.ts`
Expected: both suites pass.

- [ ] **Step 6: Commit the persistence slice**

Use a conventional commit such as: `feat: add subtasks persistence and progress math`

---

### Task 3: Add subtask API routes with auth, ownership, and validation

**Files:**
- Create: `app/api/todos/[id]/subtasks/route.ts`
- Create: `app/api/subtasks/[id]/route.ts`
- Create: `tests/subtask-routes.test.ts`

**Interfaces:**
- Consumes: `todoDB`, `subtaskDB`, `calculateProgress`, authenticated `session.userId`.
- Produces: `POST /api/todos/[id]/subtasks`, `PUT /api/subtasks/[id]`, and `DELETE /api/subtasks/[id]`.

- [ ] **Step 1: Write failing route tests for create, toggle, delete, and cross-user 404s**

Cover: `POST` rejects whitespace titles, `POST` creates with `position = max + 1`, `PUT` toggles `completed` and/or `title`, `DELETE` removes one subtask, and all three routes reject missing auth or non-owned todos with `401`/`404`.

- [ ] **Step 2: Run the route tests and confirm they fail**

Run: `pnpm test tests/subtask-routes.test.ts`
Expected: failures because the routes are missing or incomplete.

- [ ] **Step 3: Implement the route handlers**

Add ownership checks through the parent todo, trim and validate titles, and return `201`, `200`, `400`, `401`, or `404` exactly as the PRP specifies.

- [ ] **Step 4: Rerun the route tests until they pass**

Run: `pnpm test tests/subtask-routes.test.ts`
Expected: all route tests pass.

- [ ] **Step 5: Commit the API slice**

Use a conventional commit such as: `feat: add subtask api routes`

---

### Task 4: Build the collapsible subtasks UI and live progress display

**Files:**
- Modify: `app/page.tsx`
- Create: `components/subtasks/ProgressBar.tsx`
- Create: `components/subtasks/SubtaskList.tsx`
- Create: `components/subtasks/SubtaskRow.tsx`
- Create: `tests/subtasks-ui.spec.ts`

**Interfaces:**
- Consumes: `Subtask[]`, `calculateProgress`, the subtask API routes, and parent todo state.
- Produces: expand/collapse behavior, add/toggle/delete interactions, visible progress bar, and `X/Y subtasks` text.

- [ ] **Step 1: Write the failing UI test for expand, add, toggle, delete, and collapse behavior**

The Playwright spec should assert that the progress bar is hidden at zero subtasks, appears after the first subtask is added, updates immediately after toggle/delete, and remains visible when collapsed.

- [ ] **Step 2: Run the Playwright spec and confirm it fails**

Run: `npx playwright test tests/subtasks-ui.spec.ts`
Expected: failures because the UI is not wired yet.

- [ ] **Step 3: Extract the subtask UI components and wire them into the todo row**

Implement a collapsible subtask section, a progress bar that is blue below 100% and green at 100%, and optimistic client updates or re-fetches after mutation.

- [ ] **Step 4: Make sure the UI matches the PRP constraints**

Verify: no progress bar at zero subtasks, add via Enter and button, toggle checkbox independent of parent completion, delete only the selected row, and no renumbering UI.

- [ ] **Step 5: Rerun the Playwright spec until it passes**

Run: `npx playwright test tests/subtasks-ui.spec.ts`
Expected: the UI flow passes.

- [ ] **Step 6: Commit the UI slice**

Use a conventional commit such as: `feat: add subtasks progress ui`

---

### Task 5: Cover the feature with the required integration and end-to-end tests

**Files:**
- Modify: `tests/helpers.ts`
- Create: `tests/07-subtasks.spec.ts`
- Modify: `tests/subtask-db.test.ts`
- Modify: `tests/subtask-routes.test.ts`
- Modify: `tests/subtasks-ui.spec.ts`

**Interfaces:**
- Consumes: all subtasks APIs, the progress helper, and todo deletion cascade.
- Produces: a complete regression suite for PRP 05 acceptance criteria.

- [ ] **Step 1: Expand the helpers for creating todos and subtasks in tests**

Add helper functions for creating a todo, adding a subtask, toggling completion, and deleting a todo so the E2E test stays readable.

- [ ] **Step 2: Write the end-to-end acceptance spec**

Cover: add unlimited subtasks, progress updates after add/toggle/delete, collapse behavior, zero-subtask hiding, cross-user 404 behavior, and cascade deletion.

- [ ] **Step 3: Run the full targeted test set**

Run: `pnpm test` and `npx playwright test tests/07-subtasks.spec.ts`
Expected: all targeted tests pass.

- [ ] **Step 4: Check for orphaned rows and final PRP criteria**

Verify the test DB returns zero orphaned subtasks after todo deletion and that the progress bar/count behavior matches the acceptance criteria exactly.

- [ ] **Step 5: Commit the completed feature slice**

Use a conventional commit such as: `feat: complete subtasks progress tracking`

---

## Coverage Check

- PRP 01 baseline and app scaffold: Task 1.
- Subtask schema, CRUD, and progress math: Task 2.
- Authenticated API routes and ownership checks: Task 3.
- Collapsible UI, progress bar, and live updates: Task 4.
- E2E, route, and unit coverage for acceptance criteria: Task 5.

## Notes

- This plan intentionally targets the Next.js todo app described by the PRPs, not the current Express TaskBoard API that exists in the workspace.
- If you want the work kept inside the current Express app instead, this plan should be rewritten because the file layout and test harness are different.
