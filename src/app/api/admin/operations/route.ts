import { NextRequest, NextResponse } from "next/server";
import { reviewNotice } from "@/lib/notifications/copy";
import { recordAudit } from "@/lib/portal-store/audit";
import { notifyStudent } from "@/lib/portal-store/notifications";
import {
  currentReviewStatus,
  documentFile,
  listDocumentQueue,
  listServices,
  REVIEW_STATUSES,
  reviewDocument,
  updateService,
  type ReviewStatus,
} from "@/lib/portal-store/operations";
import {
  assertTrustedOrigin,
  clientIp,
  forbiddenOrigin,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/security";
import { actorFromRequest, requireStaff } from "@/lib/staff-access";
import { canReviewDocument } from "@/lib/staff-roles";

function clean(value: unknown, max: number) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

export async function GET(req: NextRequest) {
  if (!rateLimit(`ops-get:${clientIp(req)}`, 40)) return rateLimitedResponse();
  const queue = req.nextUrl.searchParams.get("queue") || "documents";
  if (queue === "services") {
    if (!(await requireStaff(req, "services")) && !(await requireStaff(req, "staff"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ services: await listServices(false) });
  }
  if (queue === "payments") {
    if (!(await requireStaff(req, "payments"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ documents: await listDocumentQueue("payment-proof") });
  }
  if (!(await requireStaff(req, "documents"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const documents = (await listDocumentQueue()).filter((item) => item.kind !== "payment-proof");
  return NextResponse.json({ documents });
}

export async function POST(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`ops-post:${clientIp(req)}`, 30)) return rateLimitedResponse();
  let body: { action?: string; documentId?: string; status?: string; note?: string; id?: string; kicker?: string; title?: string; detail?: string; active?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "review") {
    const documentId = clean(body.documentId, 80);
    const status = clean(body.status, 40);
    if (!(REVIEW_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "Choose a review status." }, { status: 400 });
    }
    const file = await documentFile(documentId);
    if (!file) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    const area = file.kind === "payment-proof" ? "payments" : "documents";
    const actor = await requireStaff(req, area);
    if (!actor || !canReviewDocument(actor.role, file.kind)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const previous = await currentReviewStatus(documentId);
    await reviewDocument({ documentId, status: status as ReviewStatus, note: clean(body.note, 500), reviewer: actor.label });
    if (previous !== status) {
      const notice = reviewNotice({ kind: file.kind, status: status as ReviewStatus, note: clean(body.note, 500) });
      if (notice) {
        await notifyStudent({
          studentId: file.student_id,
          ...notice,
          staffId: actor.staffId,
          dedupeKey: `review:${documentId}:${status}`,
        });
      }
    }
    const full = await actorFromRequest(req);
    if (full) {
      await recordAudit({
        staffId: full.staffId,
        actorLabel: full.label,
        action: file.kind === "payment-proof" ? "payment_reviewed" : "document_reviewed",
        entityType: "document",
        entityId: documentId,
        metadata: { status, kind: file.kind },
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "service") {
    if (!(await requireStaff(req, "services"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const saved = await updateService({
      id: clean(body.id, 80),
      kicker: clean(body.kicker, 40),
      title: clean(body.title, 160),
      detail: clean(body.detail, 400),
      active: Boolean(body.active),
    });
    if (!saved) return NextResponse.json({ error: "Service not found." }, { status: 404 });
    const actor = await actorFromRequest(req);
    if (actor) {
      await recordAudit({
        staffId: actor.staffId,
        actorLabel: actor.label,
        action: body.active === false ? "service_paused" : "service_edited",
        entityType: "service",
        entityId: clean(body.id, 80),
        metadata: { title: clean(body.title, 120) },
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
