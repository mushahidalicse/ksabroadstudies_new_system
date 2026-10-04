import type { Metadata } from "next";
import Link from "next/link";
import { ProgramExplorer } from "@/components/program-explorer";
import { getMeta, getPrograms } from "@/lib/data";
import { readQuery } from "@/lib/search-query";
import { getImatInfo } from "@/lib/imat";
export const revalidate = 120;

export const metadata: Metadata = {
  title: "Medicine & Single-cycle Degrees in English",
  description:
    "English-taught single-cycle degrees in Italy: Medicine, Dentistry, Veterinary, Pharmacy — with full IMAT and Universitaly guidance.",
};

export default async function SingleCycleProgramsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await readQuery(searchParams);
  const [programs, meta, imat] = await Promise.all([
    getPrograms("single-cycle"),
    getMeta(),
    getImatInfo(),
  ]);
  const documents = imat.documents ?? [];
  const notes = imat.notes ?? [];
  const sections = imat.sections ?? [];

  return (
    <div className="site-shell page-hero pb-12 md:pb-16">
      <Link href="/" className="text-sm font-semibold text-[var(--sea-deep)] hover:underline">
        ← Home
      </Link>
      <p className="eyebrow mt-6">Intake {meta.intake}</p>
      <h1 className="display mt-3 text-4xl md:text-6xl max-w-4xl">
        Single-cycle (Medicine) — MBBS, Dentistry & more
      </h1>
      <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
        {meta.singleCycleCount} English single-cycle programmes (typically 5–6
        years): Medicine and Surgery (MBBS-equivalent), Dentistry, Veterinary
        Medicine, and selected Pharmacy tracks. Most Medicine / Dentistry /
        Veterinary English seats use the national <strong>IMAT</strong> test via
        Universitaly — full guide below. Pharmacy English usually uses{" "}
        <strong>CEnT-S</strong>, not IMAT.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
        <a href="#imat" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          IMAT guide
        </a>
        <a href="#list" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          Programme list
        </a>
        <Link href="/process#imat" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          Full process + IMAT
        </Link>
        <Link href="/programs/bachelor" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          Bachelor&apos;s (CEnT-S)
        </Link>
      </nav>

      <section id="imat" className="mt-10 panel rounded-3xl p-6 md:p-8 scroll-mt-24 space-y-4">
        <p className="eyebrow">{imat.fullName} (IMAT)</p>
        <h2 className="display text-3xl md:text-4xl">How IMAT works</h2>
        <p className="text-[var(--ink-soft)] leading-relaxed">{imat.what}</p>
        <p className="text-[var(--ink-soft)] leading-relaxed">
          <span className="font-semibold text-[var(--ink)]">Who needs it: </span>
          {imat.whoNeedsIt}
        </p>
        <p className="text-[var(--ink-soft)] leading-relaxed">
          <span className="font-semibold text-[var(--ink)]">Timeline: </span>
          {imat.typicalTimeline}
        </p>
        <p className="text-[var(--ink-soft)] leading-relaxed">{imat.universitalyNote}</p>

        {sections.length > 0 && (
          <>
            <h3 className="pt-2 text-xl font-semibold">Test sections</h3>
            <ul className="space-y-2 text-[var(--ink-soft)]">
              {sections.map((item) => (
                <li key={item} className="leading-relaxed">
                  · {item}
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className="pt-2 text-xl font-semibold">Documents to prepare early</h3>
        <ul className="space-y-2 text-[var(--ink-soft)]">
          {documents.map((doc) => (
            <li key={doc} className="leading-relaxed">
              · {doc}
            </li>
          ))}
        </ul>

        {notes.length > 0 && (
          <>
            <h3 className="pt-2 text-xl font-semibold">Key notes</h3>
            <ul className="space-y-2 text-[var(--ink-soft)]">
              {notes.map((note) => (
                <li key={note} className="leading-relaxed">
                  · {note}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex flex-wrap gap-4 pt-2">
          <a
            href={imat.registrationPortal}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[var(--sea-deep)] hover:underline"
          >
            Open Universitaly / IMAT →
          </a>
          <Link href="/process#imat" className="font-bold text-[var(--sea-deep)] hover:underline">
            Process page IMAT section →
          </Link>
        </div>
      </section>

      <div id="list" className="mt-10 scroll-mt-24">
        <h2 className="display text-3xl md:text-4xl mb-6">Programme list</h2>
        <ProgramExplorer
          key={`${query.field}-${query.region}`}
          programs={programs}
          levelLabel="Single-cycle"
          initialField={query.field}
          initialRegion={query.region}
          initialStatus={query.status}
          initialFee={query.fee}
        />
      </div>
    </div>
  );
}
