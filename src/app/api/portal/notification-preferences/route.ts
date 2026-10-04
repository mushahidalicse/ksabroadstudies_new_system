import { NextRequest, NextResponse } from "next/server";
import { sessionIdFromRequest } from "@/lib/auth";
import { getNotificationPreferences, setPortalPreference } from "@/lib/portal-store/preferences";
import { assertTrustedOrigin, clientIp, forbiddenOrigin, rateLimit, rateLimitedResponse } from "@/lib/security";

export async function GET(req: NextRequest) {
  if (!rateLimit(`prefs-get:${clientIp(req)}`, 40)) return rateLimitedResponse();
  const id = sessionIdFromRequest(req);
  if (!id) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  return NextResponse.json(await getNotificationPreferences(id));
}

export async function PUT(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`prefs-put:${clientIp(req)}`, 20)) return rateLimitedResponse();
  const id = sessionIdFromRequest(req);
  if (!id) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  let body: { portalEnabled?: boolean; emailEnabled?: boolean; whatsappEnabled?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.emailEnabled || body.whatsappEnabled) {
    return NextResponse.json({ error: "Email and WhatsApp are not connected yet." }, { status: 400 });
  }
  await setPortalPreference(id, body.portalEnabled !== false);
  return NextResponse.json(await getNotificationPreferences(id));
}
