import { NextRequest } from "next/server";
import { readStaffToken } from "@/lib/auth";
import { findStaffById } from "@/lib/portal-store/staff";
import { safeEqualString } from "@/lib/security";
import { isStaffRole, roleAllows, type StaffArea, type StaffRole } from "@/lib/staff-roles";

export const STAFF_COOKIE = "ks_staff_session";

export type StaffActor = { role: StaffRole; label: string; staffId: string | null };

function adminPasswordOk(req: NextRequest) {
  const password = req.headers.get("x-admin-password") || "";
  const expected = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "ksabroad2027");
  if (!expected || !password) return false;
  return safeEqualString(password, expected);
}

export async function actorFromRequest(req: NextRequest): Promise<StaffActor | null> {
  if (adminPasswordOk(req)) return { role: "owner", label: "Legacy local admin fallback", staffId: null };
  const token = readStaffToken(req.cookies.get(STAFF_COOKIE)?.value);
  if (!token) return null;
  const staff = await findStaffById(token.id);
  if (!staff || !staff.active || !isStaffRole(staff.role) || staff.role !== token.role) return null;
  return { role: staff.role, label: staff.name || staff.email, staffId: staff.id };
}

export async function requireStaff(req: NextRequest, area: StaffArea) {
  const actor = await actorFromRequest(req);
  if (!actor || !roleAllows(actor.role, area)) return null;
  return actor;
}
