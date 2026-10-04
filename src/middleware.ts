import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  applySecurityHeaders,
  clientIp,
  isBlockedPath,
  rateLimit,
} from "@/lib/security";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isBlockedPath(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  // Edge rate limit for API abuse / scraping
  if (pathname.startsWith("/api/")) {
    const ip = clientIp(req);
    const max = pathname.startsWith("/api/auth")
      ? 20
      : pathname.startsWith("/api/admin")
        ? 30
        : pathname.startsWith("/api/v1")
          ? 60
          : 80;
    if (!rateLimit(`mw:${pathname.split("/").slice(0, 4).join("/")}:${ip}`, max, 60_000)) {
      return NextResponse.json(
        { error: "Too many requests." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "Cache-Control": "no-store",
          },
        },
      );
    }
  }

  const res = NextResponse.next();
  applySecurityHeaders(res, pathname);
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
