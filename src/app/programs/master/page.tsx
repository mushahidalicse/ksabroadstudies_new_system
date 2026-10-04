import type { Metadata } from "next";
import Link from "next/link";
import { MasterProgrammeList } from "@/components/master-programme-list";
import { getMeta, getPrograms } from "@/lib/data";
import { readQuery } from "@/lib/search-query";
export const revalidate = 120;

export const metadata: Metadata = {
  title: "Master's Programmes in English",
  description:
    "English-taught master's programmes at Italian public universities with direct programme or admission portal links.",
};

export default async function MasterProgramsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await readQuery(searchParams);
  const [programs, meta] = await Promise.all([getPrograms("master"), getMeta()]);

  return (
    <div className="site-shell page-hero pb-12 md:pb-16">
      <Link href="/" className="text-sm font-semibold text-[var(--sea-deep)] hover:underline">
        ← Home
      </Link>
      <p className="eyebrow mt-6">Intake {meta.intake}</p>
      <h1 className="display mt-3 text-4xl md:text-6xl max-w-4xl">
        Master&apos;s programmes in English
      </h1>
      <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
        {meta.masterCount} English master&apos;s programmes listed for international
        applicants. Open a programme page or jump to the university admission
        portal from the university profile.
      </p>
      <div className="mt-10">
        <MasterProgrammeList
          programs={programs}
          initialField={query.field}
          initialRegion={query.region}
          initialStatus={query.status}
          initialFee={query.fee}
        />
      </div>
    </div>
  );
}
