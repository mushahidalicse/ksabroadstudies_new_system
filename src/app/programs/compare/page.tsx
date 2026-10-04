import type { Metadata } from "next";
import Link from "next/link";
import { CompareBoard } from "@/components/compare-board";
import { getCatalogue } from "@/lib/data";

export const metadata: Metadata = {
  title: "Compare programmes",
  description: "Compare up to four programmes from the KS Abroad catalogue.",
  robots: { index: false, follow: false },
};

export default async function ComparePage() {
  const programmes = await getCatalogue();
  return (
    <div className="site-shell page-hero pb-16">
      <Link href="/programs/find" className="text-sm font-semibold text-[var(--sea-deep)] hover:underline">
        ← Find programmes
      </Link>
      <p className="eyebrow mt-6">Up to 4</p>
      <h1 className="display mt-3 text-4xl md:text-6xl">Compare programmes</h1>
      <p className="mt-4 max-w-2xl text-[var(--ink-soft)]">
        Empty cells stay empty. Missing tuition, duration, and scholarship figures are not estimated.
      </p>
      <div className="mt-8">
        <CompareBoard programmes={programmes} />
      </div>
    </div>
  );
}
