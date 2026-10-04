import type { Metadata } from "next";
import Link from "next/link";
import { ProgramExplorer } from "@/components/program-explorer";
import { getCentSGuide } from "@/lib/cent-s";
import { getMeta, getPrograms } from "@/lib/data";
import { readQuery } from "@/lib/search-query";
export const revalidate = 120;

export const metadata: Metadata = {
  title: "Bachelor's Programmes in English",
  description:
    "English-taught bachelor's programmes at Italian public universities, with full CEnT-S admission test guidance for Engineering, Economics and sciences.",
};

export default async function BachelorProgramsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await readQuery(searchParams);
  const [programs, meta, centS] = await Promise.all([
    getPrograms("bachelor"),
    getMeta(),
    getCentSGuide(),
  ]);

  return (
    <div className="site-shell page-hero pb-12 md:pb-16">
      <Link href="/" className="text-sm font-semibold text-[var(--sea-deep)] hover:underline">
        ← Home
      </Link>
      <p className="eyebrow mt-6">Intake {meta.intake}</p>
      <h1 className="display mt-3 text-4xl md:text-6xl max-w-4xl">
        Bachelor&apos;s degrees in English
      </h1>
      <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
        {meta.bachelorCount} English-taught 3-year programmes (Laurea Triennale).
        Many Engineering, Economics / Business and science tracks require the
        CISIA <strong>CEnT-S</strong> test. Medicine / Dentistry / Veterinary are
        under{" "}
        <Link
          href="/programs/single-cycle"
          className="font-semibold text-[var(--sea-deep)] hover:underline"
        >
          Single-cycle / Medicine
        </Link>
        .
      </p>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
        <a href="#cents" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          CEnT-S guide
        </a>
        <a href="#list" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          Programme list
        </a>
        <Link href="/process#tests" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          Full CEnT-S procedure
        </Link>
        <Link href="/programs/single-cycle" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          Medicine / IMAT
        </Link>
      </nav>

      <section id="cents" className="mt-10 panel rounded-3xl p-6 md:p-8 scroll-mt-24 space-y-4">
        <p className="eyebrow">{centS.fullName}</p>
        <h2 className="display text-3xl md:text-4xl">CEnT-S admission test</h2>
        <p className="text-[var(--ink-soft)] leading-relaxed">{centS.whatItIs}</p>
        <p className="text-[var(--ink-soft)] leading-relaxed">
          <span className="font-semibold text-[var(--ink)]">Who needs it: </span>
          {centS.whoNeedsIt}
        </p>
        <p className="text-[var(--ink-soft)] leading-relaxed">{centS.howToUseScore}</p>
        <p className="text-[var(--ink-soft)] leading-relaxed">
          Fee €{centS.feeEuro} · {centS.structure.totalQuestions} questions ·{" "}
          {centS.structure.durationMinutes} minutes · {centS.formats.join("; ")}.
        </p>

        <h3 className="pt-2 text-xl font-semibold">Test sections</h3>
        <ul className="space-y-2 text-[var(--ink-soft)]">
          {centS.structure.sections.map((section) => (
            <li key={section.name} className="leading-relaxed">
              · {section.name} ({section.durationMinutes} min) — {section.topics}
            </li>
          ))}
        </ul>

        <h3 className="pt-2 text-xl font-semibold">Macro-periods</h3>
        <ul className="space-y-2 text-[var(--ink-soft)]">
          {centS.macroPeriods.map((period) => (
            <li key={period} className="leading-relaxed">
              · {period}
            </li>
          ))}
        </ul>

        <p className="text-[var(--ink-soft)] leading-relaxed">{centS.scoringNote}</p>

        <h3 className="pt-2 text-xl font-semibold">Exceptions</h3>
        <ul className="space-y-2 text-[var(--ink-soft)]">
          {centS.exceptions.map((item) => (
            <li key={item} className="leading-relaxed">
              · {item}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-4 pt-2">
          <a
            href={centS.registrationPortal}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[var(--sea-deep)] hover:underline"
          >
            Book CEnT-S on CISIA →
          </a>
          <Link href="/process#tests" className="font-bold text-[var(--sea-deep)] hover:underline">
            Process page CEnT-S section →
          </Link>
        </div>
      </section>

      <div id="list" className="mt-10 scroll-mt-24">
        <h2 className="display text-3xl md:text-4xl mb-6">Programme list</h2>
        <ProgramExplorer
          key={`${query.field}-${query.region}`}
          programs={programs}
          levelLabel="Bachelor's"
          initialField={query.field}
          initialRegion={query.region}
          initialStatus={query.status}
          initialFee={query.fee}
        />
      </div>
    </div>
  );
}
