import type { Metadata } from "next";
import Link from "next/link";
import { getCentSGuide } from "@/lib/cent-s";
import { getImatInfo } from "@/lib/imat";
import { getMeta } from "@/lib/data";
import { formatAdmissionDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Study in Italy Process · CEnT-S · IMAT",
  description:
    "Full Study in Italy process with CEnT-S bachelor tests, IMAT for Medicine/Dentistry/Veterinary, Universitaly pre-enrolment, scholarships, and visa.",
};

const steps = [
  {
    title: "Shortlist universities and English programmes",
    body: "Match CGPA, budget, city, and English profile. Bachelor Engineering / Economics / science tracks often need CEnT-S; Medicine / Dentistry / Veterinary need IMAT; PhD uses separate dottorato calls.",
    link: { href: "/programs", label: "Browse all programme types" },
  },
  {
    title: "Check the required admission test",
    body: "Many English bachelor programmes need CISIA CEnT-S (replacing old English TOLCs). Politecnico di Torino engineering uses TIL-I. Medicine / Dentistry / Veterinary use IMAT via Universitaly. Pharmacy English often uses CEnT-S, not IMAT.",
    link: { href: "#tests", label: "CEnT-S & IMAT details below" },
  },
  {
    title: "Prepare Pakistani documents",
    body: "Board → IBCC → HEC → MOFA/apostille → authorised Italian translation. Keep CIMEA/DOV ready for Universitaly and visa.",
    link: { href: "/guides/documents", label: "Document guides" },
  },
  {
    title: "Sit the test (if required) + apply on the university portal",
    body: "Book CEnT-S / TIL-I / IMAT as applicable, then apply on each university portal, pay fees, and track evaluation.",
  },
  {
    title: "Universitaly pre-enrollment (visa track)",
    body: "After admission (or as instructed), complete pre-enrollment on Universitaly for most non-EU study visas. For English Medicine, Universitaly is also used for IMAT registration and non-EU seat competition. MUR deadline this cycle: 30 November 2026.",
    link: {
      href: "https://www.universitaly.it/",
      label: "Go to Universitaly",
      external: true,
    },
  },
  {
    title: "Scholarship application (separate from visa)",
    body: "Apply on the regional DSU portal for your study city. Pakistani LazioDisco paperwork is on the Guides page.",
    link: { href: "/guides/scholarship-docs", label: "Scholarship docs" },
  },
  {
    title: "DOV / CIMEA + embassy or BLS visa file",
    body: "Sindh/Balochistan usually go through Karachi BLS; other provinces through Islamabad.",
    link: { href: "/guides/visa", label: "Visa & DOV guides" },
  },
  {
    title: "PhD track (if applicable)",
    body: "Dottorato admissions are separate public competitions — often on PICA or university portals — with research proposal + interview.",
    link: { href: "/phd", label: "PhD A–Z hub" },
  },
];

