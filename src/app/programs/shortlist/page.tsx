import type { Metadata } from "next";
import Link from "next/link";
import { ShortlistBoard } from "@/components/shortlist-board";
import { getCatalogue } from "@/lib/data";

export const metadata: Metadata = {
  title: "My Shortlist",
  description: "Programmes you saved on this device or on your student account.",
  robots: { index: false, follow: false },
};

export default async function ShortlistPage() {
  const programmes = await getCatalogue();
  return (
    <div className="site-shell page-hero pb-16">
      <Link href="/programs/find" className="text-sm font-semibold text-[var(--sea-deep)] hover:underline">
        ← Find programmes
      </Link>
      <p className="eyebrow mt-6">Saved programmes</p>
      <h1 className="display mt-3 text-4xl md:text-6xl">My Shortlist</h1>
      <p className="mt-4 max-w-2xl text-[var(--ink-soft)]">
        Save programmes while you browse. Log in to keep the same shortlist on every device.
      </p>
      <div className="mt-8">
        <ShortlistBoard programmes={programmes} />
      </div>
    </div>
  );
}
