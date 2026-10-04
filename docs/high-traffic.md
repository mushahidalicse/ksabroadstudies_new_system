# High traffic readiness (10k+ users)

This app is now **cache-first for public pages**. A single Node process with JSON
files will **not** alone hold 10,000 simultaneous interactive users. Use the stack
below for real peak load.

## What the code now does

| Layer | Behaviour |
| --- | --- |
| Catalogue JSON | `unstable_cache` + tag bust on admin save (`src/lib/cache.ts`) |
| Public pages | `revalidate = 120` (ISR) instead of `force-dynamic` |
| CDN headers | `s-maxage=120, stale-while-revalidate=600` on hot routes |
| Static assets | long-cache immutable `/_next/static` |
| Deploy shape | `output: "standalone"` for containers / multi-instance |
| Rate limits | Memory-bounded maps (edge + API) |

## Recommended production topology

1. **Cloudflare** (or similar CDN) in front — caches HTML/API GETs, absorbs bots.
2. **Host** on Vercel / Fly / Railway / VPS behind a load balancer (2+ Node instances).
3. Set env:
   - `NEXT_PUBLIC_SITE_URL=https://your-domain.com`
   - Strong `ADMIN_PASSWORD`, `SESSION_SECRET`, `PORTAL_JWT_SECRET`
   - `CACHE_REVALIDATE_SECONDS=120` (raise to 300 under extreme read traffic)
4. Put **student PII** on a real database before expecting 10k concurrent portal users
   (current `data/students.json` is fine for launch, not for global peak writes).
5. Keep OpenAI / email providers rate-limited; KS Buddy already has per-IP limits.

## Honest capacity note

- **Read-heavy browsing** (universities, programmes, guides): CDN + ISR can serve far beyond 10k page views.
- **Write-heavy portal** (register, uploads, AI match): needs horizontal scale + DB + object storage.

## Privacy / consent (worldwide-oriented)

- `/privacy` — consent-based processing notice
- `/cookies` — essential cookies only
- Register requires Privacy + Terms checkboxes; marketing is optional
- Contact form requires privacy consent
- Portal: export data, toggle marketing, delete account (`/api/portal/privacy`)
