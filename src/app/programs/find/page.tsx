import type { Metadata } from "next";
import Link from "next/link";
import { FindProgramme } from "@/components/find-programme";
import { getCatalogue } from "@/lib/data";
import { finderQueryFromRecord } from "@/lib/programme-filters";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Find My Programme",
  description:
    "Filter English-taught programmes in Italy by level, field, region, fee, and published deadline status.",
};

export default async function FindProgrammePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = searchParams ? await searchParams : {};
  const one = (key: string) => {
    const value = raw[key];
    return (Array.isArray(value) ? value[0] : value) || "";
  };
  const initial = finderQueryFromRecord({
    q: one("q"),
    level: one("level"),
    field: one("field"),
    region: one("region"),
    city: one("city"),
    english: one("english"),
    fee: one("fee"),
    status: one("status"),
    sort: one("sort"),
    cent: one("cent"),
    gre: one("gre"),
    test: one("test"),
  });
  const programmes = await getCatalogue();

  return (
    <div className="site-shell page-hero pb-16">
      <Link href="/" className="text-sm font-semibold text-[var(--sea-deep)] hover:underline">
        ← Home
      </Link>
      <p className="eyebrow mt-6">Student decision</p>
      <h1 className="display mt-3 text-4xl md:text-6xl max-w-4xl">Find My Programme</h1>
      <p className="mt-4 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
        Find English-taught programmes in Italy that match your profile. This is a filter of the published catalogue, not an admission decision.
      </p>
      <div className="mt-8">
        <FindProgramme programmes={programmes} initial={initial} />
      </div>
    </div>
  );
}
