# KS Abroad Studies — Master index

**Read this first** on any new task. Deep dives:

| Doc | Use when |
| --- | --- |
| [architecture.md](./architecture.md) | layers, security, how data flows |
| [sitemap.md](./sitemap.md) | every URL and menu |
| [erd.md](./erd.md) | JSON entities and relationships |
| [api-map.md](./api-map.md) | HTTP APIs + per-menu loaders |
| [high-traffic.md](./high-traffic.md) | CDN / ISR / 10k+ traffic + privacy overview |

**Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind 4  
**Folder:** `ks-abroad-studies/` inside Cursor Project (do not put site files in the hub root)  
**Dev:** from this folder, `npm run dev` → http://localhost:43127  
**GitHub:** `faqineurope/ks-abroad-studies-site`  
**Intake snapshot:** 2026/27–2027/28 · data `lastUpdated` 2026-09-08  
**Universitaly pre-enrolment deadline:** 30 November 2026

Do not mix BiteBros (`../bitebros/`) into this site.

---

## 1. Where to edit (fast path)

| If the task is… | Change these files |
| --- | --- |
| Company name, WhatsApp, email, social | `src/lib/site.ts` |
| Header Login / Register | `src/components/auth-bar.tsx`, `site-header.tsx` |
| Student portal / documents | `src/app/login`, `register`, `portal` · `src/lib/auth.ts` · `src/lib/match-student.ts` (profile analysis + top-10) |
| Home hero / counts | `src/app/page.tsx` + `getMeta()` in `src/lib/data.ts` |
| University status, fee, deadline, notes | `/admin` or `src/data/universities.json` |
| Add/edit a university or nested programme | `src/data/universities.json` · types `src/lib/types.ts`. A renamed course keeps `aliasOf` so the old slug resolves; the public catalogue lists the current name once. |
| Master's / Bachelor's / Medicine lists | nested `programs[]` in `universities.json` (not the archive JSON) |
| CEnT-S text | `src/data/cent-s-guide.json` · page `src/app/programs/bachelor/page.tsx` |
| IMAT text | `src/data/english-single-cycle.json` (`imat`) · `src/lib/imat.ts` |
| PhD guide or courses | `src/data/phd.json` |
| Regional DSU scholarships | `src/data/regional-scholarships.json` |
| Pakistan visa / DOV / documents / motivation | `src/data/pakistan-guides.json` |
| Translators | `src/data/translation-companies.json` |
| Erasmus Mundus 2027 | `src/data/erasmus.json` |
| About / SECP | `src/data/company.json` + PDFs in `public/company/` |
| Contact form / email delivery | `src/components/contact-form.tsx` · `src/app/api/contact/route.ts` |
| Admin password API | `src/app/api/admin/universities/route.ts` · `ADMIN_PASSWORD` |
| Colors / type | `src/app/globals.css` · `src/app/layout.tsx` |
| Security headers / CSP / CSRF / rate limits | `next.config.ts` · `src/middleware.ts` · `src/lib/security.ts` |

**Rule:** public pages do **not** call REST. They `await` `src/lib/*` which `fs.readFile`s JSON. Only Contact and Admin use `/api/*`.

---

## 2. Route index

### Header

| Menu | URL | Page file | Live data |
| --- | --- | --- | --- |
| Home | `/` | `src/app/page.tsx` | `universities.json` counts |
| Universities | `/universities` | `src/app/universities/page.tsx` | `universities.json` (51) |
| University detail | `/universities/[id]` | `src/app/universities/[id]/page.tsx` | same |
| Master's | `/programs/master` | `src/app/programs/master/page.tsx` | 654 master programmes |
| Bachelor's | `/programs/bachelor` | `src/app/programs/bachelor/page.tsx` | 118 bachelor + CEnT-S |
| Medicine | `/programs/single-cycle` | `src/app/programs/single-cycle/page.tsx` | 25 single-cycle + IMAT |
| PhD | `/phd` | `src/app/phd/page.tsx` | `phd.json` 51 unis / 273 programmes |
| PhD detail | `/phd/[id]` | `src/app/phd/[id]/page.tsx` | same |
| Guides | `/guides` | `src/app/guides/page.tsx` | `pakistan-guides.json` |
| Scholarships | `/scholarships` | `src/app/scholarships/page.tsx` | 21 regions |
| Scholarship detail | `/scholarships/[id]` | `src/app/scholarships/[id]/page.tsx` | same |
| Erasmus | `/erasmus` | `src/app/erasmus/page.tsx` | `erasmus.json` |
| Contact | `/contact` | `src/app/contact/page.tsx` | `POST /api/contact` |

