import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getMeta } from "@/lib/data";
import { formatAdmissionDate } from "@/lib/utils";
export const revalidate = 120;

export const metadata: Metadata = {
  title: "Study in Italy",
  description:
    "Study in Italy hub: universities, master's, bachelor's + CEnT-S, medicine/IMAT, PhD, guides, scholarships, Erasmus.",
};

export default async function StudyInItalyPage() {
  const meta = await getMeta();

  const cards = [
    {
      href: "/universities",
      title: "Universities",
      body: `${meta.universityCount} universities — ${meta.openCount} open, ${meta.soonCount} opening soon, ${meta.closedCount} closed for non-EU this session.`,
    },
    {
      href: "/programs/master",
      title: "Master's in English",
      body: `${meta.masterCount}+ English-taught master's programmes.`,
    },
    {
      href: "/programs/bachelor",
      title: "Bachelor's + CEnT-S",
      body: `${meta.bachelorCount}+ English bachelor programmes and CISIA CEnT-S.`,
    },
    {
      href: "/programs/single-cycle",
      title: "Single-cycle (Medicine)",
      body: `MBBS, Dentistry, Veterinary + IMAT — ${meta.singleCycleCount} programmes.`,
    },
    {
      href: "/phd",
      title: "PhD / Dottorato",
      body: "A–Z procedure, PICA portal, English-friendly PhD courses.",
    },
    {
      href: "/guides",
      title: "Guides",
      body: "Documents, translations, motivation letter, DOV & CIMEA, visa, scholarship docs.",
    },
    {
      href: "/scholarships",
      title: "Regional scholarships",
      body: "All DSU regions with portals and deadlines.",
    },
    {
      href: "/erasmus",
      title: "Erasmus Mundus 2027",
      body: "Separate section — autumn 2026 applications for 2027 starts.",
    },
    {
      href: "/process",
      title: "Full process",
      body: "Step-by-step admission with CEnT-S and IMAT kept intact.",
    },
    {
      href: "/about",
      title: "Company registration",
      body: "SECP incorporation certificate and filing acknowledgement.",
    },
    {
      href: "/agreement",
      title: "Consultancy agreement",
      body: "Service terms, refunds, visa disclaimer, liability limits.",
    },
  ];

  return (
    <div className="site-shell py-12 md:py-16">
      <p className="eyebrow">Intake {meta.intake}</p>
      <h1 className="display mt-3 text-4xl md:text-6xl max-w-4xl">
        Study in Italy — desk for Pakistani students
      </h1>
      <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
        Everything kept section-wise: programmes, PhD, guides, scholarships, and
        Erasmus each in their own place.
      </p>

      <div className="mt-8 panel rounded-3xl p-6 md:p-8">
        <p className="eyebrow">MUR · Universitaly</p>
        <h2 className="display mt-2 text-3xl md:text-4xl">
          Pre-enrolment deadline:{" "}
          {formatAdmissionDate(meta.universitalyPreEnrolmentDeadline)}
        </h2>
        <p className="mt-4 max-w-3xl text-[var(--ink-soft)] leading-relaxed">
          Complete Universitaly pre-enrolment by <strong>30 November 2026</strong>{" "}
          (Ministry of Education deadline for this cycle).
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="panel rounded-3xl p-6 hover:bg-[rgba(255,252,245,0.95)] transition"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="display text-3xl max-w-[14ch]">{card.title}</h2>
              <ArrowUpRight className="text-[var(--sea)] shrink-0" />
            </div>
            <p className="mt-4 text-[var(--ink-soft)] leading-relaxed">{card.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
