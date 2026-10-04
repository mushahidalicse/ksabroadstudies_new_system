import { NextRequest, NextResponse } from "next/server";
import { SITE } from "@/lib/site";
import {
  assertTrustedOrigin,
  clientIp,
  forbiddenOrigin,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/security";

function clean(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, max);
}

export async function POST(req: NextRequest) {
  try {
    if (!assertTrustedOrigin(req)) return forbiddenOrigin();
    const ip = clientIp(req);
    if (!rateLimit(`contact:${ip}`, 5)) return rateLimitedResponse();

    const body = (await req.json()) as Record<string, unknown>;

    // Honeypot filled => pretend success
    if (clean(body.website, 200)) {
      return NextResponse.json({ ok: true });
    }

    if (!body.contactConsent) {
      return NextResponse.json(
        { ok: false, error: "Please accept the privacy consent to send this form." },
        { status: 400 },
      );
    }

    const name = clean(body.name, 80);
    const email = clean(body.email, 120);
    const phone = clean(body.phone, 30);
    const purpose = clean(body.purpose, 80);
    const message = clean(body.message, 2000);

    if (!name || !email || !purpose || !message) {
      return NextResponse.json(
        { ok: false, error: "Please fill name, email, purpose, and message." },
        { status: 400 },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    const to = process.env.CONTACT_TO_EMAIL || SITE.email;
    const subject = `KS Abroad inquiry · ${purpose} · ${name}`;
    const text = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone/WhatsApp: ${phone || "—"}`,
      `Purpose: ${purpose}`,
      "",
      message,
      "",
      `— Sent from ${SITE.name} contact form`,
    ].join("\n");

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:43127";
    const referer = req.headers.get("referer") || `${origin}/contact`;

    const formSubmitRes = await fetch(
      `https://formsubmit.co/ajax/${encodeURIComponent(to)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Origin: origin,
          Referer: referer,
        },
        body: JSON.stringify({
          name,
          email,
          _replyto: email,
          phone,
          purpose,
          message: text,
          _subject: subject,
          _template: "table",
          _captcha: "false",
        }),
      },
    );

    const raw = await formSubmitRes.text().catch(() => "");
    let payload: { success?: string | boolean; message?: string } = {};
    try {
      payload = JSON.parse(raw) as typeof payload;
    } catch {
      payload = {};
    }
    const accepted =
      formSubmitRes.ok &&
      (payload.success === true ||
        payload.success === "true" ||
        (!("success" in payload) && formSubmitRes.status < 300));

    if (!accepted) {
      console.error("contact formsubmit failed", formSubmitRes.status, raw.slice(0, 300));
      const needsActivation =
        typeof payload.message === "string" &&
        /activat/i.test(payload.message);
      return NextResponse.json(
        {
          ok: false,
          error: needsActivation
            ? "Contact email inbox must activate FormSubmit once (check ksabroadstudies@gmail.com for Activate Form link)."
            : "Email service unavailable right now. Please WhatsApp us or email directly.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("contact error", err);
    return NextResponse.json(
      { ok: false, error: "Unexpected error. Please try WhatsApp." },
      { status: 500 },
    );
  }
}
