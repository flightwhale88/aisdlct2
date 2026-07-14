# TaskBoard API Reference

Base URL: `http://localhost:3000`

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns `{ status: "ok", timestamp }` |

## Tasks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks` | List all tasks. Accepts `?status=` and `?priority=` filters. |
| GET | `/tasks/:id` | Get a single task by ID. |
| POST | `/tasks` | Create a new task. |
| PATCH | `/tasks/:id` | Partially update a task. |
| DELETE | `/tasks/:id` | Delete a task. Returns 204. |

### Task object

```json
{
  "id": "uuid",
  "title": "string",
  "description": "string (optional)",
  "status": "todo | in-progress | done",
  "priority": "low | medium | high",
  "tags": ["string"],
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

### POST /tasks body

```json
{ "title": "required", "description": "optional", "priority": "optional", "tags": [] }
```

### PATCH /tasks/:id body

Any subset of: `title`, `description`, `status`, `priority`, `tags`.

### Error shape

```json
{ "error": "human-readable message" }
```

### HTTP status codes used

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | Deleted (no body) |
| 400 | Bad request (validation error) |
| 404 | Task not found |
