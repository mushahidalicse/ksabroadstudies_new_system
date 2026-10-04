import type { Metadata } from "next";
import Link from "next/link";
import { getPakistanGuides } from "@/lib/guides";
import { formatAdmissionDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Study visa guide",
  description:
    "Italian study visa checklists for Pakistani students: Islamabad embassy track, Karachi/BLS track, Universitaly deadline, and PDF downloads.",
};

export default async function VisaGuidePage() {
  const g = await getPakistanGuides();

  return (
    <div className="site-shell page-hero pb-16">
      <Link href="/guides" className="text-sm font-semibold text-[var(--sea-deep)] hover:underline">
        ← All guides
      </Link>
      <p className="eyebrow mt-6">Universitaly · Embassy · BLS</p>
      <h1 className="display mt-2 text-4xl md:text-6xl max-w-4xl">
        Study visa guide
      </h1>
      <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
        Checklists and tracks for the national study visa. For Declaration of
        Value and CIMEA, use the{" "}
        <Link href="/guides/dov" className="font-semibold text-[var(--sea-deep)] hover:underline">
          DOV & CIMEA guide
        </Link>
        .
      </p>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
        <a href="#universitaly" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          Universitaly
        </a>
        <a href="#islamabad" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          Islamabad checklist
        </a>
        <a href="#karachi" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          Karachi / BLS
        </a>
        <a href="#pdfs" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          PDF downloads
        </a>
      </nav>

      <div id="universitaly" className="mt-8 panel rounded-3xl p-6 md:p-8 scroll-mt-24">
        <p className="eyebrow">MUR deadline</p>
        <h2 className="display mt-2 text-3xl">
          Universitaly: {formatAdmissionDate(g.universitalyPreEnrolmentDeadline)}
        </h2>
        <p className="mt-3 max-w-3xl text-[var(--ink-soft)] leading-relaxed">
          {g.universitalyNote}
        </p>
      </div>

      <section id="islamabad" className="mt-12 scroll-mt-24">
        <h2 className="display text-3xl md:text-4xl">{g.islamabadVisaChecklist.title}</h2>
        <p className="mt-4 max-w-3xl text-[var(--ink-soft)] leading-relaxed">
          {g.islamabadVisaChecklist.intro}
        </p>
        <ul className="mt-6 grid gap-2 md:grid-cols-2">
          {g.islamabadVisaChecklist.items.map((item) => (
            <li key={item.slice(0, 40)} className="text-sm text-[var(--ink-soft)] leading-relaxed">
              · {item}
            </li>
          ))}
        </ul>
      </section>

      <section id="karachi" className="mt-12 panel rounded-3xl p-6 md:p-8 scroll-mt-24">
        <h2 className="display text-3xl">{g.karachiVisaInfo.title}</h2>
        <p className="mt-4 text-[var(--ink-soft)] leading-relaxed">{g.karachiVisaInfo.intro}</p>
        <ol className="mt-5 space-y-3">
          {g.karachiVisaInfo.steps.map((step, i) => (
            <li key={step.slice(0, 32)} className="flex gap-3 text-[var(--ink-soft)] leading-relaxed">
              <span className="font-bold text-[var(--sea-deep)]">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <h3 className="mt-8 font-bold">Karachi study visa documents</h3>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {g.karachiVisaInfo.visaDocuments.map((item) => (
            <li key={item.slice(0, 40)} className="text-sm text-[var(--ink-soft)]">
              · {item}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm font-semibold text-[var(--coral)] leading-relaxed">
          {g.karachiVisaInfo.scamWarning}
        </p>
        <Link
          href="/guides/translations#karachi"
          className="inline-block mt-5 font-bold text-[var(--sea-deep)] hover:underline"
        >
          Karachi Consulate authorised translators →
        </Link>
      </section>

      <section className="mt-10 panel rounded-3xl p-6">
        <h2 className="display text-2xl">Common visa file items (post-admission)</h2>
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {g.postAdmission.visaDocuments.map((item) => (
            <li key={item.slice(0, 40)} className="text-sm text-[var(--ink-soft)]">
              · {item}
            </li>
          ))}
        </ul>
      </section>

      <div id="pdfs" className="mt-8 flex flex-wrap gap-4 text-sm font-bold scroll-mt-24">
        <a href="/guides/study-visa-checklist-islamabad.pdf" target="_blank" rel="noreferrer" className="text-[var(--sea-deep)] hover:underline">
          Islamabad checklist PDF →
        </a>
        <a href="/guides/pre-enrollment-dov-study-visa-info.pdf" target="_blank" rel="noreferrer" className="text-[var(--sea-deep)] hover:underline">
          Pre-enrolment / DOV info PDF →
        </a>
        <a href="/guides/post-admission-guide-complete.pdf" target="_blank" rel="noreferrer" className="text-[var(--sea-deep)] hover:underline">
          Full post-admission guide →
        </a>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/guides/dov" className="btn btn-sea">
          DOV & CIMEA
        </Link>
        <Link href="/guides/documents" className="btn btn-outline">
          Document attestation
        </Link>
      </div>
    </div>
  );
}
