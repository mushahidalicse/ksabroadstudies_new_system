import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js needs inline scripts; unsafe-eval only in development
      isProd
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      isProd
        ? "connect-src 'self' https://formsubmit.co"
        : "connect-src 'self' ws: wss: https://formsubmit.co",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self' https://formsubmit.co mailto:",
      "object-src 'none'",
      "worker-src 'self'",
      ...(isProd ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  serverExternalPackages: ["postgres"],
  // Smaller deploy artifact for Docker / multi-instance hosts (not for Vercel)
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    // Keep server payloads lean under load
    optimizePackageImports: ["lucide-react"],
    // 8 MB vault files plus multipart overhead. Default action limit is 1 MB.
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Middleware matches /api, so the buffered body must cover the same upload.
    proxyClientMaxBodySize: "10mb",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/admin",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/portal",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "Cross-Origin-Resource-Policy", value: "same-site" },
        ],
      },
      // CDN-friendly caching for public HTML shells (ISR still controls freshness)
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=120, stale-while-revalidate=600",
          },
        ],
      },
      {
        source: "/universities",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=120, stale-while-revalidate=600",
          },
        ],
      },
      {
        source: "/universities/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=120, stale-while-revalidate=600",
          },
        ],
      },
      {
        source: "/programs/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=120, stale-while-revalidate=600",
          },
        ],
      },
      // Hashed files are immutable in production. The same header in `next dev`
      // pins an old client bundle for a year, so a refreshed form still submits
      // the previous field list.
      ...(isProd
        ? [
            {
              source: "/_next/static/:path*",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=31536000, immutable",
                },
              ],
            },
          ]
        : []),
      {
        source: "/company/:path*.pdf",
        headers: [
          { key: "Content-Disposition", value: "attachment" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, max-age=3600" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/guides/:path*.pdf",
        headers: [
          { key: "Content-Disposition", value: "attachment" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, max-age=3600" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
