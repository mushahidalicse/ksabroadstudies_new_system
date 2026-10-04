import { buildRequirements, type CatalogueRequirements } from "@/lib/catalogue-requirements";
import { describeDeadline, type FinderStatus } from "@/lib/deadline-display";
import type { PhdProgramme, PhdUniversity } from "@/lib/phd-types";
import type { AdmissionStatus, ProgramLevel, ProgrammeHistoricalTitle, UniversitiesDataset, University } from "@/lib/types";
import { effectiveAdmissionStatus } from "@/lib/admission-status";

export type CatalogueLevel = ProgramLevel | "phd";

export type CatalogueCard = {
  slug: string;
  name: string;
  level: CatalogueLevel;
  field: string;
  universityId: string;
  universityName: string;
  city: string;
  region: string;
  language: string;
  status: AdmissionStatus;
  finderStatus: FinderStatus;
  deadline: string | null;
  deadlineLabel: string;
  countdown: string | null;
  estimatedDeadline: boolean;
  applicationFeeEuro: number | null;
  englishRequirement: string;
  admissionTest: string | null;
  centS: boolean;
  greGmat: boolean;
  requiresCimea: boolean | null;
  applyUrl: string | null;
  admissionPortal: string | null;
  universityWebsite: string | null;
  catalogueChecked: string;
  verificationStatus: "verified" | "partially_verified" | "needs_review";
  sourceUrl: string | null;
  sourceTitle: string | null;
  /** The programme's own recorded page. A discovery hint for research, not identity proof. */
  programmeUrl?: string | null;
  intake: string;
  requirements: CatalogueRequirements;
  /** Where the resolved structured requirements came from. */
  requirementOrigin: "verified" | "partial" | "catalogue" | "unknown";
  enrichmentStatus: "needs_review" | "partially_verified" | "verified" | "outdated" | null;
  enrichmentSourceUrl: string | null;
  enrichmentSourceTitle: string | null;
  enrichmentSourceType: string | null;
  enrichmentLastChecked: string | null;
  enrichmentAcademicYear: string | null;
  /** Public cards are current. A historical card exists only so an old slug can resolve. */
  listing?: "current" | "historical";
  canonicalSlug?: string;
  aliasSlugs?: string[];
  historicalTitles?: string[];
  italianTitle?: string | null;
  degreeClass?: string | null;
  renames?: ProgrammeHistoricalTitle[];
};

const REGIONS = new Set(["lazio", "south", "centre", "north"]);

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function originFor(requirements: CatalogueRequirements): "catalogue" | "unknown" {
  const english = requirements.english;
  const known =
    english.ieltsMin != null ||
    english.toeflMin != null ||
    english.moiAccepted != null ||
    english.level != null ||
    requirements.test.required === true ||
    requirements.tuition != null ||
    requirements.academic.minimumCgpa != null ||
    requirements.academic.minimumPercentage != null;
  return known ? "catalogue" : "unknown";
}

export const BLANK_ENRICHMENT = {
  requirementOrigin: "catalogue" as const,
  enrichmentStatus: null,
  enrichmentSourceUrl: null,
  enrichmentSourceTitle: null,
  enrichmentSourceType: null,
  enrichmentLastChecked: null,
  enrichmentAcademicYear: null,
};

function enrichmentMeta(requirements: CatalogueRequirements) {
  return {
    ...BLANK_ENRICHMENT,
    requirementOrigin: originFor(requirements),
  };
}

function firstUrl(text: string | null | undefined) {
  const match = String(text ?? "").match(/https?:\/\/[^\s)]+/i);
  return match ? match[0].replace(/[.,;]+$/, "") : null;
}