### Guides

| URL | File |
| --- | --- |
| `/guides/documents` | `src/app/guides/documents/page.tsx` |
| `/guides/translations` | `src/app/guides/translations/page.tsx` |
| `/guides/motivation-letter` | `src/app/guides/motivation-letter/page.tsx` |
| `/guides/dov` | `src/app/guides/dov/page.tsx` |
| `/guides/visa` | `src/app/guides/visa/page.tsx` |
| `/guides/scholarship-docs` | `src/app/guides/scholarship-docs/page.tsx` |

### Footer / other

| URL | File |
| --- | --- |
| `/study-in-italy` | `src/app/study-in-italy/page.tsx` |
| `/programs` | `src/app/programs/page.tsx` |
| `/process` | `src/app/process/page.tsx` |
| `/about` | `src/app/about/page.tsx` |
| `/agreement` | `src/app/agreement/page.tsx` |
| `/admin` | `src/app/admin/page.tsx` (noindex) |
| `/admin/catalogue-review` | `src/app/admin/catalogue-review/page.tsx` (same admin password) |
| `/admin/crm` | `src/app/admin/crm/page.tsx` (same admin password; student rows stay in PostgreSQL) |
| `/admin/operations` | `src/app/admin/operations/page.tsx` (staff accounts, document review, services, payment-proof review) |
| `/admin/communications` | `src/app/admin/communications/page.tsx` (portal messages, templates, staff reminders) |
| `/admin/audit` | `src/app/admin/audit/page.tsx` (owner audit log) |
| `/portal/notifications` | `src/app/portal/notifications/page.tsx` (student notification center) |
| `/admin/research` | `src/app/admin/research/page.tsx` (same admin password; official-site discovery runs before OpenAI web search; a TLS failure on one official host does not drop the rest of that university domain; a page on that validated domain confirms the university without requiring the English catalogue name in the page text; degree level is taken from the target programme heading, class, or main text, so navigation and prior-qualification wording do not reclassify the page; official HTML is parsed in full for admission links before the readable text is truncated; a university-wide admissions page is not given one degree level, and deadlines stay with the section that states them; an opening date stays an opening, and an unlabeled date on an international admissions page stays international; programme teaching language stays separate from curriculum language, including when one heading names several curricula; URL discovery then runs as two separate server calls, English catalogue title then Italian degree structure, and a healthy official subdomain is reused for later programmes at that university; after identity is confirmed, a separate admission search runs for international and non-EU deadlines; research stays pending until approved into enrichment; mock and optional Grok remain) |

### HTTP APIs

| Method | Path | File |
| --- | --- | --- |
| POST | `/api/contact` | `src/app/api/contact/route.ts` |
| GET, PUT | `/api/admin/universities` | `src/app/api/admin/universities/route.ts` |
| GET, PUT, POST, DELETE | `/api/admin/catalogue-review` | `src/app/api/admin/catalogue-review/route.ts` |
| GET, POST | `/api/admin/crm` | `src/app/api/admin/crm/route.ts` |
| GET, POST | `/api/admin/staff` | `src/app/api/admin/staff/route.ts` |
| GET, POST | `/api/admin/operations` | `src/app/api/admin/operations/route.ts` |
| GET, POST | `/api/admin/communications` | `src/app/api/admin/communications/route.ts` |
| GET | `/api/admin/audit` | `src/app/api/admin/audit/route.ts` |
| GET, POST | `/api/portal/notifications` | `src/app/api/portal/notifications/route.ts` |
| GET, POST | `/api/admin/research` | `src/app/api/admin/research/route.ts` |

### Stages 1–5 (mobile, portal, notify, bot, consultancy)

| Stage | What | Routes / files |
| --- | --- | --- |
| **1** | Mobile API v1 + PWA | `GET /api/v1` · `GET /api/v1/search?q=` · `GET /api/v1/universities` · `GET /api/v1/programs?level=` · `GET /api/v1/openapi` · `/programs/english` · `public/manifest.webmanifest` · `public/sw.js` · `src/components/pwa-register.tsx` |
| **2** | Student portal (existing) | `/login` · `/register` · `/portal` · `/api/auth/*` · `/api/portal/profile` · `/api/portal/documents` · `/api/portal/shortlist` · `src/lib/auth.ts` · `src/lib/match-student.ts`. Accounts, shortlist, applications, consultancy, and document metadata require `DATABASE_URL` (PostgreSQL). They are not stored in `data/*.json` or `/tmp`. |
| **3** | Email / SMS | `src/lib/notify.ts` · `POST /api/notify/test` (dev or `x-admin-password`) · welcome email on register |
| **4** | AI bot | `POST /api/bot/chat` · `src/components/ai-bot.tsx` (bottom-left; WhatsApp stays right) |
| **5** | Consultancy cases | `POST/GET /api/consultancy` · `GET /api/consultancy/[id]` · `POST /api/consultancy/[id]/reply` · `src/lib/consultancy.ts` · `src/components/consultancy-panel.tsx` in portal |

