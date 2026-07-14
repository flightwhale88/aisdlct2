import express from "express";
import { taskRouter } from "./routes/tasks";

export function createApp(): express.Application {
  const app = express();
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/tasks", taskRouter);

  return app;
}