export default async function ProcessPage() {
  const [imat, centS, meta] = await Promise.all([
    getImatInfo(),
    getCentSGuide(),
    getMeta(),
  ]);
  const documents = imat.documents ?? [];
  const notes = imat.notes ?? [];
  const sections = imat.sections ?? [];

  return (
    <div className="site-shell py-12 md:pb-16">
      <p className="eyebrow">Admission · Tests · Universitaly · Visa</p>
      <h1 className="display mt-3 text-4xl md:text-6xl max-w-4xl">
        Study in Italy process — step by step
      </h1>
      <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
        University application plus Universitaly for the visa. Bachelor STEM /
        Economics tracks often need <strong>CEnT-S</strong>; Medicine /
        Dentistry / Veterinary use <strong>IMAT</strong>. Full test details stay
        on this page — nothing removed, only organised by section.
      </p>

      <div className="mt-8 panel rounded-3xl p-6 md:p-8">
        <p className="eyebrow">MUR · Universitaly</p>
        <h2 className="display mt-2 text-3xl md:text-4xl">
          Pre-enrolment deadline:{" "}
          {formatAdmissionDate(meta.universitalyPreEnrolmentDeadline)}
        </h2>
        <p className="mt-4 max-w-3xl text-[var(--ink-soft)] leading-relaxed">
          Non-EU students must complete Universitaly pre-enrolment by{" "}
          <strong>30 November 2026</strong> for this cycle. Individual programmes
          may close earlier.
        </p>
      </div>

      <nav className="mt-8 flex flex-wrap gap-2 text-sm font-semibold">
        <a href="#steps" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          Steps
        </a>
        <a href="#tests" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          CEnT-S
        </a>
        <a href="#imat" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          IMAT · Medicine
        </a>
        <Link href="/programs/single-cycle" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          Single-cycle list
        </Link>
        <Link href="/programs/bachelor" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          Bachelor list
        </Link>
      </nav>

      <ol id="steps" className="mt-12 space-y-5 scroll-mt-24">
        {steps.map((step, index) => (
          <li key={step.title} className="panel rounded-3xl p-6 md:p-8">
            <div className="eyebrow">Step {index + 1}</div>
            <h2 className="display mt-2 text-3xl md:text-4xl">{step.title}</h2>
            <p className="mt-4 max-w-3xl text-[var(--ink-soft)] leading-relaxed">
              {step.body}
            </p>
            {step.link &&
              (step.link.external ? (
                <a
                  href={step.link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-5 font-bold text-[var(--sea-deep)] hover:underline"
                >
                  {step.link.label} →
                </a>
              ) : step.link.href.startsWith("#") ? (
                <a
                  href={step.link.href}
                  className="inline-block mt-5 font-bold text-[var(--sea-deep)] hover:underline"
                >
                  {step.link.label} →
                </a>
              ) : (
                <Link
                  href={step.link.href}
                  className="inline-block mt-5 font-bold text-[var(--sea-deep)] hover:underline"
                >
                  {step.link.label} →
                </Link>
              ))}
          </li>
        ))}
      </ol>

      <section id="tests" className="mt-14 panel rounded-3xl p-6 md:p-8 scroll-mt-24">
        <p className="eyebrow">Bachelor · Engineering · Economics · Sciences</p>
        <h2 className="display mt-2 text-3xl md:text-5xl max-w-3xl">
          {centS.fullName}
        </h2>
        <p className="mt-4 max-w-3xl text-[var(--ink-soft)] leading-relaxed">
          {centS.whatItIs}
        </p>
        <p className="mt-4 max-w-3xl text-[var(--ink-soft)] leading-relaxed">
          {centS.whoNeedsIt}
        </p>
        <p className="mt-4 max-w-3xl text-[var(--ink-soft)] leading-relaxed">
          {centS.howToUseScore}
        </p>
        <p className="mt-4 max-w-3xl text-[var(--ink-soft)] leading-relaxed">
          Fee €{centS.feeEuro} · {centS.structure.totalQuestions} questions ·{" "}
          {centS.structure.durationMinutes} minutes · formats:{" "}
          {centS.formats.join("; ")}.
        </p>

        <h3 className="mt-8 text-xl font-semibold">Test sections</h3>
        <ul className="mt-3 space-y-2 text-[var(--ink-soft)]">
          {centS.structure.sections.map((section) => (
            <li key={section.name} className="leading-relaxed">
              · {section.name} ({section.durationMinutes} min) — {section.topics}
            </li>
          ))}
        </ul>

        <h3 className="mt-8 text-xl font-semibold">Macro-periods</h3>
        <ul className="mt-3 space-y-2 text-[var(--ink-soft)]">
          {centS.macroPeriods.map((period) => (
            <li key={period} className="leading-relaxed">
              · {period}
            </li>
          ))}
        </ul>

        <p className="mt-4 max-w-3xl text-[var(--ink-soft)] leading-relaxed">
          {centS.scoringNote}
        </p>

        <h3 className="mt-8 text-xl font-semibold">Exceptions</h3>
        <ul className="mt-3 space-y-2 text-[var(--ink-soft)]">
          {centS.exceptions.map((item) => (
            <li key={item} className="leading-relaxed">
              · {item}
            </li>
          ))}
        </ul>

        {centS.notes?.length > 0 && (
          <>
            <h3 className="mt-8 text-xl font-semibold">Extra notes</h3>
            <ul className="mt-3 space-y-2 text-[var(--ink-soft)]">
              {centS.notes.map((note) => (
                <li key={note.slice(0, 48)} className="leading-relaxed">
                  · {note}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-8 flex flex-wrap gap-4">
          <a
            href={centS.registrationPortal}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[var(--sea-deep)] hover:underline"
          >
            Book CEnT-S on CISIA →
          </a>
          <Link
            href="/programs/bachelor"
            className="font-bold text-[var(--sea-deep)] hover:underline"
          >
            Browse bachelor programmes →
          </Link>
        </div>
      </section>

      <section id="imat" className="mt-8 panel rounded-3xl p-6 md:p-8 scroll-mt-24">
        <p className="eyebrow">Medicine · Dentistry · Veterinary · Single-cycle</p>
        <h2 className="display mt-2 text-3xl md:text-5xl max-w-3xl">
          {imat.fullName} (IMAT)
        </h2>
        <p className="mt-4 max-w-3xl text-[var(--ink-soft)] leading-relaxed">
          {imat.what}
        </p>
        <p className="mt-4 max-w-3xl text-[var(--ink-soft)] leading-relaxed">
          {imat.whoNeedsIt}
        </p>
        <p className="mt-4 max-w-3xl text-[var(--ink-soft)] leading-relaxed">
          <span className="font-semibold text-[var(--ink)]">Timeline: </span>
          {imat.typicalTimeline}
        </p>
        <p className="mt-4 max-w-3xl text-[var(--ink-soft)] leading-relaxed">
          {imat.universitalyNote}
        </p>

        {sections.length > 0 && (
          <>
            <h3 className="mt-8 text-xl font-semibold">Test sections</h3>
            <ul className="mt-3 space-y-2 text-[var(--ink-soft)]">
              {sections.map((item) => (
                <li key={item} className="leading-relaxed">
                  · {item}
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className="mt-8 text-xl font-semibold">Documents to prepare early</h3>
        <ul className="mt-3 space-y-2 text-[var(--ink-soft)]">
          {documents.map((doc) => (
            <li key={doc} className="leading-relaxed">
              · {doc}
            </li>
          ))}
        </ul>

        {notes.length > 0 && (
          <>
            <h3 className="mt-8 text-xl font-semibold">Key notes</h3>
            <ul className="mt-3 space-y-2 text-[var(--ink-soft)]">
              {notes.map((note) => (
                <li key={note} className="leading-relaxed">
                  · {note}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-8 flex flex-wrap gap-4">
          <a
            href={imat.registrationPortal}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[var(--sea-deep)] hover:underline"
          >
            Universitaly / IMAT registration →
          </a>
          <Link
            href="/programs/single-cycle"
            className="font-bold text-[var(--sea-deep)] hover:underline"
          >
            Browse English Medicine & single-cycle →
          </Link>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/programs" className="btn btn-sea">
          All programmes hub
        </Link>
        <Link href="/guides" className="btn btn-outline">
          Pakistan guides
        </Link>
        <Link href="/phd" className="btn btn-outline">
          PhD hub
        </Link>
      </div>
    </div>
  );
}
