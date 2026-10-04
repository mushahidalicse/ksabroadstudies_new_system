import { promises as fs } from "fs";
import path from "path";
import { bustCacheTag, cachedJsonReader, CACHE_TAGS } from "@/lib/cache";
import { getPhdDataset } from "@/lib/phd";
import { buildDegreeCatalogue, buildPhdCatalogue, publicCatalogue, type CatalogueCard } from "@/lib/programme-catalogue";
import type { ProgramLevel, UniversitiesDataset, University } from "@/lib/types";
import { effectiveAdmissionStatus } from "@/lib/admission-status";
import { describeDeadline } from "@/lib/deadline-display";
import { withEnrichment } from "@/lib/enrichment-store";

const DATA_PATH = path.join(process.cwd(), "src/data/universities.json");

async function readDatasetFromDisk(): Promise<UniversitiesDataset> {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  return JSON.parse(raw) as UniversitiesDataset;
}

/** Cached catalogue read — safe for high-traffic public pages. */
export async function getDataset(): Promise<UniversitiesDataset> {
  return cachedJsonReader(CACHE_TAGS.universities, "universities-dataset", readDatasetFromDisk);
}

/** Uncached read for admin mutations. */
export async function getDatasetFresh(): Promise<UniversitiesDataset> {
  return readDatasetFromDisk();
}

export async function saveDataset(dataset: UniversitiesDataset): Promise<void> {
  await fs.writeFile(DATA_PATH, JSON.stringify(dataset, null, 2) + "\n", "utf8");
  bustCacheTag(CACHE_TAGS.universities);
}

export async function getUniversities(): Promise<University[]> {
  const dataset = await getDataset();
  return [...dataset.universities].sort((a, b) => {
    const pa = a.priority ?? 99;
    const pb = b.priority ?? 99;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

export async function getUniversity(id: string): Promise<University | undefined> {
  const universities = await getUniversities();
  return universities.find((u) => u.id === id);
}

async function allCatalogueCards(): Promise<CatalogueCard[]> {
  const [dataset, phd] = await Promise.all([getDataset(), getPhdDataset()]);
  return withEnrichment([
    ...buildDegreeCatalogue(dataset),
    ...buildPhdCatalogue(phd.universities, {
      lastUpdated: phd.lastUpdated,
      academicYear: phd.academicYear,
    }),
  ]);
}

export async function getPrograms(level?: ProgramLevel): Promise<CatalogueCard[]> {
  const dataset = await getDataset();
  const rows = publicCatalogue(await withEnrichment(buildDegreeCatalogue(dataset)));
  return level ? rows.filter((row) => row.level === level) : rows;
}

export async function getCatalogue(): Promise<CatalogueCard[]> {
  return publicCatalogue(await allCatalogueCards());
}

export async function getProgrammeBySlug(slug: string): Promise<CatalogueCard | undefined> {
  const rows = await allCatalogueCards();
  const match = rows.find((row) => row.slug === slug)
    ?? rows.find((row) => (row.aliasSlugs ?? []).includes(slug));
  if (!match) return undefined;
  if (match.listing === "historical" && match.canonicalSlug && match.canonicalSlug !== match.slug) {
    return rows.find((row) => row.slug === match.canonicalSlug) ?? match;
  }
  return match;
}

export async function getMeta() {
  const dataset = await getDataset();
  const statusCounts = dataset.universities.reduce(
    (acc, u) => {
      const status = effectiveAdmissionStatus(u);
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  return {
    intake: dataset.intake,
    lastUpdated: dataset.lastUpdated,
    sourceNote: dataset.sourceNote,
    nextFeeReview: dataset.nextFeeReview ?? null,
    universitalyPreEnrolmentDeadline:
      dataset.universitalyPreEnrolmentDeadline ?? "2026-11-30",
    universityCount: dataset.universities.length,
    programCount: dataset.universities.reduce(
      (sum, u) => sum + u.programs.filter((program) => !program.aliasOf).length,
      0,
    ),
    bachelorCount: dataset.universities.reduce(
      (sum, u) => sum + u.programs.filter((p) => p.level === "bachelor" && !p.aliasOf).length,
      0,
    ),
    masterCount: dataset.universities.reduce(
      (sum, u) => sum + u.programs.filter((p) => p.level === "master" && !p.aliasOf).length,
      0,
    ),
    singleCycleCount: dataset.universities.reduce(
      (sum, u) =>
        sum + u.programs.filter((p) => p.level === "single-cycle" && !p.aliasOf).length,
      0,
    ),
    openCount: statusCounts.open ?? 0,
    soonCount: statusCounts.soon ?? 0,
    closedCount: statusCounts.closed ?? 0,
    closingSoonCount: dataset.universities.filter((uni) => {
      const status = effectiveAdmissionStatus(uni);
      return describeDeadline({ status, deadline: uni.deadline }).finderStatus === "closing";
    }).length,
  };
}
