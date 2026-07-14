---
description: "Code-review the staged or selected changes"
agent: agent
tools: ["search/changes"]
---
Review the staged diff (#changes) as a senior TypeScript engineer.

Check for:
1. **Correctness** — logic errors, off-by-one, unhandled edge cases
2. **Type safety** — missing types, `any`, unsafe casts
3. **Error handling** — are all error paths covered and returning JSON?
4. **Test coverage** — is there a test for the new behaviour?
5. **Conventions** — does it follow AGENTS.md (no classes, no DB, Conventional Commits)?

Format your output as a numbered list of findings.
Start each with `✅`, `⚠️`, or `❌` to show severity.
End with a one-line overall verdict.
