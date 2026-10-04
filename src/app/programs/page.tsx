import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getMeta } from "@/lib/data";
export const revalidate = 120;

export const metadata: Metadata = {
  title: "English programmes in Italy",
  description:
    "Master's, Bachelor's + CEnT-S, Medicine / single-cycle + IMAT, and PhD — organised by section.",
};

export default async function ProgramsHubPage() {
  const meta = await getMeta();

  const cards = [
    {
      href: "/programs/find",
      title: "Find My Programme",
      body: "Filter by level, field, region, fee, and deadline status, then save or compare.",
    },
    {
      href: "/programs/master",
      title: "Master's in English",
      body: `${meta.masterCount}+ Laurea Magistrale programmes with portals and filters.`,
    },
    {
      href: "/programs/bachelor",
      title: "Bachelor's + CEnT-S",
      body: `${meta.bachelorCount}+ Laurea Triennale programmes plus full CISIA CEnT-S guide.`,
    },
    {
      href: "/programs/single-cycle",
      title: "Single-cycle (Medicine)",
      body: `MBBS, Dentistry, Veterinary, Pharmacy — ${meta.singleCycleCount} programmes + IMAT guide.`,
    },
    {
      href: "/phd",
      title: "PhD / Dottorato",
      body: "Separate PhD section: A–Z procedure, PICA, English-friendly courses.",
    },
  ];

  return (
    <div className="site-shell page-hero pb-16">
      <p className="eyebrow">Intake {meta.intake}</p>
      <h1 className="display mt-3 text-4xl md:text-6xl max-w-4xl">
        Programmes by section
      </h1>
      <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
        Pick Master&apos;s, Bachelor&apos;s, Medicine / single-cycle, or PhD.
        Admission tests stay with their programme type (CEnT-S with bachelor,
        IMAT with medicine).
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
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

      <div className="mt-10 panel rounded-3xl p-6 md:p-8">
        <p className="eyebrow">Quick rule</p>
        <p className="mt-3 text-[var(--ink-soft)] leading-relaxed max-w-3xl">
          <strong>Medicine / Dentistry / Veterinary</strong> → IMAT (Universitaly).{" "}
          <strong>Most English Engineering / Economics / science bachelors</strong>{" "}
          → CEnT-S (CISIA). <strong>PoliTo engineering</strong> → TIL-I.{" "}
          <strong>Pharmacy English</strong> → usually CEnT-S, not IMAT.
        </p>
        <Link href="/process" className="inline-block mt-5 font-bold text-[var(--sea-deep)] hover:underline">
          Full process page →
        </Link>
      </div>
    </div>
  );
}
