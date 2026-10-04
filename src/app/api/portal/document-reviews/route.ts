import { NextRequest, NextResponse } from "next/server";
import { sessionIdFromRequest } from "@/lib/auth";
import { reviewsForStudent } from "@/lib/portal-store/operations";
import { clientIp, rateLimit, rateLimitedResponse } from "@/lib/security";

export async function GET(req: NextRequest) {
  if (!rateLimit(`doc-review-get:${clientIp(req)}`, 40)) return rateLimitedResponse();
  const id = sessionIdFromRequest(req);
  if (!id) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  return NextResponse.json({ reviews: await reviewsForStudent(id) });
}
