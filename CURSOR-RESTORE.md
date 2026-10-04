# Cursor restore and run

Read this file first on any new device. This repository root **is** the KS Abroad Studies website. Do not nest it inside another `ks-abroad-studies` folder, and do not put site files outside this root.

GitHub: `https://github.com/mushahidalicse/ksabroadstudies_new_system`

The public catalogue and the application code in git match the original machine. Student accounts, document uploads, and research-job rows are **not** in git. A new device gets the same site and an empty portal database.

## Reset, then run

Do this only on a fresh clone, or when the user explicitly says to reset and run. If `data/pg` already exists and holds student data, do not delete it unless the user asked for a database reset.

Reset deletes generated local state only:

- `node_modules`
- `.next`
- root `data` (embedded PostgreSQL, uploads, runtime files)

Never delete `src`, `src/data`, `public`, `docs`, or `scripts`.

Requirements: Node.js 20 or newer. The original machine used Node `v24.19.0`.

From this repository root, in order:

1. `npm install`
2. If `.env` does not exist, copy `.env.example` to `.env`.
3. `npm run db:start`
4. `npm run dev`

Success looks like this:

- Site: http://localhost:43127
- Health: `GET http://127.0.0.1:43127/api/health` returns `{"ok":true,"database":"up"}`

`npm run dev` starts PostgreSQL when needed, then one Next.js server. If port `43127` is already this app and the health check is up, leave that server running.

Keep these values. Do not point the app at another database:

| What | Value |
| --- | --- |
| Website | `http://localhost:43127` (`npm run dev`, also `npm start`) |
| PostgreSQL | `127.0.0.1:54329` |
| Database | `ks_abroad` (test database `ks_abroad_test` is created too) |
| User | `postgres` |
| Cluster | `data/pg/cluster` |
| Password file | `data/pg/password` (created locally; never commit it) |

`npm run db:start` writes `DATABASE_URL` into `.env` for that local server. `npm run db:stop` stops it. `npm run db:status` prints host, port, database, and data directory.

The first app connection applies `src/lib/portal-store/schema.ts` through `ensureSchema()` in `src/lib/portal-store/db.ts`. Do not add a second schema. There are no PostgreSQL views. Pages under `src/app` are the UI views.

Leave API keys empty in git. Fill `ADMIN_PASSWORD` on that machine to use `/admin`. Fill `OPENAI_API_KEY` only if programme research should call OpenAI. Research defaults are already in `.env.example`: provider `openai`, model `gpt-5.5`, max tool calls `6`, search context `low`, reasoning `low`, max output tokens `1600`.

Do not commit `.env`, `.env.generated`, `data/`, `node_modules`, `.next`, or `.vercel`.

## What lives where

| Layer | Path | Role |
| --- | --- | --- |
| UI views | `src/app/**/page.tsx` | Public pages, portal, admin |
| HTTP backend | `src/app/api/**/route.ts` | Route handlers |
| Server logic | `src/lib` | Catalogue loaders, auth, portal, research |
| Portal database | `src/lib/portal-store` | PostgreSQL schema and queries |
| Catalogue JSON | `src/data` | Universities, programmes, guides. This is source, not the gitignored `data/` folder |
| Shared UI | `src/components` | Header, explorers, portal and admin panels |
| Local database process | `scripts/dev-postgres.mjs` | Embedded PostgreSQL |
| Dev entry | `scripts/dev-server.mjs` | Database, then Next.js on port 43127 |
| Identity | `src/lib/site.ts` | Company name, WhatsApp, email, social links |
| Deeper maps | `docs/INDEX.md`, `docs/architecture.md`, `docs/erd.md`, `docs/api-map.md`, `docs/sitemap.md` | Edit map. This file wins for setup and for the portal database |

Public programme lists come from nested `programs[]` in `src/data/universities.json`. Do not wire `src/data/english-bachelors.json` or `src/data/english-masters.json` unless the user asks. Those two files are archives.

Stack: Next.js `16.3.4` App Router, React `19.2.8`, TypeScript, Tailwind 4, `postgres` (postgres.js). Package name: `ks-abroad`.

## Catalogue files (`src/data`)

