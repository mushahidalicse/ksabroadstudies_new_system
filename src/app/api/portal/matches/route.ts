import { NextRequest, NextResponse } from "next/server";
import { sessionIdFromRequest } from "@/lib/auth";
import { getCatalogue } from "@/lib/data";
import { profileCompleteness } from "@/lib/matching/profile-completeness";
import { matchProgrammes, type MatchCategory, type MatchQuery } from "@/lib/matching/programme-match";
import { clientIp, rateLimit, rateLimitedResponse } from "@/lib/security";
import { getStudentById } from "@/lib/students";
import type { FinderStatus } from "@/lib/deadline-display";

const CATEGORIES = new Set<MatchCategory>(["strong", "possible", "needs-checking", "mismatch"]);
const STATUSES = new Set<FinderStatus>(["open", "closing", "upcoming", "closed", "unannounced"]);
const REGIONS = new Set(["lazio", "south", "centre", "north"]);
const SORTS = new Set<NonNullable<MatchQuery["sort"]>>(["relevance", "deadline", "fee", "verified"]);

function one(value: string | null) {
  return (value ?? "").trim().slice(0, 80);
}

export async function GET(req: NextRequest) {
  if (!rateLimit(`portal-matches:${clientIp(req)}`, 30)) return rateLimitedResponse();
  const id = sessionIdFromRequest(req);
  if (!id) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const student = await getStudentById(id);
  if (!student) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const category = one(params.get("category"));
  const status = one(params.get("status"));
  const region = one(params.get("region"));
  const sort = one(params.get("sort"));
  const fee = Number(params.get("maxFee"));
  const offset = Number(params.get("offset"));
  const query: MatchQuery = {
    category: CATEGORIES.has(category as MatchCategory) ? (category as MatchCategory) : "",
    status: STATUSES.has(status as FinderStatus) ? (status as FinderStatus) : "",
    region: REGIONS.has(region) ? region : "",
    field: one(params.get("field")),
    maxFee: Number.isFinite(fee) && fee > 0 ? fee : null,
    sort: SORTS.has(sort as NonNullable<MatchQuery["sort"]>) ? (sort as NonNullable<MatchQuery["sort"]>) : "relevance",
    offset: Number.isFinite(offset) ? offset : 0,
    limit: 24,
  };

  const completeness = profileCompleteness(student.profile);
  const page = matchProgrammes(student.profile, await getCatalogue(), query);
  return NextResponse.json({
    ...page,
    completeness,
    notice: student.profile.studyLevel ? "" : "Complete your profile for better matches.",
    prompts: completeness.prompts,
  });
}
