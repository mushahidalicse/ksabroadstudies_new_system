import { NextRequest, NextResponse } from "next/server";
import { getUniversities } from "@/lib/data";
import { effectiveAdmissionStatus } from "@/lib/admission-status";
import {
  assertCatalogueAccess,
  clientIp,
  rateLimit,
  rateLimitedResponse,
  unauthorizedCatalogue,
} from "@/lib/security";

export async function GET(req: NextRequest) {
  if (!rateLimit(`v1-uni:${clientIp(req)}`, 30)) return rateLimitedResponse();
  if (!assertCatalogueAccess(req)) return unauthorizedCatalogue();

  const universities = await getUniversities();
  const rows = universities.map((u) => ({
    id: u.id,
    name: u.name,
    city: u.city,
    region: u.region,
    status: effectiveAdmissionStatus(u),
    website: u.website,
    programCount: u.programs.filter((program) => !program.aliasOf).length,
    deadline: u.deadline,
    englishRequirement: u.englishRequirement,
  }));
  return NextResponse.json({ ok: true, count: rows.length, universities: rows });
}
