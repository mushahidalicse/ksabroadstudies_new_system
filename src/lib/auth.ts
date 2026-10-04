import { createHmac, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";

const scryptAsync = promisify(scrypt);
export const COOKIE = "ks_student_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 14;

function secret() {
  return (
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV === "production" ? "" : "ks-abroad-dev-session")
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const left = Buffer.from(hex, "hex");
  if (left.length !== derived.length) return false;
  return timingSafeEqual(left, derived);
}

function sign(value: string) {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET missing");
  return createHmac("sha256", key).update(value).digest("base64url");
}

export function createSessionToken(studentId: string) {
  const payload = Buffer.from(
    JSON.stringify({
      id: studentId,
      exp: Date.now() + MAX_AGE_SEC * 1000,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined | null): string | null {
  const data = readTokenPayload(token);
  if (!data?.id || data.kind === "staff") return null;
  return data.id;
}

export function createStaffToken(staffId: string, role: string) {
  const payload = Buffer.from(
    JSON.stringify({
      id: staffId,
      role,
      kind: "staff",
      exp: Date.now() + MAX_AGE_SEC * 1000,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readStaffToken(token: string | undefined | null): { id: string; role: string } | null {
  const data = readTokenPayload(token);
  if (!data?.id || data.kind !== "staff" || !data.role) return null;
  return { id: data.id, role: data.role };
}

function readTokenPayload(token: string | undefined | null) {
  if (!token || !secret()) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      id?: string;
      role?: string;
      kind?: string;
      exp?: number;
    };
    if (!data.id || !data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: NextResponse, studentId: string) {
  res.cookies.set(COOKIE, createSessionToken(studentId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

function jwtSecret() {
  return (
    process.env.PORTAL_JWT_SECRET ||
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV === "production" ? "" : "ks-abroad-dev-session")
  );
}

function signJwtPart(value: string) {
  const key = jwtSecret();
  if (!key) throw new Error("JWT secret missing");
  return createHmac("sha256", key).update(value).digest("base64url");
}

/** Issue a Bearer token for mobile clients when a JWT secret is configured. */
export function issueJwt(studentId: string): string | null {
  const key = jwtSecret();
  if (!key) return null;
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  );
  const payload = Buffer.from(
    JSON.stringify({
      sub: studentId,
      exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC,
      iat: Math.floor(Date.now() / 1000),
    }),
  ).toString("base64url");
  const sig = signJwtPart(`${header}.${payload}`);
  return `${header}.${payload}.${sig}`;
}

function readJwt(token: string): string | null {
  const key = jwtSecret();
  if (!key) return null;
  const [header, payload, sig] = token.split(".");
  if (!header || !payload || !sig) return null;
  const expected = signJwtPart(`${header}.${payload}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: string;
      exp?: number;
    };
    if (!data.sub || !data.exp || Date.now() / 1000 > data.exp) return null;
    return data.sub;
  } catch {
    return null;
  }
}

/** Resolve student id from session cookie or `Authorization: Bearer` token. */
export function studentIdFromRequest(req: NextRequest): string | null {
  const fromCookie = readSessionToken(req.cookies.get(COOKIE)?.value);
  if (fromCookie) return fromCookie;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return readJwt(auth.slice(7).trim());
  }
  return null;
}

/** @deprecated Use studentIdFromRequest */
export function sessionIdFromRequest(req: NextRequest) {
  return studentIdFromRequest(req);
}

export function clean(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, max);
}
