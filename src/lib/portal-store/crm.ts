import { ensureSchema, sql } from "@/lib/portal-store/db";
import { isCrmPriority, type CrmPriority } from "@/lib/crm-attention";

export type CrmWorkflow = {
  studentId: string;
  caseOfficer: string;
  priority: CrmPriority;
  nextAction: string;
  nextActionDue: string | null;
  updatedAt: string | null;
};

export type CrmNote = {
  id: string;
  studentId: string;
  body: string;
  createdAt: string;
};

export type CrmTask = {
  id: string;
  studentId: string;
  title: string;
  dueDate: string | null;
  priority: CrmPriority;
  status: "open" | "done";
  createdAt: string;
  completedAt: string | null;
};

export type CrmEvent = {
  id: string;
  studentId: string;
  at: string;
  kind: string;
  summary: string;
};

function iso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function priority(value: string): CrmPriority {
  return isCrmPriority(value) ? value : "normal";
}

export async function listWorkflows(): Promise<CrmWorkflow[]> {
  await ensureSchema();
  const rows = await sql()<{
    student_id: string;
    case_officer: string;
    priority: string;
    next_action: string;
    next_action_due: string | null;
    updated_at: Date | string;
  }[]>`
    SELECT student_id, case_officer, priority, next_action,
      to_char(next_action_due, 'YYYY-MM-DD') AS next_action_due,
      updated_at
    FROM crm_cases
  `;
  return rows.map((row) => ({
    studentId: row.student_id,
    caseOfficer: row.case_officer,
    priority: priority(row.priority),
    nextAction: row.next_action,
    nextActionDue: row.next_action_due,
    updatedAt: iso(row.updated_at),
  }));
}

export async function listOpenTasks(): Promise<CrmTask[]> {
  await ensureSchema();
  const rows = await sql()<TaskRow[]>`
    SELECT id, student_id, title, to_char(due_date, 'YYYY-MM-DD') AS due_date,
      priority, status, created_at, completed_at
    FROM crm_tasks
    WHERE status = 'open'
  `;
  return rows.map(mapTask);
}

async function recordEvent(studentId: string, kind: string, summary: string) {
  await sql()`
    INSERT INTO crm_events (id, student_id, at, kind, summary)
    VALUES (${crypto.randomUUID()}, ${studentId}, ${new Date().toISOString()}, ${kind}, ${summary.slice(0, 300)})
  `;
}

export async function saveWorkflow(input: {
  studentId: string;
  caseOfficer: string;
  priority: CrmPriority;
  nextAction: string;
  nextActionDue: string | null;
}) {
  await ensureSchema();
  const current = (await listWorkflows()).find((row) => row.studentId === input.studentId) ?? null;
  const now = new Date().toISOString();
  await sql()`
    INSERT INTO crm_cases (student_id, case_officer, priority, next_action, next_action_due, updated_at)
    VALUES (
      ${input.studentId},
      ${input.caseOfficer},
      ${input.priority},
      ${input.nextAction},
      ${input.nextActionDue},
      ${now}
    )
    ON CONFLICT (student_id) DO UPDATE SET
      case_officer = EXCLUDED.case_officer,
      priority = EXCLUDED.priority,
      next_action = EXCLUDED.next_action,
      next_action_due = EXCLUDED.next_action_due,
      updated_at = EXCLUDED.updated_at
  `;
  if ((current?.caseOfficer ?? "") !== input.caseOfficer) {
    await recordEvent(input.studentId, "officer", input.caseOfficer ? `Case officer set to ${input.caseOfficer}` : "Case officer cleared");
  }
  if ((current?.priority ?? "normal") !== input.priority) {
    await recordEvent(input.studentId, "priority", `Priority set to ${input.priority}`);
  }
  if ((current?.nextAction ?? "") !== input.nextAction || (current?.nextActionDue ?? null) !== input.nextActionDue) {
    await recordEvent(
      input.studentId,
      "next-action",
      input.nextAction
        ? `Next action: ${input.nextAction}${input.nextActionDue ? ` (due ${input.nextActionDue})` : ""}`
        : "Next action cleared",
    );
  }
}

export async function addNote(studentId: string, body: string) {
  await ensureSchema();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await sql()`
    INSERT INTO crm_notes (id, student_id, body, created_at)
    VALUES (${id}, ${studentId}, ${body}, ${createdAt})
  `;
  await recordEvent(studentId, "note", "Internal note added");
  return { id, studentId, body, createdAt };
}

type TaskRow = {
  id: string;
  student_id: string;
  title: string;
  due_date: string | null;
  priority: string;
  status: string;
  created_at: Date | string;
  completed_at: Date | string | null;
};

function mapTask(row: TaskRow): CrmTask {
  return {
    id: row.id,
    studentId: row.student_id,
    title: row.title,
    dueDate: row.due_date,
    priority: priority(row.priority),
    status: row.status === "done" ? "done" : "open",
    createdAt: iso(row.created_at) ?? "",
    completedAt: iso(row.completed_at),
  };
}

export async function addTask(input: { studentId: string; title: string; dueDate: string | null; priority: CrmPriority }) {
  await ensureSchema();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await sql()`
    INSERT INTO crm_tasks (id, student_id, title, due_date, priority, status, created_at)
    VALUES (${id}, ${input.studentId}, ${input.title}, ${input.dueDate}, ${input.priority}, ${"open"}, ${createdAt})
  `;
  await recordEvent(input.studentId, "task", `Task added: ${input.title}`);
  return id;
}

export async function completeTask(studentId: string, taskId: string) {
  await ensureSchema();
  const rows = await sql()<{ title: string }[]>`
    UPDATE crm_tasks
    SET status = 'done', completed_at = ${new Date().toISOString()}
    WHERE id = ${taskId} AND student_id = ${studentId} AND status = 'open'
    RETURNING title
  `;
  if (!rows.length) return false;
  await recordEvent(studentId, "task", `Task completed: ${rows[0].title}`);
  return true;
}

export async function notesFor(studentId: string): Promise<CrmNote[]> {
  await ensureSchema();
  const rows = await sql()<{ id: string; student_id: string; body: string; created_at: Date | string }[]>`
    SELECT id, student_id, body, created_at
    FROM crm_notes
    WHERE student_id = ${studentId}
    ORDER BY created_at DESC
  `;
  return rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    body: row.body,
    createdAt: iso(row.created_at) ?? "",
  }));
}

export async function tasksFor(studentId: string) {
  await ensureSchema();
  const rows = await sql()<TaskRow[]>`
    SELECT id, student_id, title, to_char(due_date, 'YYYY-MM-DD') AS due_date,
      priority, status, created_at, completed_at
    FROM crm_tasks
    WHERE student_id = ${studentId}
    ORDER BY created_at DESC
  `;
  return rows.map(mapTask);
}

export async function eventsFor(studentId: string): Promise<CrmEvent[]> {
  await ensureSchema();
  const rows = await sql()<{ id: string; student_id: string; at: Date | string; kind: string; summary: string }[]>`
    SELECT id, student_id, at, kind, summary
    FROM crm_events
    WHERE student_id = ${studentId}
    ORDER BY at DESC
    LIMIT 40
  `;
  return rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    at: iso(row.at) ?? "",
    kind: row.kind,
    summary: row.summary,
  }));
}
