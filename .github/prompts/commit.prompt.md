---
description: "Write a Conventional Commits message for staged changes"
agent: agent
tools: ["search/changes"]
---
Inspect the staged diff (#changes) and write a Conventional Commits message.

Format: `type(scope): short summary` (≤ 60 chars)

Allowed types: feat, fix, test, docs, refactor, chore, style

Add a blank line then a brief body (1–3 bullets) explaining *why*, not just what.
Keep the summary in the imperative mood: "add" not "added".