function uniqueSlug(base: string, used: Set<string>) {
  let slug = base || "programme";
  let n = 2;
  while (used.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  used.add(slug);
  return slug;
}

function flags(test: string | null, name: string) {
  const hay = `${test || ""} ${name}`.toLowerCase();
  return {
    centS: /cent-s|cents|cisia/.test(hay),
    greGmat: /\bgre\b|\bgmat\b/.test(hay),
  };
}

function universityVerification(uni: University) {
  const programmeSource = firstUrl(uni.notes);
  const verifiedInNote = /verified\s+\d{4}-\d{2}-\d{2}/i.test(uni.notes || "");
  if (programmeSource || verifiedInNote) {
    return {
      verificationStatus: "partially_verified" as const,
      sourceUrl: programmeSource,
      sourceTitle: programmeSource ? "Link in the university note" : null,
    };
  }
  return {
    verificationStatus: "needs_review" as const,
    sourceUrl: null,
    sourceTitle: null,
  };
}

export function buildDegreeCatalogue(dataset: UniversitiesDataset): CatalogueCard[] {
  const used = new Set<string>();
  const rows: CatalogueCard[] = [];
  for (const uni of dataset.universities) {
    const status = effectiveAdmissionStatus(uni);
    const deadlineView = describeDeadline({ status, deadline: uni.deadline });
    const verification = universityVerification(uni);
    for (const program of uni.programs) {
      const ownSource = firstUrl(program.sourceUrl);
      const test = program.admissionTest?.trim() || null;
      const mark = flags(test, program.name);
      const verified = program.verificationStatus === "verified" && Boolean(ownSource || program.sourceUrl);
      rows.push({
        slug: uniqueSlug(slugify(`${uni.id}-${program.level}-${program.name}`), used),
        name: program.name,
        level: program.level,
        field: program.field || "",
        universityId: uni.id,
        universityName: uni.name,
        city: uni.city,
        region: uni.region,
        language: "English",
        status,
        finderStatus: deadlineView.finderStatus,
        deadline: uni.deadline,
        deadlineLabel: deadlineView.deadlineLabel,
        countdown: deadlineView.countdown,
        estimatedDeadline: deadlineView.estimated,
        applicationFeeEuro: uni.applicationFeeEuro,
        englishRequirement: uni.englishRequirement || "",
        admissionTest: test,
        centS: mark.centS,
        greGmat: mark.greGmat,
        requiresCimea: uni.requiresCimea,
        applyUrl: program.applyUrl,
        admissionPortal: uni.admissionPortal || null,
        universityWebsite: uni.website || null,
        catalogueChecked: program.lastVerified || dataset.lastUpdated,
        verificationStatus: verified ? "verified" : ownSource ? "partially_verified" : verification.verificationStatus,
        sourceUrl: ownSource || program.sourceUrl || verification.sourceUrl,
        programmeUrl: ownSource,
        sourceTitle: program.sourceTitle || verification.sourceTitle,
        intake: dataset.intake,
        requirements: buildRequirements({
          englishRequirement: uni.englishRequirement,
          admissionTest: test,
          notes: uni.notes,
          cgpaRequirement: uni.cgpaRequirement,
        }),
        ...enrichmentMeta(
          buildRequirements({
            englishRequirement: uni.englishRequirement,
            admissionTest: test,
            notes: uni.notes,
            cgpaRequirement: uni.cgpaRequirement,
          }),
        ),
        listing: "current",
        canonicalSlug: "",
        aliasSlugs: [],
        historicalTitles: (program.historicalTitles ?? []).map((item) => item.title),
        italianTitle: program.italianTitle ?? null,
        degreeClass: program.degreeClass ?? null,
        renames: program.historicalTitles ?? [],
      });
    }
  }
  linkRenamedProgrammes(dataset, rows);
  return rows.sort((a, b) => a.name.localeCompare(b.name) || a.universityName.localeCompare(b.universityName));
}

function linkRenamedProgrammes(dataset: UniversitiesDataset, rows: CatalogueCard[]) {
  for (const row of rows) {
    if (!row.canonicalSlug) row.canonicalSlug = row.slug;
  }
  for (const uni of dataset.universities) {
    for (const program of uni.programs) {
      const targetName = program.aliasOf?.trim();
      if (!targetName) continue;
      const alias = rows.find((row) => row.universityId === uni.id && row.level === program.level && row.name === program.name);
      const canonical = rows.find((row) => row.universityId === uni.id && row.level === program.level && row.name === targetName && row.listing !== "historical");
      if (!alias || !canonical || alias.slug === canonical.slug) continue;
      alias.listing = "historical";
      alias.canonicalSlug = canonical.slug;
      canonical.aliasSlugs = [...new Set([...(canonical.aliasSlugs ?? []), alias.slug])];
      const titles = new Set(canonical.historicalTitles ?? []);
      titles.add(alias.name);
      canonical.historicalTitles = [...titles];
    }
  }
}

export function publicCatalogue(cards: CatalogueCard[]) {
  return cards.filter((card) => card.listing !== "historical");
}

export function resolveCatalogueSlug(programmes: CatalogueCard[], slug: string) {
  if (programmes.some((item) => item.slug === slug)) return slug;
  return programmes.find((item) => (item.aliasSlugs ?? []).includes(slug))?.slug ?? slug;
}

export function dedupeResolvedSlugs(programmes: CatalogueCard[], slugs: string[]) {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const slug of slugs) {
    const resolved = resolveCatalogueSlug(programmes, slug);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    next.push(resolved);
  }
  return next;
}

