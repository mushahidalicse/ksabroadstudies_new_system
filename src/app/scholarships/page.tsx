import type { Metadata } from "next";
import Link from "next/link";
import { ScholarshipExplorer } from "@/components/scholarship-explorer";
import { getScholarshipsDataset, getScholarshipRegions } from "@/lib/scholarships";
export const revalidate = 120;

export const metadata: Metadata = {
  title: "Italian Regional Scholarships",
  description:
    "Italian DSU/ERSU regional scholarship portals. Pakistani LazioDisco documents live on the Guides page.",
};

export default async function ScholarshipsPage() {
  const [dataset, regions] = await Promise.all([
    getScholarshipsDataset(),
    getScholarshipRegions(),
  ]);

  const openCount = regions.filter((r) => r.status === "open").length;

  return (
    <div className="site-shell page-hero pb-12 md:pb-16">
      <p className="eyebrow">Intake {dataset.intake}</p>
      <h1 className="display mt-3 text-4xl md:text-6xl max-w-4xl">
        Regional scholarships — official portals
      </h1>
      <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
        Filter by area for DiSCo / ERSU / ADISU portals. Pakistani document
        steps for LazioDisco are on a separate guide page so this list stays
        clean. Open now: {openCount}. Updated {dataset.lastUpdated}.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/scholarships/find" className="btn btn-outline">
          Scholarship finder
        </Link>
        <Link href="/guides/scholarship-docs" className="btn btn-sea">
          Pakistani scholarship documents
        </Link>
        <Link href="/erasmus" className="btn btn-outline">
          Erasmus Mundus 2027
        </Link>
      </div>

      <section className="mt-10 panel rounded-3xl p-6 md:p-8">
        <p className="eyebrow">National checklist</p>
        <h2 className="display mt-2 text-3xl">General DSU steps</h2>
        <ol className="mt-5 space-y-3">
          {dataset.generalGuide.steps.map((step, index) => (
            <li key={step} className="flex gap-3 text-[var(--ink-soft)] leading-relaxed">
              <span className="font-bold text-[var(--sea-deep)]">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-10">
        <ScholarshipExplorer regions={regions} />
      </div>
    </div>
  );
}
