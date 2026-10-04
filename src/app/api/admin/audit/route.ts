import { NextRequest, NextResponse } from "next/server";
import { listAudit } from "@/lib/portal-store/audit";
import { clientIp, rateLimit, rateLimitedResponse } from "@/lib/security";
import { requireStaff } from "@/lib/staff-access";

export async function GET(req: NextRequest) {
  if (!rateLimit(`audit-get:${clientIp(req)}`, 30)) return rateLimitedResponse();
  const actor = await requireStaff(req, "audit");
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = req.nextUrl.searchParams;
  const rows = await listAudit({
    staff: params.get("staff") || "",
    action: params.get("action") || "",
    entity: params.get("entity") || "",
    q: params.get("q") || "",
    from: params.get("from") || "",
    to: params.get("to") || "",
  });
  return NextResponse.json({
    legacyFallback: actor.label === "Legacy local admin fallback",
    rows,
  });
}
