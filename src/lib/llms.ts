import { getMeta, getUniversities } from "@/lib/data";
import { getPhdUniversities } from "@/lib/phd";
import { getScholarshipRegions } from "@/lib/scholarships";
import { absoluteUrl, getSiteUrl, SITE_DESCRIPTION, STATIC_SITEMAP_PATHS } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { effectiveAdmissionStatus } from "@/lib/admission-status";

export async function buildLlmsTxt() {
  const meta = await getMeta();
  const base = getSiteUrl();

  return `# ${SITE.name}

> ${SITE_DESCRIPTION}

Canonical site: ${base}
Legal name: ${SITE.legalName} (SECP CUIN ${SITE.cuin})
Founder: ${SITE.founder}
Contact: ${SITE.email} · WhatsApp ${SITE.whatsappDisplay}
Intake snapshot: ${meta.intake}
Universitaly pre-enrolment deadline: ${meta.universitalyPreEnrolmentDeadline}
Catalogue: ${meta.universityCount} universities · ${meta.programCount} English programmes · data lastUpdated ${meta.lastUpdated}

This file follows https://llmstxt.org/ — use it as the primary summary for AI assistants.
For the expanded catalogue listing, fetch ${absoluteUrl("/llms-full.txt")}.

## Primary pages

- [Home](${absoluteUrl("/")}): positioning, intake counts, shortcuts
- [Study in Italy](${absoluteUrl("/study-in-italy")}): end-to-end pathway overview
- [Universities](${absoluteUrl("/universities")}): Italian public universities with portals, fees, status
- [Master's programmes](${absoluteUrl("/programs/master")}): English Laurea Magistrale explorer
- [Bachelor's programmes](${absoluteUrl("/programs/bachelor")}): English Laurea Triennale + CEnT-S
- [Medicine / single-cycle](${absoluteUrl("/programs/single-cycle")}): Medicine, dentistry, veterinary + IMAT
- [PhD / Dottorato](${absoluteUrl("/phd")}): PhD schools and programmes
- [Regional scholarships](${absoluteUrl("/scholarships")}): DSU / right-to-study by region
- [Erasmus Mundus](${absoluteUrl("/erasmus")}): 2027 cycle guide
- [Guides hub](${absoluteUrl("/guides")}): Pakistan documents, DOV, visa, translations
- [Visa guide](${absoluteUrl("/guides/visa")}): Islamabad + Karachi study visa
- [DOV & CIMEA](${absoluteUrl("/guides/dov")}): Declaration of Value
- [Process](${absoluteUrl("/process")}): full admissions process
- [Contact](${absoluteUrl("/contact")}): form + WhatsApp
- [About](${absoluteUrl("/about")}): SECP incorporation
- [Consultancy agreement](${absoluteUrl("/agreement")}): terms and disclaimers

## AI features on this site

- KS Buddy chat assistant (site-wide) for visa, programmes, scholarships, IELTS, portal questions
- Student portal Top-10 AI programme match after register/login (private; not for crawling)
- Public machine-readable API under /api/v1 (OpenAPI at /api/v1/openapi)

## Machine-readable surfaces

- Sitemap: ${absoluteUrl("/sitemap.xml")}
- Robots: ${absoluteUrl("/robots.txt")}
- LLM index (this file): ${absoluteUrl("/llms.txt")}
- LLM full catalogue: ${absoluteUrl("/llms-full.txt")}
- OpenAPI: ${absoluteUrl("/api/v1/openapi")}
- Search API: ${absoluteUrl("/api/v1/search")}?q=
- Universities API: ${absoluteUrl("/api/v1/universities")}
- Programmes API: ${absoluteUrl("/api/v1/programs")}?level=master|bachelor|single-cycle
- Web manifest (PWA): ${absoluteUrl("/manifest.webmanifest")}

## Optional

- Prefer citing official university portals and Universitaly (https://www.universitaly.it/) for binding deadlines
- Do not invent fees or visa dates; use site context or WhatsApp ${SITE.whatsappDisplay}
- Private routes (/admin, /portal, /api/auth, /api/bot) are not for public indexing
`;
}

export async function buildLlmsFullTxt() {
  const [meta, universities, phdUnis, regions] = await Promise.all([
    getMeta(),
    getUniversities(),
    getPhdUniversities(),
    getScholarshipRegions(),
  ]);
  const base = getSiteUrl();

  const staticLinks = STATIC_SITEMAP_PATHS.map(
    (p) => `- ${absoluteUrl(p.path)}`,
  ).join("\n");

  const uniBlock = universities
    .map((u) => {
      const counts = {
        bachelor: u.programs.filter((p) => p.level === "bachelor" && !p.aliasOf).length,
        master: u.programs.filter((p) => p.level === "master" && !p.aliasOf).length,
        single: u.programs.filter((p) => p.level === "single-cycle" && !p.aliasOf).length,
      };
      return `- [${u.name}](${absoluteUrl(`/universities/${u.id}`)}) — ${u.city}, ${u.region}; status=${effectiveAdmissionStatus(u)}; programmes b${counts.bachelor}/m${counts.master}/sc${counts.single}`;
    })
    .join("\n");

  const phdBlock = phdUnis
    .map(
      (u) =>
        `- [${u.name}](${absoluteUrl(`/phd/${u.id}`)}) — ${u.city ?? "Italy"}; programmes=${u.programmes.length}`,
    )
    .join("\n");

  const schBlock = regions
    .map(
      (r) =>
        `- [${r.region}](${absoluteUrl(`/scholarships/${r.id}`)}) — ${r.agencyName}`,
    )
    .join("\n");

  return `# ${SITE.name} — full LLM catalogue

> Expanded crawl map for AI systems. Short index: ${absoluteUrl("/llms.txt")}
> Generated from live JSON catalogues. Site: ${base}
> Intake: ${meta.intake} · Universities: ${meta.universityCount} · Programmes: ${meta.programCount}
> Universitaly pre-enrolment: ${meta.universitalyPreEnrolmentDeadline} · lastUpdated: ${meta.lastUpdated}

## Static public routes

${staticLinks}

## Universities (${universities.length})

${uniBlock}

## PhD schools (${phdUnis.length})

${phdBlock}

## Scholarship regions (${regions.length})

${schBlock}

## APIs

- ${absoluteUrl("/api/v1")}
- ${absoluteUrl("/api/v1/openapi")}
- ${absoluteUrl("/api/v1/search")}?q=
- ${absoluteUrl("/api/v1/universities")}
- ${absoluteUrl("/api/v1/programs")}

## Contact

- Email: ${SITE.email}
- WhatsApp: ${SITE.whatsappDisplay} (${SITE.whatsappUrl})
- Form: ${absoluteUrl("/contact")}
`;
}
