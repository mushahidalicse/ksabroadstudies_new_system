import { NextRequest, NextResponse } from "next/server";
import { clean, studentIdFromRequest } from "@/lib/auth";
import { createCase, getCasesForStudent, type ConsultancyType } from "@/lib/consultancy";
import { sendEmail } from "@/lib/notify";
import {
  assertTrustedOrigin,
  clientIp,
  forbiddenOrigin,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/security";
import { SITE } from "@/lib/site";
import { getStudentById } from "@/lib/students";

const TYPES: ConsultancyType[] = ["one-to-one", "private-case"];

export async function GET(req: NextRequest) {
  if (!rateLimit(`cons-get:${clientIp(req)}`, 40)) return rateLimitedResponse();
  const studentId = studentIdFromRequest(req);
  if (!studentId) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }
  const cases = await getCasesForStudent(studentId);
  return NextResponse.json({ ok: true, cases });
}

export async function POST(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`cons-post:${clientIp(req)}`, 10)) return rateLimitedResponse();

  const studentId = studentIdFromRequest(req);
  if (!studentId) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const typeRaw = clean(body.type, 20);
  const type = TYPES.includes(typeRaw as ConsultancyType)
    ? (typeRaw as ConsultancyType)
    : null;
  const topic = clean(body.topic, 120);
  const message = clean(body.message, 2000);

  if (!type || !topic || !message) {
    return NextResponse.json(
      { error: "type, topic, and message are required." },
      { status: 400 },
    );
  }

  const row = await createCase({ studentId, type, topic, message });
  const student = await getStudentById(studentId);
  await sendEmail({
    to: process.env.CONTACT_TO_EMAIL || SITE.email,
    subject: `New consultancy case · ${type} · ${topic}`,
    text: [
      `Student: ${student?.name ?? studentId} (${student?.email ?? "—"})`,
      `Type: ${type}`,
      `Topic: ${topic}`,
      "",
      message,
      "",
      `Case id: ${row.id}`,
    ].join("\n"),
  });

  return NextResponse.json({ ok: true, case: row });
}
