import { NextRequest, NextResponse } from "next/server";
import { clean, issueJwt, setSessionCookie, verifyPassword } from "@/lib/auth";
import { getStudentByEmail, toPublic } from "@/lib/students";
import {
  assertTrustedOrigin,
  clientIp,
  forbiddenOrigin,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/security";

export async function POST(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`login:${clientIp(req)}`, 5)) return rateLimitedResponse();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = clean(body.email, 120).toLowerCase();
  const password = String(body.password ?? "");
  const student = await getStudentByEmail(email);
  if (!student || !(await verifyPassword(password, student.passwordHash))) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const token = issueJwt(student.id);
  const res = NextResponse.json({
    ok: true,
    student: toPublic(student),
    ...(token ? { token } : {}),
  });
  setSessionCookie(res, student.id);
  return res;
}
