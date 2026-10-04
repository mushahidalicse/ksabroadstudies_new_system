import { NextRequest, NextResponse } from "next/server";
import {
  addStaffReply,
  getCases,
  updateCaseStatus,
  type ConsultancyStatus,
} from "@/lib/consultancy";
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

function clean(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, max);
}

export async function GET(req: NextRequest) {
  if (!rateLimit(`admin-cases-get:${clientIp(req)}`, 20)) return rateLimitedResponse();
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [cases, students] = await Promise.all([getCases(), getStudents()]);
  const byId = new Map(students.map((s) => [s.id, toPublic(s)]));

  const rows = cases
    .map((c) => {
      const student = byId.get(c.studentId);
      return {
        ...c,
        studentName: student?.name ?? "Unknown",
        studentEmail: student?.email ?? "",
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ cases: rows });
}

export async function PUT(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`admin-cases-put:${clientIp(req)}`, 20)) return rateLimitedResponse();
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = clean(body.id, 80);
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const reply = clean(body.reply, 2000);
  if (reply) {
    const updated = await addStaffReply(id, reply);
    if (!updated) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, case: updated });
  }

  const status = clean(body.status, 40) as ConsultancyStatus;
  if (!["open", "in_progress", "closed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const updated = await updateCaseStatus(id, status);
  if (!updated) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, case: updated });
}
