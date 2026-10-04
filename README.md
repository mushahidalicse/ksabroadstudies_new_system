# KS Abroad Studies

Informative **Study in Italy** website for KS Abroad Studies (Private) Limited — SECP CUIN 0241969.

## What's included

- Universities with Open / Opening soon / Closed status for non-EU calls
- Universitaly pre-enrolment deadline **30 November 2026**
- **Erasmus Mundus 2027** guide (autumn 2026 applications; 2023 PDFs kept as archives only)
- Clean **Guides hub** → documents, translations, motivation letter, DOV/visa, scholarship docs
- Regional DSU scholarships + Pakistani LazioDisco paperwork
- **About** page with SECP incorporation certificate downloads
- Consultancy agreement with visa / liability disclaimers
- Admin panel for seasonal status updates

## Run locally

```bash
npm install
npm run build
ADMIN_PASSWORD=your-secret npm start -- -H 0.0.0.0 -p 43127
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

## Key routes

| Route | Purpose |
| --- | --- |
| `/erasmus` | Erasmus Mundus 2027 |
| `/guides` | Guide hub |
| `/guides/visa` | DOV + Islamabad/Karachi visa |
| `/guides/translations` | Embassy-listed translators |
| `/guides/motivation-letter` | Letter structure & tips |
| `/about` | SECP company certificates |
| `/agreement` | Service agreement |

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Lucide icons
