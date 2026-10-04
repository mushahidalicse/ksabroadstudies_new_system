import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getMeta } from "@/lib/data";
export const revalidate = 120;

export const metadata: Metadata = {
  title: "English programmes hub",
  description:
    "English-taught bachelor's, master's, and single-cycle (medicine) programmes in Italy — KS Abroad catalogue.",
};

export default async function EnglishProgramsHubPage() {
  const meta = await getMeta();

  const cards = [
    {
      href: "/programs/bachelor",
      title: "Bachelor's in English",
      body: `${meta.bachelorCount}+ programmes plus CISIA CEnT-S guide for admission tests.`,
    },
    {
      href: "/programs/master",
      title: "Master's in English",
      body: `${meta.masterCount}+ Laurea Magistrale programmes with portals and filters.`,
    },
    {
      href: "/programs/single-cycle",
      title: "Single-cycle (Medicine)",
      body: `${meta.singleCycleCount} MBBS / dentistry / veterinary programmes plus IMAT guide.`,
    },
  ];

  return (
    <div className="site-shell page-hero pb-16">
      <p className="eyebrow">English-taught · Intake {meta.intake}</p>
      <h1 className="display mt-3 text-4xl md:text-6xl max-w-4xl">
        English programmes in Italy
      </h1>
      <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
        Browse bachelor&apos;s, master&apos;s, and single-cycle sections from KS
        Abroad&apos;s live catalogue. Register at{" "}
        <Link href="/register" className="font-bold text-[var(--sea-deep)] hover:underline">
          /register
        </Link>{" "}
        for a personalised Top 10 shortlist in the portal.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="panel rounded-3xl p-6 hover:bg-[rgba(255,252,245,0.95)] transition"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="display text-2xl max-w-[14ch]">{card.title}</h2>
              <ArrowUpRight className="text-[var(--sea)] shrink-0" />
            </div>
            <p className="mt-4 text-[var(--ink-soft)] leading-relaxed">{card.body}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 panel rounded-3xl p-6 md:p-8">
        <p className="eyebrow">Mobile API</p>
        <p className="mt-3 text-[var(--ink-soft)] leading-relaxed max-w-3xl">
          Programmes are also available via{" "}
          <code className="text-sm font-semibold">GET /api/v1/programs?level=…</code> and{" "}
          <code className="text-sm font-semibold">GET /api/v1/search?q=…</code>. See{" "}
          <code className="text-sm font-semibold">/api/v1/openapi</code> for the schema.
        </p>
      </div>
    </div>
  );
}