Optional mobile auth: set `SESSION_SECRET` / `PORTAL_JWT_SECRET`; login & register return `{ token }`; portal APIs accept `Authorization: Bearer <token>`.

---

## 3. Catalogue counts (live JSON)

From `universities.json` unless noted.

| Catalogue | Count |
| --- | --- |
| Universities | 51 |
| Status open / soon / closed | 1 / 29 / 21 |
| Region Lazio / South / Centre / North | 5 / 17 / 7 / 22 |
| Nested programmes total | 797 |
| Bachelor | 118 |
| Master | 654 |
| Single-cycle (medicine etc.) | 25 |
| PhD universities (`phd.json`) | 51 |
| PhD programmes | 273 · cycle XLII · 2026/2027 |
| Scholarship regions | 21 (see ids below) |
| Translators Islamabad / Karachi | 13 / 4 |

Scholarship region ids: `lazio`, `abruzzo`, `basilicata`, `calabria`, `campania`, `emilia-romagna`, `friuli-venezia-giulia`, `liguria`, `lombardia`, `marche`, `molise`, `piemonte`, `puglia`, `sardegna`, `sicilia`, `toscana`, `trentino`, `alto-adige`, `umbria`, `valle-daosta`, `veneto`.

Admissions `University.id` and PhD `PhdUniversity.id` are **separate catalogues** — do not assume the same slug.

---

## 4. File listing

### Pages (`src/app`)

```
src/app/layout.tsx
src/app/page.tsx
src/app/globals.css
src/app/about/page.tsx
src/app/admin/page.tsx
src/app/agreement/page.tsx
src/app/contact/page.tsx
src/app/erasmus/page.tsx
src/app/process/page.tsx
src/app/study-in-italy/page.tsx
src/app/programs/page.tsx
src/app/programs/bachelor/page.tsx
src/app/programs/master/page.tsx
src/app/programs/single-cycle/page.tsx
src/app/universities/page.tsx
src/app/universities/[id]/page.tsx
src/app/phd/page.tsx
src/app/phd/[id]/page.tsx
src/app/scholarships/page.tsx
src/app/scholarships/[id]/page.tsx
src/app/guides/page.tsx
src/app/guides/documents/page.tsx
src/app/guides/translations/page.tsx
src/app/guides/motivation-letter/page.tsx
src/app/guides/dov/page.tsx
src/app/guides/visa/page.tsx
src/app/guides/scholarship-docs/page.tsx
src/app/api/contact/route.ts
src/app/api/admin/universities/route.ts
```

### Components (`src/components`)

| File | Role |
| --- | --- |
| `site-header.tsx` | Sticky nav (9 items) |
| `site-footer.tsx` | Explore + contact + social |
| `whatsapp-float.tsx` | Floating WhatsApp |
| `social-links.tsx` | Company / founder / channel links |
| `university-explorer.tsx` | Client filters for universities |
| `program-explorer.tsx` | Client filters for programmes |
| `phd-explorer.tsx` | Client filters for PhD |
| `scholarship-explorer.tsx` | Client filters for DSU regions |
| `contact-form.tsx` | POST `/api/contact` |
| `status-badge.tsx` | Open / Soon / Closed / TBA |

### Lib (`src/lib`)

| File | Role |
| --- | --- |
| `site.ts` | Identity + social constants |
| `data.ts` | universities.json read/write + getPrograms/getMeta |
| `types.ts` | University, Program, AdmissionStatus |
| `phd.ts` / `phd-types.ts` | PhD loaders + types |
| `scholarships.ts` / `scholarship-types.ts` | DSU loaders + types |
| `guides.ts` | pakistan-guides.json |
| `content.ts` / `content-types.ts` | Erasmus, translations, company |
| `cent-s.ts` | CEnT-S guide |
| `imat.ts` | IMAT from english-single-cycle.json |
| `utils.ts` | `cn`, `formatFee`, `statusLabel`, `formatAdmissionDate`, `regionLabel` |

### Live data (`src/data`) — imported by the app

