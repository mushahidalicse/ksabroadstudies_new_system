import http from "node:http";
import { attentionReasons } from "../src/lib/crm-attention";
import { addNote, addTask, completeTask, listWorkflows, notesFor, saveWorkflow, tasksFor } from "../src/lib/portal-store/crm";
import { EMPTY_PROFILE } from "../src/lib/student-types";
import { removeStudent, upsertStudent } from "../src/lib/students";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const due = attentionReasons({
  priority: "urgent",
  nextAction: "Call the student",
  nextActionDue: "2026-09-01",
  openTaskOverdue: true,
  openConsultancy: true,
  applicationNeedsStaff: true,
  today: "2026-09-24",
});
assert(due.length === 5, "an overdue active case should need attention");
assert(
  attentionReasons({
    priority: "normal",
    nextAction: "",
    nextActionDue: null,
    openTaskOverdue: false,
    openConsultancy: false,
    applicationNeedsStaff: false,
    today: "2026-09-24",
  }).length === 0,
  "a quiet record is not flagged",
);

async function main() {
const id = crypto.randomUUID();
const email = `phase3a-${id.slice(0, 8)}@example.com`;
await upsertStudent({
  id,
  email,
  passwordHash: "test-hash-not-used",
  name: "Phase",
  surname: "Three",
  dateOfBirth: "",
  placeOfBirth: "",
  passportOrCnic: "",
  phone: "",
  currentCity: "",
  address: "",
  createdAt: new Date().toISOString(),
  profile: { ...EMPTY_PROFILE },
  documents: [],
  shortlist: [],
});

try {
  await saveWorkflow({
    studentId: id,
    caseOfficer: "Faizan",
    priority: "high",
    nextAction: "Review documents",
    nextActionDue: "2026-09-20",
  });
  const note = await addNote(id, "Internal only. Do not show this on the portal.");
  assert(!JSON.stringify(note).includes("password"), "a note does not store a password");
  const taskId = await addTask({ studentId: id, title: "Request transcript", dueDate: "2026-09-20", priority: "normal" });
  const open = await tasksFor(id);
  assert(open.some((task) => task.id === taskId && task.status === "open"), "task is stored");
  assert(await completeTask(id, taskId), "task can be completed");
  const done = await tasksFor(id);
  assert(done.find((task) => task.id === taskId)?.status === "done", "completed task stays on the student");
  const workflow = (await listWorkflows()).find((row) => row.studentId === id);
  assert(workflow?.caseOfficer === "Faizan" && workflow.priority === "high", "case officer and priority are stored");
  assert((await notesFor(id)).some((row) => row.body.includes("Internal only")), "note is stored against the student");
} finally {
  await removeStudent(id);
}

assert(!(await listWorkflows()).some((row) => row.studentId === id), "deleting the student removes the CRM row");
assert((await notesFor(id)).length === 0, "deleting the student removes internal notes");

const denied = await new Promise<number>((resolve, reject) => {
  const req = http.request(
    { hostname: "127.0.0.1", port: 43127, path: "/api/admin/crm", method: "GET", headers: { Connection: "close" } },
    (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode ?? 0));
    },
  );
  req.on("error", reject);
  req.end();
});
assert(denied === 401, `CRM without the admin password returned ${denied}`);

console.log("phase 3a checks passed");
process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
