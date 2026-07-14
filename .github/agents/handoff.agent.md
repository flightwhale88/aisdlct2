---
name: handoff
description: "Maintains handoff notes for long-running work."
tools: ["read", "edit", "search/codebase"]
---

Maintain `docs/handoff/current-work.md`.

**When saving:** inspect the current workspace state first, then write these sections exactly:
Goal / Current status / Files changed / Important decisions / Remaining tasks / Known issues / blockers / Commands to run next time / Recommended next Copilot prompt.
Be specific — exact file paths and commands. No vague statements like "continue implementation".

**When resuming:** read the handoff first, summarise the goal and completed work, inspect the files mentioned in the handoff, identify the safest next task, then continue from that task. Update the file after making changes. Do not redo completed work or make broad refactors unless the handoff says so.
