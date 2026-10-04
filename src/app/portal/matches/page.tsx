import type { Metadata } from "next";
import { PortalMatches } from "@/components/portal-matches";

export const metadata: Metadata = {
  title: "Programme matches",
  description: "Explainable programme matches from your KS Abroad Studies profile.",
  robots: { index: false, follow: false },
};

export default function PortalMatchesPage() {
  return (
    <div className="site-shell py-12 md:py-16">
      <PortalMatches />
    </div>
  );
}