| File | Used for |
| --- | --- |
| `universities.json` | Universities and live bachelor, master, and single-cycle programmes |
| `programme-enrichment.json` | Approved programme facts layered on the catalogue |
| `phd.json` | PhD guide and programmes |
| `phd-research-lazio-south.json` | PhD research notes |
| `phd-research-centre-north.json` | PhD research notes |
| `regional-scholarships.json` | Regional DSU scholarships |
| `pakistan-guides.json` | Pakistan documents, visa, DOV, motivation |
| `translation-companies.json` | Translators |
| `erasmus.json` | Erasmus Mundus |
| `company.json` | About / SECP |
| `cent-s-guide.json` | CEnT-S text |
| `english-single-cycle.json` | IMAT text |
| `imat-guide.md` | IMAT guide source |
| `admission-status-research.json` | Admission status research notes |
| `english-bachelors.json` | Archive. Not loaded by the running app |
| `english-masters.json` | Archive. Not loaded by the running app |

## Portal database

Schema source: `src/lib/portal-store/schema.ts`. Applied automatically. Catalogue programmes stay in JSON.

| Table | Stores |
| --- | --- |
| `students` | Portal accounts. Email is unique case-insensitively. Profile and consent are JSONB |
| `shortlist_items` | Saved programmes per student |
| `student_documents` | Document metadata. File bytes go in `data/uploads`, or `UPLOAD_DIR` in production |
| `document_reviews` | Staff review of a document |
| `consultancy_cases` | Consultancy requests |
| `consultancy_replies` | Replies on a case |
| `applications` | Student applications |
| `application_events` | Status history for an application |
| `crm_cases` | One CRM case per student |
| `crm_notes` | CRM notes |
| `crm_tasks` | CRM tasks |
| `crm_events` | CRM timeline |
| `research_jobs` | Programme research jobs |
| `research_results` | JSON result for a job. Stays pending until a person approves it |
| `staff_accounts` | Staff login and role |
| `service_catalog` | Consultancy services |
| `student_notifications` | Portal notifications |
| `notification_preferences` | Per-student notification switches |
| `message_templates` | Staff message templates |
| `staff_audit_log` | Staff audit trail |
| `unresolved_records` | Import rows that could not be matched |

Query modules next to the schema: `db.ts`, `students.ts`, `shortlist.ts`, `uploads.ts`, `consultancy.ts`, `applications.ts`, `crm.ts`, `research.ts`, `staff.ts`, `operations.ts`, `notifications.ts`, `preferences.ts`, `templates.ts`, `audit.ts`, `migrate.ts`.

JSON import, only when asked: `npm run db:migrate` runs `scripts/migrate-portal-json.ts`. Portal checks: `npm run test:portal`.

## UI views (`src/app`)

| Area | Pages |
| --- | --- |
| Public | `page.tsx`, `about`, `agreement`, `contact`, `cookies`, `privacy`, `process`, `study-in-italy`, `erasmus` |
| Universities | `universities/page.tsx`, `universities/[id]/page.tsx` |
| Programmes | `programs/page.tsx`, `programs/bachelor`, `programs/master`, `programs/single-cycle`, `programs/english`, `programs/find`, `programs/compare`, `programs/shortlist`, `programs/p/[slug]` |
| PhD | `phd/page.tsx`, `phd/[id]/page.tsx` |
| Scholarships | `scholarships/page.tsx`, `scholarships/[id]`, `scholarships/find` |
| Guides | `guides/page.tsx`, `guides/documents`, `guides/translations`, `guides/motivation-letter`, `guides/dov`, `guides/visa`, `guides/scholarship-docs` |
| Account | `login/page.tsx`, `register/page.tsx` |
| Student portal | `portal/page.tsx`, `portal/matches`, `portal/notifications` |
| Tools | `tools/italy-cost-calculator/page.tsx` |
| Admin | `admin/page.tsx`, `admin/catalogue-review`, `admin/crm`, `admin/crm/[id]`, `admin/operations`, `admin/communications`, `admin/audit`, `admin/research` |

Shared layout and styles: `src/app/layout.tsx`, `src/app/globals.css`, `src/middleware.ts`.

Main panels in `src/components`: `site-header.tsx`, `site-footer.tsx`, `auth-bar.tsx`, `university-explorer.tsx`, `program-explorer.tsx`, `programme-finder.tsx`, `phd-explorer.tsx`, `scholarship-explorer.tsx`, `portal-desk.tsx`, `document-vault.tsx`, `consultancy-panel.tsx`, `admin-crm.tsx`, `admin-operations.tsx`, `admin-communications.tsx`, `admin-audit.tsx`, `admin-research.tsx`, `catalogue-review.tsx`, `contact-form.tsx`, `ai-bot.tsx`.

## Backend routes (`src/app/api`)