export function buildPhdCatalogue(
  universities: PhdUniversity[],
  meta: { lastUpdated: string; academicYear: string },
): CatalogueCard[] {
  const used = new Set<string>();
  const rows: CatalogueCard[] = [];
  for (const uni of universities) {
    const region = uni.region && REGIONS.has(uni.region) ? uni.region : "";
    const source = (uni.sources || []).map((item) => firstUrl(item)).find(Boolean) || null;
    for (const program of uni.programmes) {
      rows.push(phdRow(uni, program, region, source, meta, used));
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name) || a.universityName.localeCompare(b.universityName));
}

function phdRow(
  uni: PhdUniversity,
  program: PhdProgramme,
  region: string,
  source: string | null,
  meta: { lastUpdated: string; academicYear: string },
  used: Set<string>,
): CatalogueCard {
  const test = null;
  const mark = flags(test, program.name);
  return {
    slug: uniqueSlug(slugify(`phd-${uni.id}-${program.name}`), used),
    name: program.name,
    level: "phd",
    field: program.field || "",
    universityId: uni.id,
    universityName: uni.name,
    city: uni.city || "",
    region,
    language: program.language?.trim() || "Check official source",
    status: "tba",
    finderStatus: "unannounced",
    deadline: uni.typicalDeadlineWindow,
    deadlineLabel: uni.typicalDeadlineWindow
      ? `Typical window: ${uni.typicalDeadlineWindow}`
      : "Deadline not announced",
    countdown: null,
    estimatedDeadline: true,
    applicationFeeEuro: null,
    englishRequirement: uni.englishNote || "",
    admissionTest: test,
    centS: mark.centS,
    greGmat: mark.greGmat,
    requiresCimea: null,
    applyUrl: program.applyUrl,
    admissionPortal: uni.applicationPortal,
    universityWebsite: uni.website || uni.phdHubUrl,
    catalogueChecked: meta.lastUpdated,
    verificationStatus: source ? "partially_verified" : "needs_review",
    sourceUrl: source,
    sourceTitle: source ? "Source listed on the PhD record" : null,
    intake: meta.academicYear,
    requirements: buildRequirements({
      englishRequirement: uni.englishNote,
      admissionTest: test,
      notes: null,
      cgpaRequirement: null,
    }),
    ...enrichmentMeta(
      buildRequirements({
        englishRequirement: uni.englishNote,
        admissionTest: test,
        notes: null,
        cgpaRequirement: null,
      }),
    ),
  };
}
