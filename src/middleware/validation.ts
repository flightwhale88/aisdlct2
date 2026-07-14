import { Request, Response, NextFunction } from "express";
import { CreateTaskBody, UpdateTaskBody, Priority, Status } from "../types/task";

const PRIORITIES: Priority[] = ["low", "medium", "high"];
const STATUSES: Status[]     = ["todo", "in-progress", "done"];

export function validateCreateTask(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = req.body as CreateTaskBody;

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    res.status(400).json({ error: "title is required and must be a non-empty string" });
    return;
  }
  if (body.priority !== undefined && !PRIORITIES.includes(body.priority)) {
    res.status(400).json({ error: `priority must be one of: ${PRIORITIES.join(", ")}` });
    return;
  }
  if (body.tags !== undefined && !Array.isArray(body.tags)) {
    res.status(400).json({ error: "tags must be an array of strings" });
    return;
  }
  next();
}

export function validateUpdateTask(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = req.body as UpdateTaskBody;

  if (body.status !== undefined && !STATUSES.includes(body.status)) {
    res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` });
    return;
  }
  if (body.priority !== undefined && !PRIORITIES.includes(body.priority)) {
    res.status(400).json({ error: `priority must be one of: ${PRIORITIES.join(", ")}` });
    return;
  }
  if (body.tags !== undefined && !Array.isArray(body.tags)) {
    res.status(400).json({ error: "tags must be an array of strings" });
    return;
  }
  next();
}
