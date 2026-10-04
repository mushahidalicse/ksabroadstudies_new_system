import { NextRequest, NextResponse } from "next/server";
import { getCatalogue } from "@/lib/data";
import { getApplicationsForStudent } from "@/lib/applications";
import { fillTemplate } from "@/lib/notifications/placeholders";
import { recentNotifications, notifyStudent } from "@/lib/portal-store/notifications";
import { listWorkflows } from "@/lib/portal-store/crm";
import { listTemplates, saveTemplate } from "@/lib/portal-store/templates";
import { recordAudit } from "@/lib/portal-store/audit";
import { staffReminderCounts } from "@/lib/reminders/generate";
import {
  assertTrustedOrigin,
  clientIp,
  forbiddenOrigin,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/security";
import { actorFromRequest, requireStaff } from "@/lib/staff-access";
import { canSendMessage, type MessageChannel } from "@/lib/staff-roles";
import { getStudentById } from "@/lib/students";
import { formatAdmissionDate } from "@/lib/utils";

function clean(value: unknown, max: number) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

function safeLink(value: unknown) {
  const link = clean(value, 200);
  if (!link) return "";
  if (!link.startsWith("/") || link.startsWith("//") || link.startsWith("/admin") || link.startsWith("/api")) return "";
  return link;
}

function channelForCategory(category: string): MessageChannel {
  if (category === "document") return "document";
  if (category === "payment") return "payment";
  return "general";
}

async function contextFor(studentId: string) {
  const student = await getStudentById(studentId);
  if (!student) return null;
  const [applications, workflows, catalogue] = await Promise.all([
    getApplicationsForStudent(studentId),
    listWorkflows(),
    getCatalogue().catch(() => []),
  ]);
  const workflow = workflows.find((row) => row.studentId === studentId);
  const saved = student.shortlist?.[0];
  const card = saved ? catalogue.find((item) => item.slug === saved.slug) : undefined;
  const deadline = card && !card.estimatedDeadline && (card.finderStatus === "open" || card.finderStatus === "closing")
    ? formatAdmissionDate(card.deadline)
    : "";
  return {
    student_name: [student.name, student.surname].filter(Boolean).join(" "),
    programme_name: applications[0]?.programName || card?.name || "",
    university_name: applications[0]?.universityName || card?.universityName || "",
    deadline: deadline === "Check portal" ? "" : deadline,
    case_officer: workflow?.caseOfficer || "",
  };
}

export async function GET(req: NextRequest) {
  if (!rateLimit(`comms-get:${clientIp(req)}`, 40)) return rateLimitedResponse();
  const actor = await actorFromRequest(req);
  if (!actor || (actor.role !== "owner" && actor.role !== "case_officer")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [reminders, recent, templates] = await Promise.all([
    staffReminderCounts(),
    recentNotifications(40),
    listTemplates(actor.role !== "owner"),
  ]);
  return NextResponse.json({
    reminders,
    recent,
    templates,
    legacyFallback: actor.label === "Legacy local admin fallback",
  });
}

export async function POST(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`comms-post:${clientIp(req)}`, 30)) return rateLimitedResponse();
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = clean(body.action, 40);
  if (action === "template") {
    if (!(await requireStaff(req, "templates"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const actor = await actorFromRequest(req);
    const id = await saveTemplate({
      id: clean(body.id, 80) || undefined,
      name: clean(body.name, 120),
      category: clean(body.category, 40),
      title: clean(body.title, 160),
      body: clean(body.body, 2000),
      active: body.active !== false,
    });
    if (!id || !actor) return NextResponse.json({ error: "Could not save that template." }, { status: 400 });
    await recordAudit({
      staffId: actor.staffId,
      actorLabel: actor.label,
      action: "template_changed",
      entityType: "message_template",
      entityId: id,
      metadata: { name: clean(body.name, 120) },
    });
    return NextResponse.json({ ok: true, id });
  }

  if (action !== "message") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const actor = await actorFromRequest(req);
  const channel = clean(body.channel, 20) as MessageChannel;
  if (!actor || !canSendMessage(actor.role, channel)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const studentId = clean(body.studentId, 80);
  const context = await contextFor(studentId);
  if (!context) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  if (body.templateCategory) {
    const expected = channelForCategory(clean(body.templateCategory, 40));
    if (expected !== channel) return NextResponse.json({ error: "That template is outside this role." }, { status: 403 });
  }
  const title = fillTemplate(clean(body.title, 160), context);
  const message = fillTemplate(clean(body.message, 2000), context);
  const missing = [...new Set([...title.missing, ...message.missing])];
  if (missing.length && body.confirmMissing !== true) {
    return NextResponse.json({ error: `Some placeholders have no value: ${missing.join(", ")}`, missing }, { status: 409 });
  }
  if (!message.text) return NextResponse.json({ error: "Write a message before sending." }, { status: 400 });
  const saved = await notifyStudent({
    studentId,
    type: "staff_message",
    title: title.text || "Message from KS Abroad",
    message: message.text,
    link: safeLink(body.link) || "/portal",
    staffId: actor.staffId,
  });
  await recordAudit({
    staffId: actor.staffId,
    actorLabel: actor.label,
    action: "student_message_sent",
    entityType: "student",
    entityId: studentId,
    metadata: { channel, title: title.text.slice(0, 120) },
  });
  return NextResponse.json({ ok: true, id: saved.notification?.id ?? null });
}
