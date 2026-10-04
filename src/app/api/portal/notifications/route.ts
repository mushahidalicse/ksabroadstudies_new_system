import { NextRequest, NextResponse } from "next/server";
import { sessionIdFromRequest } from "@/lib/auth";
import { categoryFor, categoryLabel } from "@/lib/notifications/copy";
import { listNotifications, markAllRead, markRead, unreadCount } from "@/lib/portal-store/notifications";
import { clientIp, rateLimit, rateLimitedResponse, assertTrustedOrigin, forbiddenOrigin } from "@/lib/security";

export async function GET(req: NextRequest) {
  if (!rateLimit(`notes-get:${clientIp(req)}`, 40)) return rateLimitedResponse();
  const id = sessionIdFromRequest(req);
  if (!id) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const [rows, unread] = await Promise.all([listNotifications(id), unreadCount(id)]);
  return NextResponse.json({
    unread,
    notifications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      category: categoryLabel(categoryFor(row.type)),
      title: row.title,
      message: row.message,
      link: row.link,
      isRead: row.isRead,
      createdAt: row.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`notes-post:${clientIp(req)}`, 30)) return rateLimitedResponse();
  const id = sessionIdFromRequest(req);
  if (!id) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  let body: { id?: string; all?: boolean };
  try {
    body = (await req.json()) as { id?: string; all?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.all) {
    await markAllRead(id);
    return NextResponse.json({ ok: true });
  }
  const saved = await markRead(id, String(body.id ?? ""));
  if (!saved) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
