import type { Metadata } from "next";
import Link from "next/link";
import { getPakistanGuides } from "@/lib/guides";
import { getScholarshipRegions, getScholarshipsDataset } from "@/lib/scholarships";
export const revalidate = 120;

export const metadata: Metadata = {
  title: "Scholarship documents by region",
  description:
    "Per-region Italian DSU scholarship documents for Pakistani students, plus LazioDisco / DiSCo Pakistan paperwork steps.",
};

export default async function ScholarshipDocsPage() {
  const [{ scholarshipPakistan: pk }, regions, dataset] = await Promise.all([
    getPakistanGuides(),
    getScholarshipRegions(),
    getScholarshipsDataset(),
  ]);

  return (
    <div className="site-shell page-hero pb-16">
      <Link href="/guides" className="text-sm font-semibold text-[var(--sea-deep)] hover:underline">
        ← All guides
      </Link>
      <p className="eyebrow mt-6">DSU · region by region</p>
      <h1 className="display mt-2 text-4xl md:text-6xl max-w-4xl">
        Scholarship documents — every region listed separately
      </h1>
      <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
        Each Italian region runs its own right-to-study (DSU) agency. Match your
        university city to the region below, then prepare that agency&apos;s
        document list. Pakistani LazioDisco steps are kept in full under Lazio.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm font-semibold max-h-40 overflow-y-auto">
        {regions.map((r) => (
          <a
            key={r.id}
            href={`#${r.id}`}
            className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60"
          >
            {r.region}
          </a>
        ))}
        <a href="#pakistan-lazio" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          Pakistan · Lazio steps
        </a>
      </nav>

      <section className="mt-10 panel rounded-3xl p-6 md:p-8">
        <p className="eyebrow">National notes</p>
        <ul className="mt-4 space-y-2 text-sm text-[var(--ink-soft)]">
          {dataset.generalGuide.nationalNotes.map((n) => (
            <li key={n.slice(0, 56)} className="leading-relaxed">
              · {n}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 space-y-5">
        {regions.map((r) => (
          <section
            key={r.id}
            id={r.id}
            className="panel rounded-3xl p-6 md:p-8 scroll-mt-24"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">{r.agencyName}</p>
                <h2 className="display mt-1 text-3xl md:text-4xl">{r.region}</h2>
              </div>
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">
                Status: {r.status}
              </span>
            </div>
            <p className="mt-3 text-sm text-[var(--ink-soft)] leading-relaxed">
              Cities: {r.citiesServed.join(", ")}
            </p>
            {r.deadlineNote && (
              <p className="mt-2 text-sm text-[var(--ink-soft)] leading-relaxed">
                <span className="font-semibold text-[var(--ink)]">Deadlines: </span>
                {r.deadlineNote}
              </p>
            )}
            {r.notes && (
              <p className="mt-2 text-sm text-[var(--ink-soft)] leading-relaxed">{r.notes}</p>
            )}

            <h3 className="mt-6 font-bold">Typical documents</h3>
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {r.typicalDocuments.map((doc) => (
                <li key={doc} className="text-sm text-[var(--ink-soft)]">
                  · {doc}
                </li>
              ))}
            </ul>

            {r.agencies && r.agencies.length > 0 && (
              <>
                <h3 className="mt-6 font-bold">Local agencies</h3>
                <ul className="mt-3 space-y-2 text-sm text-[var(--ink-soft)]">
                  {r.agencies.map((a) => (
                    <li key={a.name}>
                      · {a.name}
                      {a.cities?.length ? ` (${a.cities.join(", ")})` : ""}
                      {a.deadlineNote ? ` — ${a.deadlineNote}` : ""}{" "}
                      {a.portalUrl && (
                        <a
                          href={a.portalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-[var(--sea-deep)] hover:underline"
                        >
                          portal →
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-5 flex flex-wrap gap-4 text-sm font-bold">
              {r.portalUrl && (
                <a
                  href={r.portalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--sea-deep)] hover:underline"
                >
                  Region portal →
                </a>
              )}
              {r.applyUrl && r.applyUrl !== r.portalUrl ? (
                <a
                  href={r.applyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--sea-deep)] hover:underline"
                >
                  Apply / bando →
                </a>
              ) : null}
              <Link
                href={`/scholarships/${r.id}`}
                className="text-[var(--sea-deep)] hover:underline"
              >
                Full scholarship page →
              </Link>
            </div>
          </section>
        ))}
      </div>

      <section id="pakistan-lazio" className="mt-12 scroll-mt-24">
        <p className="eyebrow">Pakistan desk · Lazio focus</p>
        <h2 className="display mt-2 text-3xl md:text-5xl max-w-4xl">{pk.title}</h2>
        <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
          {pk.intro}
        </p>

        <ol className="mt-10 space-y-4">
          {pk.steps.map((step, i) => (
            <li key={step.title} className="panel rounded-3xl p-5">
              <div className="eyebrow">Step {i + 1}</div>
              <h3 className="display mt-1 text-2xl">{step.title}</h3>
              <p className="mt-3 text-[var(--ink-soft)] leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="panel rounded-3xl p-6">
            <h3 className="display text-2xl">Prepare in Pakistan</h3>
            <ul className="mt-4 space-y-2 text-sm text-[var(--ink-soft)]">
              {pk.documentsBeforeTravel.map((d) => (
                <li key={d}>· {d}</li>
              ))}
            </ul>
          </div>
          <div className="panel rounded-3xl p-6">
            <h3 className="display text-2xl">Legalise in Italy</h3>
            <ul className="mt-4 space-y-2 text-sm text-[var(--ink-soft)]">
              {pk.italyLegalisation.map((d) => (
                <li key={d.slice(0, 48)}>· {d}</li>
              ))}
            </ul>
          </div>
        </div>

        <ul className="mt-6 space-y-2 text-sm text-[var(--ink-soft)]">
          {pk.moneyNotes.map((n) => (
            <li key={n.slice(0, 40)}>· {n}</li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/scholarships" className="btn btn-sea">
          All regional portals
        </Link>
        <a
          href="/guides/scholarship-guide-lazio.pdf"
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline"
        >
          Lazio PDF guide
        </a>
      </div>
    </div>
  );
}
