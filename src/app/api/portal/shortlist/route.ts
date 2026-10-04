import { NextRequest, NextResponse } from "next/server";
import { addAccountShortlist, accountShortlist, mergeAccountShortlist, removeAccountShortlist } from "@/lib/account-shortlist";
import { sessionIdFromRequest } from "@/lib/auth";
import { getProgrammeBySlug } from "@/lib/data";
import {
  assertTrustedOrigin,
  clientIp,
  forbiddenOrigin,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/security";

function unauthorized() {
  return NextResponse.json({ error: "Please log in." }, { status: 401 });
}

function slugOk(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9-]{1,120}$/.test(value);
}

export async function GET(req: NextRequest) {
  if (!rateLimit(`shortlist-get:${clientIp(req)}`, 40)) return rateLimitedResponse();
  const id = sessionIdFromRequest(req);
  if (!id) return unauthorized();
  const items = await accountShortlist(id);
  if (!items) return unauthorized();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`shortlist-post:${clientIp(req)}`, 30)) return rateLimitedResponse();
  const id = sessionIdFromRequest(req);
  if (!id) return unauthorized();

  let body: { slug?: unknown; slugs?: unknown };
  try {
    body = (await req.json()) as { slug?: unknown; slugs?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (Array.isArray(body.slugs)) {
    const slugs = body.slugs.filter(slugOk);
    const rejected = Array.isArray(body.slugs) ? body.slugs.length - slugs.length : 0;
    const accepted: string[] = [];
    for (const slug of slugs) {
      if (await getProgrammeBySlug(slug)) accepted.push(slug);
    }
    const items = await mergeAccountShortlist(id, accepted);
    if (!items) return unauthorized();
    return NextResponse.json({ items, skipped: rejected + (slugs.length - accepted.length) });
  }

  if (!slugOk(body.slug)) {
    return NextResponse.json({ error: "Enter a catalogue programme." }, { status: 400 });
  }
  if (!(await getProgrammeBySlug(body.slug))) {
    return NextResponse.json({ error: "That programme is not in the catalogue." }, { status: 404 });
  }
  const result = await addAccountShortlist(id, body.slug);
  if (!result) return unauthorized();
  if ("error" in result) {
    return NextResponse.json({ error: "The shortlist is full (40 programmes)." }, { status: 400 });
  }
  return NextResponse.json({ items: result.items, duplicate: result.duplicate });
}

export async function DELETE(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`shortlist-delete:${clientIp(req)}`, 30)) return rateLimitedResponse();
  const id = sessionIdFromRequest(req);
  if (!id) return unauthorized();

  let body: { slug?: unknown };
  try {
    body = (await req.json()) as { slug?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!slugOk(body.slug)) {
    return NextResponse.json({ error: "Enter a catalogue programme." }, { status: 400 });
  }
  const items = await removeAccountShortlist(id, body.slug);
  if (!items) return unauthorized();
  return NextResponse.json({ items });
}
