import type { Metadata } from "next";
import Link from "next/link";
import { getErasmusGuide } from "@/lib/content";

export const metadata: Metadata = {
  title: "Erasmus Mundus 2027",
  description:
    "Updated Erasmus Mundus Joint Masters guide for the 2027 intake: autumn 2026 applications, scholarships, English/MOI tips, and official catalogue links.",
};

export default async function ErasmusPage() {
  const e = await getErasmusGuide();

  return (
    <div className="site-shell page-hero pb-16">
      <p className="eyebrow">Separate section · EU · Intake {e.intake}</p>
      <h1 className="display mt-3 text-4xl md:text-6xl max-w-4xl">{e.headline}</h1>
      <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">{e.intro}</p>
      <p className="mt-3 text-sm font-semibold text-[var(--coral)]">
        Updated for 2026–2027 — older 2023 programme lists on this site are archives only.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <a href={e.officialCatalogue} target="_blank" rel="noreferrer" className="btn btn-sea">
          Official catalogue / how to apply
        </a>
        <a href={e.ecNews} target="_blank" rel="noreferrer" className="btn btn-outline">
          July 2026 selection news
        </a>
        {e.selectedProjects2026 && (
          <a href={e.selectedProjects2026} target="_blank" rel="noreferrer" className="btn btn-outline">
            2026 selected projects list
          </a>
        )}
      </div>

      <section className="mt-12 panel rounded-3xl p-6 md:p-8">
        <h2 className="display text-3xl md:text-4xl">{e.cycle2027.title}</h2>
        <ul className="mt-5 space-y-3">
          {e.cycle2027.points.map((p) => (
            <li key={p.slice(0, 48)} className="text-[var(--ink-soft)] leading-relaxed">
              · {p}
            </li>
          ))}
        </ul>
        <h3 className="mt-8 font-bold">Example fields in the new 2026 selection</h3>
        <ul className="mt-3 grid gap-2 md:grid-cols-2 text-sm text-[var(--ink-soft)]">
          {e.cycle2027.exampleNewFields.map((f) => (
            <li key={f}>· {f}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="display text-3xl">Timeline</h2>
        <ol className="mt-6 space-y-4">
          {e.timeline.map((row) => (
            <li key={row.when} className="panel rounded-3xl p-5 md:p-6">
              <div className="eyebrow">{row.when}</div>
              <p className="mt-2 text-[var(--ink-soft)] leading-relaxed">{row.what}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 panel rounded-3xl p-6 md:p-8">
        <h2 className="display text-3xl">{e.scholarship.title}</h2>
        <ul className="mt-4 space-y-2 text-[var(--ink-soft)]">
          {e.scholarship.items.map((item) => (
            <li key={item.slice(0, 40)}>· {item}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-[var(--ink-soft)]">{e.scholarship.note}</p>
      </section>

      <section className="mt-10">
        <h2 className="display text-3xl">How to apply</h2>
        <ol className="mt-6 space-y-3">
          {e.howToApply.map((step, i) => (
            <li key={step.slice(0, 40)} className="flex gap-3 text-[var(--ink-soft)] leading-relaxed">
              <span className="font-bold text-[var(--sea-deep)]">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 panel rounded-3xl p-6 md:p-8">
        <h2 className="display text-3xl">{e.englishWithoutIelts.title}</h2>
        <p className="mt-4 text-[var(--ink-soft)] leading-relaxed">{e.englishWithoutIelts.intro}</p>
        <ul className="mt-5 space-y-2 text-sm text-[var(--ink-soft)]">
          {e.englishWithoutIelts.tips.map((t) => (
            <li key={t.slice(0, 48)}>· {t}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="display text-3xl">Documents to prepare</h2>
        <ul className="mt-5 grid gap-2 md:grid-cols-2">
          {e.documents.map((d) => (
            <li key={d} className="text-sm text-[var(--ink-soft)]">
              · {d}
            </li>
          ))}
        </ul>
        <Link
          href="/guides/motivation-letter"
          className="inline-block mt-5 font-bold text-[var(--sea-deep)] hover:underline"
        >
          Motivation letter guide →
        </Link>
      </section>

      <section className="mt-12 panel rounded-3xl p-6">
        <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{e.archivesNote}</p>
        <ul className="mt-4 space-y-2">
          {e.downloads.map((f) => (
            <li key={f.href}>
              <a
                href={f.href}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-[var(--sea-deep)] hover:underline"
              >
                {f.label} →
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
