import { NextRequest, NextResponse } from "next/server";
import { getPrograms } from "@/lib/data";
import {
  assertCatalogueAccess,
  clientIp,
  rateLimit,
  rateLimitedResponse,
  unauthorizedCatalogue,
} from "@/lib/security";
import type { ProgramLevel } from "@/lib/types";

const LEVELS: ProgramLevel[] = ["bachelor", "master", "single-cycle"];

export async function GET(req: NextRequest) {
  if (!rateLimit(`v1-prog:${clientIp(req)}`, 30)) return rateLimitedResponse();
  if (!assertCatalogueAccess(req)) return unauthorizedCatalogue();

  const levelRaw = req.nextUrl.searchParams.get("level")?.trim() ?? "";
  const level = LEVELS.includes(levelRaw as ProgramLevel)
    ? (levelRaw as ProgramLevel)
    : undefined;

  const programs = await getPrograms(level);
  const rows = programs.map((p) => ({
    name: p.name,
    level: p.level,
    field: p.field,
    universityId: p.universityId,
    universityName: p.universityName,
    city: p.city,
    applyUrl: p.applyUrl,
    admissionTest: p.admissionTest ?? null,
  }));

  return NextResponse.json({
    ok: true,
    level: level ?? "all",
    count: rows.length,
    programs: rows,
  });
}
