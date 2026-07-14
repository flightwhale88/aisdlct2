import { createApp } from "./app";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const app  = createApp();

app.listen(PORT, () => {
  console.log(`TaskBoard API running on http://localhost:${PORT}`);
  console.log(`  GET  /health`);
  console.log(`  GET  /tasks`);
  console.log(`  POST /tasks`);
  console.log(`  GET  /tasks/:id`);
  console.log(`  PATCH /tasks/:id`);
  console.log(`  DELETE /tasks/:id`);
});
