import { NextRequest, NextResponse } from "next/server";
import {
  APPLICATION_STATUSES,
  applicationStatusLabel,
  getApplications,
  type ApplicationStatus,
  updateApplicationStatus,
} from "@/lib/applications";
import {
  assertTrustedOrigin,
  clientIp,
  forbiddenOrigin,
  rateLimit,
  rateLimitedResponse,
  safeEqualString,
} from "@/lib/security";
import { getStudents, toPublic } from "@/lib/students";

function authorized(req: NextRequest) {
  const password = req.headers.get("x-admin-password") || "";
  const expected =
    process.env.ADMIN_PASSWORD ||
    (process.env.NODE_ENV === "production" ? "" : "ksabroad2027");
  if (!expected || !password) return false;
  return safeEqualString(password, expected);
}

export async function GET(req: NextRequest) {
  if (!rateLimit(`admin-apps-get:${clientIp(req)}`, 20)) return rateLimitedResponse();
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [applications, students] = await Promise.all([
    getApplications(),
    getStudents(),
  ]);
  const byId = new Map(students.map((s) => [s.id, toPublic(s)]));

  const rows = applications
    .map((app) => {
      const student = byId.get(app.studentId);
      return {
        ...app,
        statusLabel: applicationStatusLabel(app.status),
        studentName: student?.name ?? "Unknown",
        studentEmail: student?.email ?? "",
        studentPhone: student?.phone ?? "",
        documents: student?.documents ?? [],
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return NextResponse.json({
    applications: rows,
    statuses: APPLICATION_STATUSES,
  });
}

export async function PUT(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`admin-apps-put:${clientIp(req)}`, 20)) return rateLimitedResponse();
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    id?: string;
    status?: ApplicationStatus;
    staffNote?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id || !body.status) {
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  }
  if (!APPLICATION_STATUSES.some((s) => s.id === body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await updateApplicationStatus({
    id: body.id,
    status: body.status,
    staffNote: body.staffNote,
  });
  if (!updated) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    application: {
      ...updated,
      statusLabel: applicationStatusLabel(updated.status),
    },
  });
}
