# TaskBoard API — Lab Exercises

Each lab maps to a module in the slides.  
**Golden rule:** every change you make must leave `pnpm test` green before you commit.

---

## Setup (do this first — 5 min)

```bash
git clone https://github.com/pengbin2015/nus-iss-taskboard
cd nus-iss-taskboard
pnpm install
pnpm dev          # server at http://localhost:3000
pnpm test         # all tests should be green
```

Smoke-test the running API:
```bash
curl http://localhost:3000/health
curl http://localhost:3000/tasks
```

---

## Lab 1 · Completions & Inline Chat (Module 1)

**Goal:** get comfortable with completions and inline chat on real code.

1. Open `src/middleware/validation.ts`.  
   Add a comment `// validate that title is not longer than 200 characters`  
   and accept the completion.

2. Select the `validateCreateTask` function body, press **Ctrl/Cmd + I** and ask:  
   `"Add a check: reject title longer than 200 characters, return 400 with a clear error message."`  
   Accept the diff. Re-run `pnpm test` — all green?

3. Open `src/routes/tasks.ts`.  
   Select the `GET /` handler. Use inline chat:  
   `"Add ?search= query param support: filter tasks whose title contains the search string (case-insensitive)."`  
   Review and accept.

4. Write a test for the new `?search=` behaviour — try letting Copilot complete it.

---

## Lab 2 · Chat & Agent Mode (Module 2)

**Goal:** use the Chat panel and Agent mode to build real features.

### 2a  Explore the codebase

Open Chat in **Ask** mode and try:
```
@workspace Explain the architecture of this project in 5 bullets.
Where is task validation handled, and which file would I edit to add a new field?
```

### 2b  Build the "due date" feature (Agent mode)

In **Agent** mode, using `#codebase`:
```
Add an optional dueDate field (ISO-8601 string) to tasks.
- Add it to the Task interface in src/types/task.ts
- Accept it on POST and PATCH
- Add validation: reject if it's not a valid ISO-8601 date string
- Add tests for valid, invalid, and missing dueDate
Don't change the shape of existing responses — keep it additive.
```

Checklist before committing:
- [ ] `pnpm test` green
- [ ] `pnpm lint` clean
- [ ] existing tasks without `dueDate` still work

### 2c  Run–test–fix loop

Break something on purpose: in `src/store.ts`, change `status: "todo"` to `status: "wip"`.  
Run `pnpm test` — watch it fail.  
In Chat: `/fix the failing tests in #file:tests/tasks.test.ts`  
(or paste the error output).  
Let it self-correct, then restore the original line.

---

## Lab 3 · Steering — AGENTS.md & Prompt Files (Module 3)

**Goal:** encode your standards once, stop repeating yourself.

### 3a  Try AGENTS.md

Run `/init` in Chat to see what Copilot generates from the existing `AGENTS.md`.  
Open `AGENTS.md` and add one rule you care about (e.g. a preferred error message format).  
Trigger it with a new prompt and check that Copilot follows it.

### 3b  Use the /commit prompt

Stage your changes from Lab 2, then in Chat type:
```
/commit
```
Check the generated message follows Conventional Commits format.

### 3c  Use the /review prompt

Before committing, type:
```
/review
```
Does it catch anything? Fix the findings, then commit.

### 3d  Scoped instructions

Open `.github/instructions/tests.instructions.md` and confirm the rule about `store.reset()`.  
Now ask Copilot to add a new test file `tests/store.test.ts` — check it follows the rules automatically.

---

## Lab 4 · Planning — Spec, Phases, Tracer Bullet (Module 4)

**Goal:** plan and build a non-trivial feature using phases.

### Feature: Task Statistics endpoint

**Spec (provided):**  
`GET /stats` should return the count of tasks broken down by status and priority.  
Example response:
```json
{
  "total": 5,
  "byStatus":   { "todo": 2, "in-progress": 1, "done": 2 },
  "byPriority": { "low": 1, "medium": 2, "high": 2 }
}
```

**Step 1 — Plan mode:**  
In **Plan** mode:
```
Plan the implementation of GET /stats (see the spec above).
Break it into phases. Make Phase 1 a thin end-to-end tracer: 
the endpoint exists and returns hardcoded counts.
List the files each phase touches. Don't write code yet.
```

**Step 2 — Implement Phase 1 (tracer bullet):**  
Switch to **Agent** mode and implement Phase 1 only.  
Confirm the endpoint returns *something* (even hardcoded).  
Run tests — they should still pass.

**Step 3 — Implement Phase 2 (real logic):**  
`/clear` (or new chat), then:
```
Implement Phase 2: replace the hardcoded values in GET /stats with
real counts derived from the store. Add tests.
Using #codebase. Don't change Phase 1's route shape.
```

**Step 4 — Add edge-case tests:**
```
/tests  generate edge-case tests for GET /stats:
        empty store, all tasks the same status, mixed priorities
```

---

## Bonus Lab · Background Agent

If you have Copilot Pro+/Business:

1. Commit and push the repo to GitHub.
2. Assign a new Issue: *"Add GET /tasks/overdue — return tasks where dueDate is in the past and status != done"*.
3. In the Issue, comment: `@copilot implement this`
4. Watch it open a PR. Review the diff, add comments, and request changes.

---

## Quick-reference prompts

| What you want | Prompt |
|---|---|
| Understand the codebase | `@workspace explain the architecture in 5 bullets` |
| Find something | `Where is rate-limiting handled? #codebase` |
| Build a feature | `Agent mode + #codebase: [goal] + [constraints] + done-when:` |
| Fix a test failure | `/fix the failing test in #file:tests/tasks.test.ts` |
| Generate tests | `/tests generate edge-case tests for [function]` |
| Commit message | `/commit` |
| Code review | `/review` |
| Plan before coding | `Plan mode: break [feature] into phases. Phase 1 = tracer bullet.` |
