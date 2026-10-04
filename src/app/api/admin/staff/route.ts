import { NextRequest, NextResponse } from "next/server";
import { createStaffToken } from "@/lib/auth";
import { authenticateStaff, createStaff, listStaff, setStaffActive, setStaffRole } from "@/lib/portal-store/staff";
import { recordAudit } from "@/lib/portal-store/audit";
import {
  assertTrustedOrigin,
  clientIp,
  forbiddenOrigin,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/security";
import { requireStaff, STAFF_COOKIE } from "@/lib/staff-access";
import { isStaffRole } from "@/lib/staff-roles";

function clean(value: unknown, max: number) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

function passwordOk(password: string) {
  return password.length >= 10 && password.length <= 128 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export async function GET(req: NextRequest) {
  if (!rateLimit(`staff-get:${clientIp(req)}`, 30)) return rateLimitedResponse();
  if (!(await requireStaff(req, "staff"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const staff = await listStaff();
  return NextResponse.json({ staff });
}

export async function POST(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`staff-post:${clientIp(req)}`, 20)) return rateLimitedResponse();
  let body: { action?: string; email?: string; password?: string; name?: string; role?: string; id?: string; active?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "login") {
    const account = await authenticateStaff(clean(body.email, 160), String(body.password ?? ""));
    if (!account) return NextResponse.json({ error: "Email or password is not recognised." }, { status: 401 });
    await recordAudit({
      staffId: account.id,
      actorLabel: account.name || account.email,
      action: "staff_login",
      entityType: "staff",
      entityId: account.id,
      metadata: { role: account.role },
    });
    const res = NextResponse.json({ ok: true, staff: account });
    res.cookies.set(STAFF_COOKIE, createStaffToken(account.id, account.role), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  }

  const actor = await requireStaff(req, "staff");
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (body.action === "create") {
    const email = clean(body.email, 160).toLowerCase();
    const password = String(body.password ?? "");
    const role = clean(body.role, 40);
    if (!email.includes("@") || !passwordOk(password) || !isStaffRole(role)) {
      return NextResponse.json({ error: "Use a valid email, a role, and a password of 10–128 characters with a letter and a number." }, { status: 400 });
    }
    const created = await createStaff({ email, name: clean(body.name, 80), password, role });
    if (!created) return NextResponse.json({ error: "Could not create that account." }, { status: 400 });
    await recordAudit({
      staffId: actor.staffId,
      actorLabel: actor.label,
      action: "staff_created",
      entityType: "staff",
      entityId: created.id,
      metadata: { role: created.role, email: created.email },
    });
    return NextResponse.json({ ok: true, staff: created });
  }

  if (body.action === "active") {
    const id = clean(body.id, 80);
    if (!id) return NextResponse.json({ error: "Choose a staff account." }, { status: 400 });
    await setStaffActive(id, Boolean(body.active));
    await recordAudit({
      staffId: actor.staffId,
      actorLabel: actor.label,
      action: body.active ? "staff_enabled" : "staff_disabled",
      entityType: "staff",
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "role") {
    const id = clean(body.id, 80);
    const role = clean(body.role, 40);
    if (!id || !isStaffRole(role)) return NextResponse.json({ error: "Choose a staff account and role." }, { status: 400 });
    await setStaffRole(id, role);
    await recordAudit({
      staffId: actor.staffId,
      actorLabel: actor.label,
      action: "role_changed",
      entityType: "staff",
      entityId: id,
      metadata: { role },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
