export type Priority = "low" | "medium" | "high";
export type Status   = "todo" | "in-progress" | "done";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  tags: string[];
  createdAt: string;  // ISO-8601
  updatedAt: string;
}

// Shape accepted on POST /tasks
export interface CreateTaskBody {
  title: string;
  description?: string;
  priority?: Priority;
  tags?: string[];
}

// Shape accepted on PATCH /tasks/:id
export interface UpdateTaskBody {
  title?: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  tags?: string[];
}
