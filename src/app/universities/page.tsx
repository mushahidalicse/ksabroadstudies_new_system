import type { Metadata } from "next";
import Link from "next/link";
import { UniversityExplorer } from "@/components/university-explorer";
import { getMeta, getUniversities } from "@/lib/data";
import { readQuery } from "@/lib/search-query";
export const revalidate = 120;

export const metadata: Metadata = {
  title: "Italian Public Universities",
  description:
    "Searchable list of Italian public universities with admission portals, fees, English requirements, CGPA notes, and deadlines for international students.",
};

export default async function UniversitiesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await readQuery(searchParams);
  const [universities, meta] = await Promise.all([getUniversities(), getMeta()]);

  return (
    <div className="site-shell page-hero pb-12 md:pb-16">
      <p className="eyebrow">Intake {meta.intake}</p>
      <h1 className="display mt-3 text-4xl md:text-6xl max-w-4xl">
        Italian public universities — admission, requirements, deadlines
      </h1>
      <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
        Filter by <strong>Open</strong>, <strong>Opening soon</strong>, or{" "}
        <strong>Closed</strong> for non-EU / visa-applicant calls. Ordered{" "}
        <strong>Lazio → South → Centre → North</strong>. Universitaly
        pre-enrolment deadline: <strong>30 November 2026</strong>. Last curated:{" "}
        {meta.lastUpdated}.
      </p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
        <Link href="/study-in-italy" className="text-[var(--sea-deep)] hover:underline">
          Study in Italy hub
        </Link>
        <span className="text-[var(--ink-soft)]">·</span>
        <a
          href="https://www.universitaly.it/en"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--sea-deep)] hover:underline"
        >
          Universitaly official
        </a>
      </div>

      <div className="mt-10">
        <UniversityExplorer universities={universities} initialRegion={query.region || "all"} />
      </div>

      <p className="mt-8 text-sm text-[var(--ink-soft)] max-w-3xl">
        {meta.sourceNote}
      </p>
    </div>
  );
}
