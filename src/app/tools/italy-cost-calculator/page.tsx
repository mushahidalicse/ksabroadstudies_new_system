import type { Metadata } from "next";
import { ItalyCostCalculator } from "@/components/italy-cost-calculator";
import { getProgrammeBySlug } from "@/lib/data";
import { publicTuitionLine } from "@/lib/programme-enrichment";

export const metadata: Metadata = {
  title: "Italy study cost calculator",
  description: "Estimate a first-year study-abroad cost in EUR. This is not an official quote.",
};

export default async function ItalyCostPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const programme = slug ? await getProgrammeBySlug(slug) : undefined;
  const tuition = programme?.requirements.tuition;
  const verifiedSingle = programme?.requirementOrigin === "verified" && tuition?.amount != null;
  return (
    <div className="site-shell py-12 md:py-16">
      <ItalyCostCalculator
        prefill={{
          programmeLabel: programme ? `${programme.name} · ${programme.universityName}` : null,
          applicationFeeEuro: programme?.applicationFeeEuro ?? null,
          tuitionEuro: verifiedSingle ? tuition?.amount ?? null : programme?.requirementOrigin === "catalogue" ? tuition?.amount ?? null : null,
          tuitionNote: programme && tuition && tuition.amount == null ? publicTuitionLine(programme) || tuition.notes : null,
          tuitionVerified: Boolean(verifiedSingle),
        }}
      />
    </div>
  );
}
