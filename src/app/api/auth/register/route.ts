import { NextRequest, NextResponse } from "next/server";
import { clean, hashPassword, issueJwt, setSessionCookie } from "@/lib/auth";
import { sendEmail } from "@/lib/notify";
import {
  assertTrustedOrigin,
  clientIp,
  forbiddenOrigin,
  isStrongPassword,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/security";
import { SITE } from "@/lib/site";
import {
  CONSENT_POLICY_VERSION,
  EMPTY_PROFILE,
  type StudentConsent,
} from "@/lib/student-types";
import { getStudentByEmail, toPublic, upsertStudent } from "@/lib/students";

export async function POST(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`register:${clientIp(req)}`, 5)) return rateLimitedResponse();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (clean(body.website, 200)) {
    return NextResponse.json({ ok: true });
  }

  const name = clean(body.name, 80);
  const surname = clean(body.surname, 80);
  const dateOfBirth = clean(body.dateOfBirth, 20);
  const placeOfBirth = clean(body.placeOfBirth, 80);
  const passportOrCnic = clean(body.passportOrCnic, 40);
  const email = clean(body.email, 120).toLowerCase();
  const phone = clean(body.phone, 30);
  const currentCity = clean(body.currentCity, 80);
  const address = clean(body.address, 240);
  const password = String(body.password ?? "");
  const privacyConsent = Boolean(body.privacyConsent);
  const termsConsent = Boolean(body.termsConsent);
  const marketingConsent = Boolean(body.marketingConsent);

  const missing = [
    ["name", name],
    ["surname", surname],
    ["date of birth", dateOfBirth],
    ["place of birth", placeOfBirth],
    ["passport or CNIC", passportOrCnic],
    ["WhatsApp / phone", phone],
    ["current city", currentCity],
    ["address", address],
    ["email", email],
    ["password", password],
  ]
    .filter(([, value]) => !value)
    .map(([label]) => label);

  if (missing.length) {
    return NextResponse.json(
      { error: `Still needed: ${missing.join(", ")}.` },
      { status: 400 },
    );
  }
  if (!privacyConsent || !termsConsent) {
    return NextResponse.json(
      {
        error:
          "You must accept the Privacy Policy and Terms before we can store your data.",
      },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!isStrongPassword(password)) {
    return NextResponse.json(
      {
        error:
          "Password must be at least 10 characters and include letters and numbers.",
      },
      { status: 400 },
    );
  }
  if (await getStudentByEmail(email)) {
    return NextResponse.json(
      { error: "This email is already registered. Log in instead." },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const consent: StudentConsent = {
    privacyAcceptedAt: now,
    termsAcceptedAt: now,
    policyVersion: CONSENT_POLICY_VERSION,
    marketingOptIn: marketingConsent,
    marketingOptInAt: marketingConsent ? now : undefined,
    acceptedFromIp: clientIp(req),
    acceptedUserAgent: clean(req.headers.get("user-agent"), 240) || undefined,
  };

  try {
    const student = await upsertStudent({
      id: crypto.randomUUID(),
      email,
      passwordHash: await hashPassword(password),
      name,
      surname,
      dateOfBirth,
      placeOfBirth,
      passportOrCnic,
      phone,
      currentCity,
      address,
      createdAt: now,
      profile: { ...EMPTY_PROFILE },
      documents: [],
      consent,
    });

    await sendEmail({
      to: email,
      subject: `Welcome to ${SITE.name}`,
      text: [
        `Assalam o alaikum ${name},`,
        "",
        `Your ${SITE.name} portal account is ready.`,
        "Log in at /portal to save your profile, upload documents, and get your Top 10 programme shortlist.",
        "",
        `Privacy Policy version: ${CONSENT_POLICY_VERSION}`,
        "You can export or delete your data from the portal Privacy controls, or email us.",
        "",
        `WhatsApp: ${SITE.whatsappDisplay}`,
        `Email: ${SITE.email}`,
        "",
        "— KS Abroad Studies team",
      ].join("\n"),
    });

    const token = issueJwt(student.id);
    const res = NextResponse.json({
      ok: true,
      student: toPublic(student),
      ...(token ? { token } : {}),
    });
    setSessionCookie(res, student.id);
    return res;
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json(
      { error: "Could not create your account. Please try again in a moment." },
      { status: 500 },
    );
  }
}
