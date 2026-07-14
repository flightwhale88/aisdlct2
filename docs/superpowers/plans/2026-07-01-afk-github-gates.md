# AFK GitHub Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AFK agent workflow enforceable through GitHub issue, CI, PR, and agent-prompt controls.

**Architecture:** Keep the agent loop in `.github/agents`, and add repository gates around it. Issues define the work, GitHub Actions validates the branch, and the PR template makes the human merge gate explicit.

**Tech Stack:** GitHub Actions, GitHub issue forms, Markdown agent prompts, Node 20, pnpm.

---

### Task 1: Add GitHub Gates

**Files:**

- Create: `.github/workflows/ci.yml`
- Create: `.github/ISSUE_TEMPLATE/afk-agent-work.yml`
- Create: `.github/pull_request_template.md`

- [x] Add CI that runs on pull requests to `main`, pushes to `main`, and manual dispatch.
- [x] CI enables Corepack, uses Node 20, installs with `pnpm install --frozen-lockfile`, and runs `pnpm lint`, `pnpm test`, and `pnpm build`.
- [x] Add an AFK issue form with required problem, acceptance criteria, out-of-scope, docs impact, and test expectations.
- [x] Add a PR template that records verification commands and AFK review gates.

### Task 2: Tighten Agent Contracts

**Files:**

- Modify: `.github/agents/planner.agent.md`
- Modify: `.github/agents/implementer.agent.md`
- Modify: `.github/agents/reviewer.agent.md`
- Modify: `.github/agents/orchestrator.agent.md`

- [x] Planner includes docs impact, verification commands, and assumption severity in the plan.
- [x] Implementer runs build in addition to test and lint, and reports docs impact.
- [x] Reviewer runs build and checks docs, branch response-shape safety, and dependency safety.
- [x] Orchestrator stops on contract-impacting assumptions, treats GitHub Actions as the sandbox, and leaves PR creation to the human.

### Task 3: Verify

**Files:**

- Read: all changed files

- [x] Run `pnpm lint`.
- [x] Run `pnpm test`.
- [x] Run `pnpm build`.
- [x] Inspect `git diff --check`.