| Method | Path | File |
| --- | --- | --- |
| GET | `/api/health` | `api/health/route.ts` |
| POST | `/api/contact` | `api/contact/route.ts` |
| POST | `/api/auth/register` | `api/auth/register/route.ts` |
| POST | `/api/auth/login` | `api/auth/login/route.ts` |
| POST | `/api/auth/logout` | `api/auth/logout/route.ts` |
| GET | `/api/auth/me` | `api/auth/me/route.ts` |
| GET, PUT | `/api/portal/profile` | `api/portal/profile/route.ts` |
| GET, POST | `/api/portal/documents` | `api/portal/documents/route.ts` |
| GET, POST | `/api/portal/shortlist` | `api/portal/shortlist/route.ts` |
| GET, POST | `/api/portal/applications` | `api/portal/applications/route.ts` |
| GET, POST | `/api/portal/matches` | `api/portal/matches/route.ts` |
| GET, POST | `/api/portal/services` | `api/portal/services/route.ts` |
| GET, POST | `/api/portal/document-reviews` | `api/portal/document-reviews/route.ts` |
| GET, POST | `/api/portal/notifications` | `api/portal/notifications/route.ts` |
| GET, POST | `/api/portal/notification-preferences` | `api/portal/notification-preferences/route.ts` |
| GET, POST | `/api/portal/privacy` | `api/portal/privacy/route.ts` |
| POST, GET | `/api/consultancy` | `api/consultancy/route.ts` |
| GET | `/api/consultancy/[id]` | `api/consultancy/[id]/route.ts` |
| POST | `/api/consultancy/[id]/reply` | `api/consultancy/[id]/reply/route.ts` |
| GET, PUT | `/api/admin/universities` | `api/admin/universities/route.ts` |
| GET, PUT, POST, DELETE | `/api/admin/catalogue-review` | `api/admin/catalogue-review/route.ts` |
| GET, POST | `/api/admin/crm` | `api/admin/crm/route.ts` |
| GET, POST | `/api/admin/staff` | `api/admin/staff/route.ts` |
| GET, POST | `/api/admin/operations` | `api/admin/operations/route.ts` |
| GET | `/api/admin/operations/file` | `api/admin/operations/file/route.ts` |
| GET, POST | `/api/admin/communications` | `api/admin/communications/route.ts` |
| GET | `/api/admin/audit` | `api/admin/audit/route.ts` |
| GET, POST | `/api/admin/research` | `api/admin/research/route.ts` |
| GET, POST | `/api/admin/consultancy` | `api/admin/consultancy/route.ts` |
| GET, POST | `/api/admin/applications` | `api/admin/applications/route.ts` |
| POST | `/api/bot/chat` | `api/bot/chat/route.ts` |
| POST | `/api/notify/test` | `api/notify/test/route.ts` |
| GET | `/api/v1` | `api/v1/route.ts` |
| GET | `/api/v1/search` | `api/v1/search/route.ts` |
| GET | `/api/v1/universities` | `api/v1/universities/route.ts` |
| GET | `/api/v1/programs` | `api/v1/programs/route.ts` |
| GET | `/api/v1/openapi` | `api/v1/openapi/route.ts` |

Server libraries beside the routes:

| Path | Role |
| --- | --- |
| `src/lib/data.ts` | Reads `universities.json` |
| `src/lib/programme-catalogue.ts`, `programme-store.ts`, `programme-filters.ts` | Programme lists and filters |
| `src/lib/programme-enrichment.ts`, `enrichment-store.ts` | Enrichment overlay |
| `src/lib/auth.ts`, `students.ts`, `student-types.ts` | Accounts and sessions |
| `src/lib/match-student.ts` | Profile match and shortlist ranking |
| `src/lib/security.ts`, `src/middleware.ts` | Headers, CSRF, rate limits |
| `src/lib/notify.ts` | Email and SMS |
| `src/lib/research` | Official-site discovery, identity check, fact extraction, admission search. Jobs stay in PostgreSQL until approved |

Research entry points: `src/lib/research/run-research.ts`, `provider.ts`, `openai-provider.ts`, `official-discovery.ts`, `identity-gate.ts`, `extract-facts.ts`, `validate-research.ts`, `approve-research.ts`. Mock provider is `mock-provider.ts`. Grok is unused unless `XAI_API_KEY` is set later.

## After it is running

Open http://localhost:43127 and confirm the home page, `/universities`, and `/programs/master` render from `src/data/universities.json`. Confirm `/api/health` reports the database up. Register and login only after that health check passes.

Do not approve or publish research from this setup step. Do not change ports, schema, or catalogue wiring while restoring the project.
