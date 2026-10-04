import { NextRequest, NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/seo";

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();
const MAX_BUCKETS = 20_000;

export function clientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

function pruneBuckets(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, row] of buckets) {
    if (now > row.resetAt) buckets.delete(key);
    if (buckets.size < MAX_BUCKETS * 0.7) break;
  }
  if (buckets.size >= MAX_BUCKETS) {
    let n = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (++n > 2000) break;
    }
  }
}

/** Sliding fixed-window rate limit. Returns true if allowed. */
export function rateLimit(
  key: string,
  max: number,
  windowMs = 60_000,
): boolean {
  const now = Date.now();
  pruneBuckets(now);
  const row = buckets.get(key);
  if (!row || now > row.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (row.count >= max) return false;
  row.count += 1;
  return true;
}

export function rateLimitedResponse(retryAfterSec = 60) {
  return NextResponse.json(
    { error: "Too many requests. Please wait and try again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "Cache-Control": "no-store",
      },
    },
  );
}

/** Constant-time string compare (Edge + Node safe — no node:crypto). */
export function safeEqualString(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

/** Hosts allowed to call cookie-authenticated / form POST APIs from a browser. */
export function trustedHosts(): Set<string> {
  const hosts = new Set<string>(["localhost:43127", "127.0.0.1:43127"]);
  try {
    hosts.add(new URL(getSiteUrl()).host);
  } catch {
    /* ignore */
  }
  const vercel = process.env.VERCEL_URL?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (vercel) hosts.add(vercel);
  const extra = process.env.TRUSTED_ORIGINS?.split(",") ?? [];
  for (const raw of extra) {
    const v = raw.trim();
    if (!v) continue;
    try {
      hosts.add(v.includes("://") ? new URL(v).host : v);
    } catch {
      hosts.add(v);
    }
  }
  return hosts;
}

/**
 * Reject cross-site browser POSTs (CSRF).
 * Allows: same-site Origin, or non-browser callers with admin/API credentials.
 */
export function assertTrustedOrigin(req: NextRequest): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;

  const origin = req.headers.get("origin");
  if (!origin) {
    // Non-CORS tools / mobile apps: require an explicit credential header when cookies exist
    if (req.cookies.get("ks_student_session") && process.env.NODE_ENV === "production") {
      const auth = req.headers.get("authorization");
      const admin = req.headers.get("x-admin-password");
      const apiKey = req.headers.get("x-api-key");
      return Boolean(auth || admin || apiKey);
    }
    return true;
  }

  try {
    const host = new URL(origin).host;
    return trustedHosts().has(host);
  } catch {
    return false;
  }
}

export function forbiddenOrigin() {
  return NextResponse.json(
    { error: "Forbidden origin." },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

/** Optional lock for public catalogue APIs when CATALOGUE_API_KEY is set. */
export function assertCatalogueAccess(req: NextRequest): boolean {
  const expected = process.env.CATALOGUE_API_KEY?.trim();
  if (!expected) return true;
  const provided =
    req.headers.get("x-api-key")?.trim() ||
    req.nextUrl.searchParams.get("api_key")?.trim() ||
    "";
  if (!provided) return false;
  return safeEqualString(provided, expected);
}

export function unauthorizedCatalogue() {
  return NextResponse.json(
    { error: "API key required. Set header x-api-key." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export function isStrongPassword(password: string) {
  if (password.length < 10) return false;
  if (password.length > 128) return false;
  if (!/[A-Za-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

/** Extra security headers applied from middleware (defense in depth). */
export function applySecurityHeaders(res: NextResponse, pathname: string) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-DNS-Prefetch-Control", "off");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("X-Permitted-Cross-Domain-Policies", "none");

  if (pathname.startsWith("/api/")) {
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Cross-Origin-Resource-Policy", "same-site");
  }

  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register")
  ) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "no-store");
  }

  return res;
}

export const BLOCKED_PATH_PREFIXES = [
  "/.env",
  "/.git",
  "/.svn",
  "/.hg",
  "/node_modules",
  "/data",
  "/wp-admin",
  "/wp-login",
  "/xmlrpc.php",
  "/vendor/phpunit",
  "/.aws",
  "/server-status",
] as const;

export function isBlockedPath(pathname: string) {
  const lower = pathname.toLowerCase();
  if (BLOCKED_PATH_PREFIXES.some((p) => lower === p || lower.startsWith(`${p}/`))) {
    return true;
  }
  if (lower.includes("phpmyadmin")) return true;
  if (lower.endsWith(".map") && process.env.NODE_ENV === "production") return true;
  if (lower.endsWith(".php") || lower.endsWith(".asp") || lower.endsWith(".aspx")) {
    return true;
  }
  return false;
}
