import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, studentIdFromRequest } from "@/lib/auth";
import {
  assertTrustedOrigin,
  clientIp,
  forbiddenOrigin,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/security";
import {
  getStudentById,
  removeStudent,
  toPublic,
  upsertStudent,
} from "@/lib/students";
import { uploadDir } from "@/lib/portal-store/uploads";

/** GDPR-style export of the signed-in student's data. */
export async function GET(req: NextRequest) {
  if (!rateLimit(`privacy-export:${clientIp(req)}`, 10)) return rateLimitedResponse();
  const id = studentIdFromRequest(req);
  if (!id) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const student = await getStudentById(id);
  if (!student) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  return NextResponse.json({
    ok: true,
    exportedAt: new Date().toISOString(),
    student: toPublic(student),
  });
}

/** Withdraw marketing consent or delete account (?action=delete). */
export async function POST(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`privacy-post:${clientIp(req)}`, 10)) return rateLimitedResponse();
  const id = studentIdFromRequest(req);
  if (!id) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const student = await getStudentById(id);
  if (!student) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  let body: { action?: string; marketingOptIn?: boolean };
  try {
    body = (await req.json()) as { action?: string; marketingOptIn?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "delete") {
    await removeStudent(id);
    try {
      await fs.rm(path.join(uploadDir(), id), { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    const res = NextResponse.json({ ok: true, deleted: true });
    clearSessionCookie(res);
    return res;
  }

  if (typeof body.marketingOptIn === "boolean") {
    student.consent = {
      privacyAcceptedAt: student.consent?.privacyAcceptedAt || student.createdAt,
      termsAcceptedAt: student.consent?.termsAcceptedAt || student.createdAt,
      policyVersion: student.consent?.policyVersion || "legacy",
      marketingOptIn: body.marketingOptIn,
      marketingOptInAt: body.marketingOptIn ? new Date().toISOString() : undefined,
      acceptedFromIp: student.consent?.acceptedFromIp,
      acceptedUserAgent: student.consent?.acceptedUserAgent,
    };
    await upsertStudent(student);
    return NextResponse.json({ ok: true, student: toPublic(student) });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
