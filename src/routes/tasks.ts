import { Router, Request, Response } from "express";
import { store } from "../store";
import { validateCreateTask, validateUpdateTask } from "../middleware/validation";

const router = Router();

// GET /tasks — list all tasks, optional ?status= and ?priority= filters
router.get("/", (req: Request, res: Response) => {
  let tasks = store.getAll();

  const { status, priority } = req.query;
  if (typeof status === "string") {
    tasks = tasks.filter((t) => t.status === status);
  }
  if (typeof priority === "string") {
    tasks = tasks.filter((t) => t.priority === priority);
  }

  res.json({ tasks, count: tasks.length });
});

// GET /tasks/:id
router.get("/:id", (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const task = store.getById(id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(task);
});

// POST /tasks — create
router.post("/", validateCreateTask, (req: Request, res: Response) => {
  const task = store.create(req.body);
  res.status(201).json(task);
});

// PATCH /tasks/:id — partial update
router.patch("/:id", validateUpdateTask, (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const task = store.update(id, req.body);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(task);
});

// DELETE /tasks/:id
router.delete("/:id", (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deleted = store.delete(id);
  if (!deleted) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.status(204).send();
});

export { router as taskRouter };
