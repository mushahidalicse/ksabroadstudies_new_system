import { NextRequest, NextResponse } from "next/server";
import { searchCatalogue } from "@/lib/search";
import {
  assertCatalogueAccess,
  clientIp,
  rateLimit,
  rateLimitedResponse,
  unauthorizedCatalogue,
} from "@/lib/security";

export async function GET(req: NextRequest) {
  if (!rateLimit(`v1-search:${clientIp(req)}`, 40)) return rateLimitedResponse();
  if (!assertCatalogueAccess(req)) return unauthorizedCatalogue();

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ ok: true, q: "", results: [] });
  }
  if (q.length > 120) {
    return NextResponse.json({ error: "Query too long." }, { status: 400 });
  }
  const results = await searchCatalogue(q, 20);
  return NextResponse.json({ ok: true, q, count: results.length, results });
}
