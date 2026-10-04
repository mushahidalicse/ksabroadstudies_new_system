import { NextRequest, NextResponse } from "next/server";
import { APPLICATION_STATUSES, applicationStatusLabel, studentStatusLabel } from "@/lib/application-types";
import { buildPackForStudent, getApplicationById, getApplications, getApplicationsForStudent, packSummary, updateApplicationStatus } from "@/lib/applications";
import { applicationNotice, consultancyNotice } from "@/lib/notifications/copy";
import { communicationHistory } from "@/lib/notifications/history";
import { recordAudit } from "@/lib/portal-store/audit";
import { notifyStudent } from "@/lib/portal-store/notifications";
import { attentionReasons, applicationNeedsStaff, isCrmPriority } from "@/lib/crm-attention";
import { addStaffReply, getCases, getCasesForStudent, updateCaseStatus } from "@/lib/consultancy";
import type { ConsultancyStatus } from "@/lib/consultancy-types";
import { getCatalogue } from "@/lib/data";
import { DOCUMENT_KINDS } from "@/lib/student-types";
import { profileCompleteness } from "@/lib/matching/profile-completeness";
import { matchProgrammes } from "@/lib/matching/programme-match";
import {
  addNote,
  addTask,
  completeTask,
  eventsFor,
  listOpenTasks,
  listWorkflows,
  notesFor,
  saveWorkflow,
  tasksFor,
} from "@/lib/portal-store/crm";
import {
  assertTrustedOrigin,
  clientIp,
  forbiddenOrigin,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/security";
import { actorFromRequest } from "@/lib/staff-access";
import { roleAllows } from "@/lib/staff-roles";
import { getStudentById, getStudents, toPublic } from "@/lib/students";

async function authorized(req: NextRequest) {
  const actor = await actorFromRequest(req);
  return Boolean(actor && roleAllows(actor.role, "crm"));
}

function clean(value: unknown, max: number) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function due(value: unknown) {
  const text = clean(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export async function GET(req: NextRequest) {
  if (!rateLimit(`admin-crm-get:${clientIp(req)}`, 30)) return rateLimitedResponse();
  if (!(await authorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const studentId = req.nextUrl.searchParams.get("student") || "";
  if (studentId) {
    const payload = await detail(studentId);
    if (!payload) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    return NextResponse.json(payload);
  }
  return NextResponse.json(await directory(req));
}

async function directory(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const query = (params.get("q") || "").toLowerCase();
  const [students, workflows, tasks, cases, applications] = await Promise.all([
    getStudents(),
    listWorkflows(),
    listOpenTasks(),
    getCases(),
    getApplications(),
  ]);
  const workflowByStudent = new Map(workflows.map((row) => [row.studentId, row]));
  const day = today();
  const rows = students.map((student) => {
    const workflow = workflowByStudent.get(student.id);
    const ownCases = cases.filter((item) => item.studentId === student.id);
    const ownApplications = applications.filter((item) => item.studentId === student.id);
    const ownTasks = tasks.filter((item) => item.studentId === student.id);
    const reasons = attentionReasons({
      priority: workflow?.priority ?? "normal",
      nextAction: workflow?.nextAction ?? "",
      nextActionDue: workflow?.nextActionDue ?? null,
      openTaskOverdue: ownTasks.some((task) => task.dueDate && task.dueDate <= day),
      openConsultancy: ownCases.some((item) => item.status === "open" || item.status === "in_progress"),
      applicationNeedsStaff: ownApplications.some((item) => applicationNeedsStaff(item.status)),
      today: day,
    });
    return {
      id: student.id,
      name: `${student.name} ${student.surname}`.trim(),
      email: student.email,
      phone: student.phone,
      caseOfficer: workflow?.caseOfficer ?? "",
      priority: workflow?.priority ?? "normal",
      nextAction: workflow?.nextAction ?? "",
      nextActionDue: workflow?.nextActionDue ?? null,
      openTasks: ownTasks.length,
      consultancy: ownCases.filter((item) => item.status !== "closed").length,
      applications: ownApplications.length,
      reasons,
    };
  });
  const filtered = rows.filter((row) => {
    if (query && !`${row.name} ${row.email} ${row.caseOfficer}`.toLowerCase().includes(query)) return false;
    if (params.get("priority") && row.priority !== params.get("priority")) return false;
    if (params.get("officer") && !row.caseOfficer.toLowerCase().includes((params.get("officer") || "").toLowerCase())) return false;
    if (params.get("attention") === "1" && row.reasons.length === 0) return false;
    return true;
  });
  filtered.sort((a, b) => b.reasons.length - a.reasons.length || a.name.localeCompare(b.name));
  return {
    today: day,
    counts: {
      students: rows.length,
      needsAttention: rows.filter((row) => row.reasons.length > 0).length,
      openTasks: tasks.length,
      activeConsultancy: cases.filter((item) => item.status !== "closed").length,
      waitingApplications: applications.filter((item) => applicationNeedsStaff(item.status)).length,
    },
    rows: filtered,
  };
}

async function detail(studentId: string) {
  const student = await getStudentById(studentId);
  if (!student) return null;
  const publicStudent = toPublic(student);
  const [cases, applications, notes, tasks, events, catalogue] = await Promise.all([
    getCasesForStudent(studentId),
    getApplicationsForStudent(studentId),
    notesFor(studentId),
    tasksFor(studentId),
    eventsFor(studentId),
    getCatalogue(),
  ]);
  const workflow = (await listWorkflows()).find((row) => row.studentId === studentId) ?? {
    studentId,
    caseOfficer: "",
    priority: "normal" as const,
    nextAction: "",
    nextActionDue: null,
    updatedAt: null,
  };
  const pack = packSummary(buildPackForStudent(publicStudent));
  const bySlug = new Map(catalogue.map((card) => [card.slug, card]));
  const matches = matchProgrammes(publicStudent.profile, catalogue, { limit: 5 }).matches.map((match) => ({
    slug: match.slug,
    name: match.name,
    universityName: match.universityName,
    category: match.category,
    englishLine: match.englishLine,
    tuitionLine: match.tuitionLine,
  }));
  const timeline = [
    { at: student.createdAt, kind: "account", summary: "Student account created" },
    ...cases.flatMap((item) => [
      { at: item.createdAt, kind: "consultancy", summary: `Consultancy opened: ${item.topic} (${item.status})` },
      ...item.replies.map((reply) => ({
        at: reply.at,
        kind: "consultancy",
        summary: `${reply.from === "staff" ? "Staff" : "Student"} reply on ${item.topic}`,
      })),
    ]),
    ...applications.flatMap((item) => [
      { at: item.createdAt, kind: "application", summary: `Application opened: ${item.programName}` },
      ...item.history.map((event) => ({
        at: event.at,
        kind: "application",
        summary: `${item.programName}: ${applicationStatusLabel(event.status)}`,
      })),
    ]),
    ...publicStudent.documents.map((doc) => ({
      at: doc.uploadedAt,
      kind: "document",
      summary: `Document uploaded: ${DOCUMENT_KINDS.find((kind) => kind.id === doc.kind)?.label ?? doc.kind}`,
    })),
    ...(publicStudent.shortlist ?? []).map((item) => ({
      at: item.savedAt,
      kind: "shortlist",
      summary: `Shortlisted ${bySlug.get(item.slug)?.name ?? item.slug}`,
    })),
    ...notes.map((note) => ({ at: note.createdAt, kind: "note", summary: "Internal note added" })),
    ...tasks.map((task) => ({
      at: task.completedAt ?? task.createdAt,
      kind: "task",
      summary: task.status === "done" ? `Task completed: ${task.title}` : `Task added: ${task.title}`,
    })),
    ...events
      .filter((event) => event.kind !== "note" && event.kind !== "task")
      .map((event) => ({ at: event.at, kind: event.kind, summary: event.summary })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 40);
  return {
    student: {
      id: publicStudent.id,
      name: publicStudent.name,
      surname: publicStudent.surname,
      email: publicStudent.email,
      phone: publicStudent.phone,
      currentCity: publicStudent.currentCity,
      createdAt: publicStudent.createdAt,
    },
    completeness: profileCompleteness(publicStudent.profile),
    workflow,
    notes,
    tasks,
    cases,
    applications: applications.map((item) => ({
      id: item.id,
      universityName: item.universityName,
      programName: item.programName,
      status: item.status,
      statusLabel: applicationStatusLabel(item.status),
      staffNote: item.staffNote,
      updatedAt: item.updatedAt,
    })),
    documents: {
      readyCount: pack.readyCount,
      requiredCount: pack.requiredCount,
      complete: pack.complete,
      items: pack.items.map((item) => ({ label: item.label, required: item.required, present: item.present })),
    },
    shortlist: (publicStudent.shortlist ?? []).map((item) => ({
      slug: item.slug,
      name: bySlug.get(item.slug)?.name ?? item.slug,
      universityName: bySlug.get(item.slug)?.universityName ?? "",
      savedAt: item.savedAt,
    })),
    matches,
    timeline,
    communication: await communicationHistory(studentId),
    statuses: APPLICATION_STATUSES,
  };
}

export async function POST(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`admin-crm-post:${clientIp(req)}`, 30)) return rateLimitedResponse();
  if (!(await authorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = clean(body.action, 40);
  const studentId = clean(body.studentId, 80);
  const actor = await actorFromRequest(req);
  if (action === "workflow") {
    if (!studentId || !(await getStudentById(studentId))) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    const level = clean(body.priority, 20);
    if (!isCrmPriority(level)) return NextResponse.json({ error: "Priority is not recognised." }, { status: 400 });
    await saveWorkflow({
      studentId,
      caseOfficer: clean(body.caseOfficer, 80),
      priority: level,
      nextAction: clean(body.nextAction, 240),
      nextActionDue: due(body.nextActionDue),
    });
    if (actor) {
      await recordAudit({ staffId: actor.staffId, actorLabel: actor.label, action: "crm_case_changed", entityType: "student", entityId: studentId, metadata: { priority: level } });
    }
    return NextResponse.json({ ok: true });
  }
  if (action === "note") {
    const text = clean(body.body, 2000);
    if (!text) return NextResponse.json({ error: "Write a note before saving." }, { status: 400 });
    if (!(await getStudentById(studentId))) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    await addNote(studentId, text);
    if (actor) {
      await recordAudit({ staffId: actor.staffId, actorLabel: actor.label, action: "internal_note_added", entityType: "student", entityId: studentId, metadata: { stored: "internal" } });
    }
    return NextResponse.json({ ok: true });
  }
  if (action === "task") {
    const title = clean(body.title, 180);
    const level = clean(body.priority, 20) || "normal";
    if (!title) return NextResponse.json({ error: "A task needs a title." }, { status: 400 });
    if (!isCrmPriority(level)) return NextResponse.json({ error: "Priority is not recognised." }, { status: 400 });
    if (!(await getStudentById(studentId))) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    await addTask({ studentId, title, dueDate: due(body.dueDate), priority: level });
    if (actor) {
      await recordAudit({ staffId: actor.staffId, actorLabel: actor.label, action: "task_changed", entityType: "student", entityId: studentId, metadata: { title } });
    }
    return NextResponse.json({ ok: true });
  }
  if (action === "complete-task") {
    const done = await completeTask(studentId, clean(body.taskId, 80));
    if (!done) return NextResponse.json({ error: "Open task not found." }, { status: 404 });
    if (actor) {
      await recordAudit({ staffId: actor.staffId, actorLabel: actor.label, action: "task_changed", entityType: "student", entityId: studentId, metadata: { completed: true } });
    }
    return NextResponse.json({ ok: true });
  }
  if (action === "case-status") {
    const status = clean(body.status, 20);
    if (status !== "open" && status !== "in_progress" && status !== "closed") {
      return NextResponse.json({ error: "Consultancy status is not recognised." }, { status: 400 });
    }
    const updated = await updateCaseStatus(clean(body.caseId, 80), status as ConsultancyStatus);
    if (!updated) return NextResponse.json({ error: "Case not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  if (action === "case-reply") {
    const reply = clean(body.reply, 2000);
    const updated = await addStaffReply(clean(body.caseId, 80), reply);
    if (!updated) return NextResponse.json({ error: "Case not found." }, { status: 404 });
    if (reply) {
      const notice = consultancyNotice();
      await notifyStudent({ studentId: updated.studentId, ...notice });
      if (actor) {
        await recordAudit({ staffId: actor.staffId, actorLabel: actor.label, action: "consultancy_reply", entityType: "consultancy_case", entityId: updated.id, metadata: { studentId: updated.studentId } });
      }
    }
    return NextResponse.json({ ok: true });
  }
  if (action === "application-status") {
    const status = clean(body.status, 40);
    if (!APPLICATION_STATUSES.some((item) => item.id === status)) {
      return NextResponse.json({ error: "Application status is not recognised." }, { status: 400 });
    }
    const applicationId = clean(body.applicationId, 80);
    const previous = await getApplicationById(applicationId);
    const updated = await updateApplicationStatus({
      id: applicationId,
      status: status as (typeof APPLICATION_STATUSES)[number]["id"],
      staffNote: clean(body.staffNote, 2000),
    });
    if (!updated) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (previous && previous.status !== updated.status) {
      const notice = applicationNotice(studentStatusLabel(updated.status));
      await notifyStudent({ studentId: updated.studentId, ...notice, dedupeKey: `application:${updated.id}:${updated.status}` });
    }
    if (actor) {
      await recordAudit({ staffId: actor.staffId, actorLabel: actor.label, action: "application_status_changed", entityType: "application", entityId: updated.id, metadata: { status: updated.status } });
    }
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
