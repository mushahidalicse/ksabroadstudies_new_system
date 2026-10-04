import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DocumentTracker } from "@/components/DocumentTracker";
import { getPakistanGuides } from "@/lib/guides";
import { formatAdmissionDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Student Guides",
  description:
    "Pakistan desk guides: documents & attestation, translations, motivation letter, DOV & CIMEA, study visa checklists, and per-region scholarship documents.",
};

const cards = [
  {
    href: "/guides/documents",
    title: "Documents & attestation",
    body: "Board → IBCC → HEC → MOFA / apostille → authorised translation.",
  },
  {
    href: "/guides/translations",
    title: "Translation companies",
    body: "Islamabad Embassy list + Karachi Consulate list for Sindh & Balochistan.",
  },
  {
    href: "/guides/motivation-letter",
    title: "Motivation letter",
    body: "Structure, tips, and mistakes to avoid for admissions & visa.",
  },
  {
    href: "/guides/dov",
    title: "DOV & CIMEA",
    body: "Declaration of Value checklists, CIMEA Diplome, Islamabad vs Karachi tracks.",
  },
  {
    href: "/guides/visa",
    title: "Visa guide",
    body: "Islamabad & Karachi/BLS study visa checklists, Universitaly deadline, PDFs.",
  },
  {
    href: "/guides/scholarship-docs",
    title: "Scholarship documents",
    body: "Per-region DSU paperwork listed separately, plus Pakistani LazioDisco steps.",
  },
];

export default async function GuidesPage() {
  const g = await getPakistanGuides();

  return (
    <div className="site-shell page-hero pb-16">
      <p className="eyebrow">Pakistan desk · KS Abroad Studies</p>
      <h1 className="display mt-3 text-4xl md:text-6xl max-w-4xl">
        Guides — pick one topic
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-[var(--ink-soft)] leading-relaxed">
        Documents, translations, motivation letter, DOV & CIMEA, visa, and
        scholarship paperwork — each in its own section. PhD lives under{" "}
        <Link href="/phd" className="font-semibold text-[var(--sea-deep)] hover:underline">
          PhD
        </Link>
        ; Erasmus under{" "}
        <Link href="/erasmus" className="font-semibold text-[var(--sea-deep)] hover:underline">
          Erasmus
        </Link>
        . Last updated {g.lastUpdated}.
      </p>

      <div className="mt-8 panel rounded-3xl p-6 md:p-7">
        <p className="eyebrow">MUR · Universitaly</p>
        <h2 className="display mt-2 text-3xl">
          Pre-enrolment: {formatAdmissionDate(g.universitalyPreEnrolmentDeadline)}
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-[var(--ink-soft)] leading-relaxed">
          {g.universitalyNote}
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="panel rounded-3xl p-6 hover:bg-[rgba(255,252,245,0.95)] transition"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="display text-2xl md:text-3xl max-w-[14ch]">
                {card.title}
              </h2>
              <ArrowUpRight className="text-[var(--sea)] shrink-0" />
            </div>
            <p className="mt-3 text-[var(--ink-soft)] leading-relaxed">{card.body}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <DocumentTracker />
      </div>

      <section className="mt-12 panel rounded-3xl p-6 md:p-8">
        <p className="eyebrow">Downloads</p>
        <h2 className="display mt-2 text-3xl">PDF pack</h2>
        <ul className="mt-5 grid gap-2 md:grid-cols-2">
          {g.downloads.map((file) => (
            <li key={file.href}>
              <a
                href={file.href}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[var(--sea-deep)] hover:underline text-sm"
              >
                {file.label} →
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/about" className="btn btn-outline">
            Company registration
          </Link>
          <Link href="/agreement" className="btn btn-outline">
            Consultancy agreement
          </Link>
        </div>
      </section>
    </div>
  );
}
