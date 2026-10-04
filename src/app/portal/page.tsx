import type { Metadata } from "next";
import { PortalDesk } from "@/components/portal-desk";
import { PortalErrorBoundary } from "@/components/portal-error-boundary";

export const metadata: Metadata = {
  title: "Student portal",
  description: "Your KS Abroad Studies profile, documents, and programme matches.",
  robots: { index: false, follow: false },
};

export default function PortalPage() {
  return (
    <div className="site-shell py-12 md:py-16">
      <p className="eyebrow">Paperless consultancy</p>
      <h1 className="display mt-3 text-4xl md:text-6xl max-w-3xl">Student portal</h1>
      <p className="mt-4 max-w-2xl text-lg text-[var(--ink-soft)] leading-relaxed">
        Move one step at a time: profile, documents, matches, services, payment,
        then the application tracker. The shortlist runs only after study level,
        field, CGPA, and English proof are saved.
      </p>
      <div className="mt-10">
        <PortalErrorBoundary>
          <PortalDesk />
        </PortalErrorBoundary>
      </div>
    </div>
  );
}
