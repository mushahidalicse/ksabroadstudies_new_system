import type { Metadata } from "next";
import Link from "next/link";
import { PhdExplorer } from "@/components/phd-explorer";
import { getPhdDataset, getPhdUniversities } from "@/lib/phd";
import { readQuery } from "@/lib/search-query";
export const revalidate = 120;

export const metadata: Metadata = {
  title: "PhD in Italy — procedure & universities",
  description:
    "A to Z Italian Dottorato (PhD) guide: PICA portal, requirements, scholarships, English-friendly programmes across 50+ universities for cycle XLII 2026/2027.",
};

export default async function PhdPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await readQuery(searchParams);
  const [data, universities] = await Promise.all([
    getPhdDataset(),
    getPhdUniversities(),
  ]);
  const g = data.guide;

  return (
    <div className="site-shell page-hero pb-16">
      <p className="eyebrow">
        Cycle {data.cycle} · A.Y. {data.academicYear}
      </p>
      <h1 className="display mt-3 text-4xl md:text-6xl max-w-4xl">{g.headline}</h1>
      <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
        {g.intro}
      </p>
      <p className="mt-3 text-sm font-semibold text-[var(--sea-deep)]">
        {data.universityCount} universities curated · {data.programmeCount} English-friendly
        PhD courses listed · Updated {data.lastUpdated}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <a href={g.picaLogin} target="_blank" rel="noreferrer" className="btn btn-sea">
          Open PICA login
        </a>
        <a href="#procedure" className="btn btn-outline">
          A–Z procedure
        </a>
        <a href="#universities" className="btn btn-outline">
          University list
        </a>
      </div>

      <section id="procedure" className="mt-14 scroll-mt-24">
        <p className="eyebrow">From shortlist to visa</p>
        <h2 className="display mt-2 text-3xl md:text-5xl">Procedure A to Z</h2>
        <ol className="mt-8 space-y-4">
          {g.procedure.map((step, i) => (
            <li key={step.title} className="panel rounded-3xl p-5 md:p-6">
              <div className="eyebrow">Step {i + 1}</div>
              <h3 className="display mt-1 text-2xl md:text-3xl">{step.title}</h3>
              <p className="mt-3 text-[var(--ink-soft)] leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <section className="panel rounded-3xl p-6 md:p-8">
          <h2 className="display text-3xl">Documents checklist</h2>
          <ul className="mt-5 space-y-2 text-sm text-[var(--ink-soft)]">
            {g.documentsChecklist.map((d) => (
              <li key={d}>· {d}</li>
            ))}
          </ul>
        </section>
        <section className="panel rounded-3xl p-6 md:p-8">
          <h2 className="display text-3xl">Using PICA (CINECA)</h2>
          <p className="mt-3 text-sm text-[var(--ink-soft)] leading-relaxed">
            Central login:{" "}
            <a href={g.picaLogin} className="font-semibold text-[var(--sea-deep)] hover:underline" target="_blank" rel="noreferrer">
              pica.cineca.it
            </a>
            . Each university still opens its own competition URL on that platform — or uses Esse3 / its own system instead.
          </p>
          <ol className="mt-4 space-y-2 text-sm text-[var(--ink-soft)]">
            {g.picaSteps.map((s, i) => (
              <li key={s.slice(0, 40)} className="flex gap-2">
                <span className="font-bold text-[var(--sea-deep)]">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="mt-8 panel rounded-3xl p-6 md:p-8 space-y-4">
        <h2 className="display text-3xl">English, scholarship & visa</h2>
        <p className="text-[var(--ink-soft)] leading-relaxed">{g.englishReality}</p>
        <p className="text-[var(--ink-soft)] leading-relaxed">{g.scholarshipNote}</p>
        <p className="text-[var(--ink-soft)] leading-relaxed">{g.universitalyNote}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/guides/visa" className="font-bold text-[var(--sea-deep)] hover:underline">
            Study visa guides →
          </Link>
          <Link href="/guides/motivation-letter" className="font-bold text-[var(--sea-deep)] hover:underline">
            Motivation / proposal tips →
          </Link>
          <Link href="/erasmus" className="font-bold text-[var(--sea-deep)] hover:underline">
            Erasmus Mundus (masters) →
          </Link>
        </div>
      </section>

      <section id="universities" className="mt-14 scroll-mt-24">
        <p className="eyebrow">Per university</p>
        <h2 className="display mt-2 text-3xl md:text-5xl max-w-3xl">
          PhD hubs, portals & English-friendly courses
        </h2>
        <p className="mt-4 max-w-3xl text-[var(--ink-soft)] leading-relaxed">
          {g.disclaimer}
        </p>
        <div className="mt-8">
          <PhdExplorer
            universities={universities}
            initialQuery={query.field || query.q}
            initialRegion={query.region || "all"}
          />
        </div>
      </section>
    </div>
  );
}
