import { NextRequest, NextResponse } from "next/server";
import { clean } from "@/lib/auth";
import { sendEmail, sendSms } from "@/lib/notify";
import {
  clientIp,
  rateLimit,
  rateLimitedResponse,
  safeEqualString,
} from "@/lib/security";

function adminOk(req: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  const provided = req.headers.get("x-admin-password") ?? "";
  if (!expected || !provided) return false;
  return safeEqualString(provided, expected);
}

/** Admin-only notify probe. Disabled without ADMIN_PASSWORD in every environment. */
export async function POST(req: NextRequest) {
  if (!rateLimit(`notify:${clientIp(req)}`, 5)) return rateLimitedResponse();
  if (!adminOk(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const channel = clean(body.channel, 10);
  if (channel === "sms") {
    const to = clean(body.to, 30);
    const text = clean(body.body, 500);
    if (!to || !text) {
      return NextResponse.json({ error: "to and body required for SMS" }, { status: 400 });
    }
    const result = await sendSms({ to, body: text });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  }

  const to = clean(body.to, 120);
  const subject = clean(body.subject, 120) || "KS Abroad test";
  const text = clean(body.text, 2000) || "Test message from notify API.";
  if (!to) {
    return NextResponse.json({ error: "to required for email" }, { status: 400 });
  }
  const result = await sendEmail({ to, subject, text });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
