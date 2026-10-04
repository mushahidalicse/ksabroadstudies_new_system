import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { StatusBadge } from "@/components/status-badge";
import {
  getScholarshipRegion,
  getScholarshipRegions,
} from "@/lib/scholarships";
import {
  breadcrumbJsonLd,
  scholarshipJsonLd,
} from "@/lib/structured-data";
import type { AdmissionStatus } from "@/lib/types";

export const revalidate = 120;
type Props = { params: Promise<{ id: string }> };

function asAdmissionStatus(status: string): AdmissionStatus {
  if (status === "open" || status === "soon" || status === "closed") return status;
  return "tba";
}

export async function generateStaticParams() {
  const regions = await getScholarshipRegions();
  return regions.map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const region = await getScholarshipRegion(id);
  if (!region) return { title: "Scholarship region" };
  return {
    title: `${region.region} regional scholarship`,
    description: `${region.agencyName}: portal, deadlines, documents, and benefits for students in ${region.region}.`,
    alternates: { canonical: `/scholarships/${region.id}` },
    openGraph: {
      title: `${region.region} regional scholarship`,
      description: `${region.agencyName} — DSU / right-to-study for ${region.region}.`,
      url: `/scholarships/${region.id}`,
    },
  };
}

export default async function ScholarshipRegionPage({ params }: Props) {
  const { id } = await params;
  const region = await getScholarshipRegion(id);
  if (!region) notFound();

  return (
    <div className="site-shell py-12 md:py-16">
      <JsonLd
        data={[
          scholarshipJsonLd(region),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Scholarships", path: "/scholarships" },
            { name: region.region, path: `/scholarships/${region.id}` },
          ]),
        ]}
      />
      <Link
        href="/scholarships"
        className="text-sm font-semibold text-[var(--sea-deep)] hover:underline"
      >
        ← All regional scholarships
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{region.regionIt}</p>
          <h1 className="display mt-2 text-4xl md:text-6xl max-w-3xl">
            {region.region} regional scholarship
          </h1>
          <p className="mt-3 text-lg text-[var(--ink-soft)] max-w-2xl">
            {region.agencyName}
          </p>
        </div>
        <StatusBadge status={asAdmissionStatus(region.status)} />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Open period", value: region.openPeriod },
          {
            label: "Priority desk",
            value:
              region.priority === 0
                ? "Lazio"
                : region.priority === 1
                  ? "South"
                  : region.priority === 2
                    ? "Centre"
                    : "North",
          },
          {
            label: "Cities covered",
            value: `${region.citiesServed.length} listed`,
          },
          {
            label: "Local agencies",
            value: String(region.agencies?.length || 1),
          },
        ].map((item) => (
          <div key={item.label} className="panel rounded-2xl p-5">
            <div className="eyebrow">{item.label}</div>
            <div className="mt-2 font-bold text-lg">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="panel rounded-3xl p-6 md:p-8 space-y-5">
          <div>
            <h2 className="display text-3xl">Deadlines & call notes</h2>
            <p className="mt-3 text-[var(--ink-soft)] leading-relaxed">
              {region.deadlineNote}
            </p>
          </div>
          <div className="section-rule" />
          <div>
            <h2 className="display text-3xl">Who this covers</h2>
            <p className="mt-3 text-[var(--ink-soft)] leading-relaxed">
              {region.notes}
            </p>
            <p className="mt-3 text-sm font-semibold">
              Cities: {region.citiesServed.join(", ")}
            </p>
          </div>
        </div>

        <div className="panel rounded-3xl p-6 md:p-8 space-y-4">
          <h2 className="display text-3xl">Apply / portals</h2>
          <a
            href={region.applyUrl || region.portalUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-sea w-full"
          >
            Official apply / bando page <ExternalLink size={16} />
          </a>
          <a
            href={region.portalUrl}
            target="_blank"
            rel="noreferrer"
            className="block font-semibold text-[var(--sea-deep)] hover:underline"
          >
            Agency homepage
          </a>

          {region.agencies && region.agencies.length > 0 && (
            <>
              <div className="section-rule" />
              <div className="eyebrow">Local agencies</div>
              <ul className="space-y-4">
                {region.agencies.map((agency) => (
                  <li key={agency.name + agency.portalUrl}>
                    <div className="font-bold">{agency.name}</div>
                    {agency.cities && (
                      <div className="text-xs text-[var(--ink-soft)] mt-1">
                        {agency.cities.join(", ")}
                      </div>
                    )}
                    {agency.deadlineNote && (
                      <div className="text-sm text-[var(--ink-soft)] mt-1">
                        {agency.deadlineNote}
                      </div>
                    )}
                    <a
                      href={agency.applyUrl || agency.portalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[var(--sea-deep)] hover:underline"
                    >
                      Open portal <ExternalLink size={14} />
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="panel rounded-3xl p-6 md:p-8">
          <h2 className="display text-3xl">Typical benefits</h2>
          <ul className="mt-4 space-y-2 text-[var(--ink-soft)]">
            {region.typicalBenefits.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
        <div className="panel rounded-3xl p-6 md:p-8">
          <h2 className="display text-3xl">Documents usually needed</h2>
          <ul className="mt-4 space-y-2 text-[var(--ink-soft)]">
            {region.typicalDocuments.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>

      <section className="mt-8 panel rounded-3xl p-6 md:p-8">
        <h2 className="display text-3xl">Official sources</h2>
        <ul className="mt-4 space-y-2">
          {region.sources.map((url) => (
            <li key={url}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-[var(--sea-deep)] hover:underline break-all"
              >
                {url}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
