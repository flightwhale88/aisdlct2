# NUS-ISS TaskBoard API

A small but realistic REST API used as the hands-on lab for  
**NUS-ISS AI-Augmented SDLC — Day 1: Coding with GitHub Copilot**.

The codebase is intentionally small enough to understand in 5 minutes, structured the way real APIs are, and has deliberate extension points that you fill in *with* Copilot during the lab.

## Quick start

```bash
git clone https://github.com/pengbin2015/nus-iss-taskboard
cd nus-iss-taskboard
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # all green
```

## Stack

| Layer | Tool |
|-------|------|
| Runtime | Node 20 + TypeScript 5 |
| Framework | Express 4 |
| Testing | Vitest + Supertest |
| Storage | In-memory (no database needed) |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/tasks` | List all tasks (`?status=` `?priority=`) |
| POST | `/tasks` | Create a task |
| GET | `/tasks/:id` | Get one task |
| PATCH | `/tasks/:id` | Update a task |
| DELETE | `/tasks/:id` | Delete a task |

Full reference → [`docs/API.md`](docs/API.md)

## Lab exercises

Step-by-step labs for each module → [`docs/LABS.md`](docs/LABS.md)

## Copilot steering files

| File | Purpose |
|------|---------|
| `AGENTS.md` | Always-on instructions for any agent |
| `.github/copilot-instructions.md` | Same, picked up by VS Code Copilot |
| `.github/instructions/tests.instructions.md` | Scoped rules for test files |
| `.github/prompts/commit.prompt.md` | `/commit` slash command |
| `.github/prompts/review.prompt.md` | `/review` slash command |
| `.github/prompts/save-handoff.prompt.md` | `/save-handoff` slash command |
| `.github/prompts/resume-handoff.prompt.md` | `/resume-handoff` slash command |
| `.github/agents/security-reviewer.agent.md` | Read-only security reviewer |
| `.github/skills/webapp-testing/SKILL.md` | Playwright workflow skill |

## Course context

This repo is used across Day 1 modules:

- **Module 1** — completions and inline chat on `src/middleware/validation.ts`
- **Module 2** — agent mode to add the `dueDate` feature and run–test–fix
- **Module 3** — AGENTS.md, `/commit`, `/review`, scoped instructions
- **Module 4** — plan → phases → tracer bullet for the `/stats` endpoint

## License

MIT
