import { NextRequest, NextResponse } from "next/server";
import { clean } from "@/lib/auth";
import { buildBotContext, mockBotReply, openAiBotReply } from "@/lib/bot-knowledge";
import {
  assertTrustedOrigin,
  clientIp,
  forbiddenOrigin,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/security";

export async function POST(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`bot:${clientIp(req)}`, 15)) return rateLimitedResponse();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = clean(body.message, 800);
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const langRaw = clean(body.lang, 4);
  const lang = langRaw === "ur" || langRaw === "en" ? langRaw : undefined;

  const context = await buildBotContext(message);
  const ai = await openAiBotReply(message, lang, context);
  const result = ai ?? (await mockBotReply(message, lang));

  return NextResponse.json({ ok: true, ...result });
}
