---
description: "Resume work from the existing handoff note."
agent: agent
tools: ["read", "edit"]
---

Read `docs/handoff/current-work.md`.

Then:

1. Summarize the current goal.
2. Summarize completed work.
3. List remaining tasks.
4. Inspect the files mentioned in the handoff.
5. Identify the safest next task.
6. Continue implementation from that task.

Rules:

- Do not redo completed work.
- Do not make broad refactors unless the handoff explicitly says so.
- Keep changes small and reviewable.
- After implementation, update `docs/handoff/current-work.md`.