| File | Loader |
| --- | --- |
| `universities.json` | `data.ts` |
| `phd.json` | `phd.ts` |
| `regional-scholarships.json` | `scholarships.ts` |
| `pakistan-guides.json` | `guides.ts` |
| `erasmus.json` | `content.ts` |
| `translation-companies.json` | `content.ts` |
| `company.json` | `content.ts` |
| `cent-s-guide.json` | `cent-s.ts` |
| `english-single-cycle.json` | `imat.ts` (IMAT block) |

### Archive / research — **not imported**

Do not treat as live UI source unless the user asks to wire them:

- `src/data/english-bachelors.json` (118 — mirrors nested bachelor count)
- `src/data/english-masters.json` (654)
- `src/data/phd-research-lazio-south.json`
- `src/data/phd-research-centre-north.json`
- `src/data/admission-status-research.json`
- `src/data/imat-guide.md`
- `english-single-cycle-italy-research.json` (repo root)
- `scripts/build_english_masters.py`

### Public assets (`public/`)

| Path | Use |
| --- | --- |
| `ks-abroad-logo.png` | Header / footer |
| `robots.txt` | Generated by `src/app/robots.ts` (not a static public file) |
| `sitemap.xml` | Generated by `src/app/sitemap.ts` |
| `llms.txt` / `llms-full.txt` | AI discovery indexes (`src/app/llms*.txt/route.ts`) |
| `company/secp-incorporation-certificate.pdf` | About |
| `company/secp-acknowledgement-of-filing.pdf` | About |
| `guides/apostille-procedure.pdf` | Guides |
| `guides/consultancy-agreement.pdf` | Agreement |
| `guides/dov-checklist-sindh-balochistan.pdf` | DOV |
| `guides/erasmus-open-scholarship-archive-2023.pdf` | Erasmus archive |
| `guides/erasmus-without-ielts-archive-2023.pdf` | Erasmus archive |
| `guides/how-to-write-motivation-letter.pdf` | Motivation letter |
| `guides/post-admission-guide-complete.pdf` | Post-admission |
| `guides/post-admission-guide.pdf` | Post-admission |
| `guides/pre-enrollment-dov-study-visa-info.pdf` | Visa / DOV |
| `guides/scholarship-guide-lazio.pdf` | Lazio DSU |
| `guides/study-in-italy-document-steps.pdf` | Documents |
| `guides/study-visa-checklist-islamabad.pdf` | Visa |
| `guides/translation-companies-islamabad.pdf` | Translations |
| `file.svg` `globe.svg` `next.svg` `vercel.svg` `window.svg` | leftover Next placeholders |

### Root config

| File | Role |
| --- | --- |
| `package.json` | scripts: `dev` / `build` / `start` / `lint` on port 43127 |
| `next.config.ts` | security headers, CSP (`formsubmit.co`) |
| `src/middleware.ts` | admin noindex, probe 404s |
| `tsconfig.json` | `@/*` → `src/*` |
| `.env.example` | `ADMIN_PASSWORD`, secrets, `NEXT_PUBLIC_SITE_URL`, OpenAI / Resend / Twilio |
| `docs/*` | architecture pack + this index |

**AI discoverability:** set production `NEXT_PUBLIC_SITE_URL`, then verify `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/llms-full.txt`, and page-source JSON-LD (`application/ld+json`).

---

## 5. Conventions (do not break)

- New public pages: add `src/app/<route>/page.tsx`, then a header and/or footer link.
- New catalogue fields: update the JSON **and** the TypeScript type in `src/lib/*-types.ts` or `types.ts`.
- Explorers are client components; they receive arrays from server pages — do not fetch JSON from the browser.
- Contact: keep honeypot field `website`; rate limit stays in the route handler.
- Admin: compare passwords with `timingSafeEqual`; never expose `ADMIN_PASSWORD` in client bundles.
- `force-dynamic` on university/programme pages so status edits show immediately.
- Keep AI surfaces (`sitemap.ts`, `robots.ts`, `llms.txt`, JSON-LD) in sync when adding public routes — extend `STATIC_SITEMAP_PATHS` in `src/lib/seo.ts`.

---

## 6. Run / admin

```bash
cd ks-abroad-studies
npm install
npm run dev          # http://localhost:43127
npm run build && npm start
```

Admin UI: `/admin` with `ADMIN_PASSWORD` (header `x-admin-password`). Writes `src/data/universities.json` on disk. Programme-level verified requirements are a separate file, `src/data/programme-enrichment.json`, edited at `/admin/catalogue-review`. Back up that file with `npm run enrichment:backup`.
