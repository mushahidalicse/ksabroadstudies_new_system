import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { StatusBadge } from "@/components/status-badge";
import { getUniversities, getUniversity } from "@/lib/data";
import {
  breadcrumbJsonLd,
  universityJsonLd,
} from "@/lib/structured-data";
import { effectiveAdmissionStatus } from "@/lib/admission-status";
import { formatAdmissionDate, formatFee, regionLabel } from "@/lib/utils";

export const revalidate = 120;

type Props = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  const universities = await getUniversities();
  return universities.map((u) => ({ id: u.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const uni = await getUniversity(id);
  if (!uni) return { title: "University" };
  return {
    title: `${uni.name} admissions`,
    description: `${uni.name} admission portal, English programmes, fees, and deadlines for international students.`,
    alternates: { canonical: `/universities/${uni.id}` },
    openGraph: {
      title: `${uni.name} admissions`,
      description: `${uni.name} in ${uni.city}, Italy — portals, fees, and English programmes.`,
      url: `/universities/${uni.id}`,
    },
  };
}

export default async function UniversityDetailPage({ params }: Props) {
  const { id } = await params;
  const record = await getUniversity(id);
  if (!record) notFound();
  const uni = { ...record, status: effectiveAdmissionStatus(record) };

  const listed = uni.programs.filter((program) => !program.aliasOf);
  const publicUni = { ...uni, programs: listed };
  const bachelors = listed.filter((p) => p.level === "bachelor");
  const masters = listed.filter((p) => p.level === "master");
  const singleCycle = listed.filter((p) => p.level === "single-cycle");

  return (
    <div className="site-shell py-12 md:py-16">
      <JsonLd
        data={[
          universityJsonLd(publicUni),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Universities", path: "/universities" },
            { name: uni.name, path: `/universities/${uni.id}` },
          ]),
        ]}
      />
      <Link
        href="/universities"
        className="text-sm font-semibold text-[var(--sea-deep)] hover:underline"
      >
        ← All universities
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {uni.city}, Italy · {regionLabel(uni.region)}
            {(uni.region === "lazio" || uni.region === "south") && " · priority desk"}
          </p>
          <h1 className="display mt-2 text-4xl md:text-6xl max-w-3xl">{uni.name}</h1>
        </div>
        <StatusBadge status={uni.status} />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Application fee", value: formatFee(uni.applicationFeeEuro) },
          {
            label: uni.status === "open" ? "Applications" : "Opens / next cycle",
            value: formatAdmissionDate(uni.estimatedOpenDate, {
              status: uni.status,
            }),
          },
          {
            label: "Deadline",
            value: formatAdmissionDate(uni.deadline),
          },
          {
            label: "CIMEA / DOV",
            value: uni.requiresCimea ? "Often required" : "Confirm on portal",
          },
        ].map((item) => (
          <div key={item.label} className="panel rounded-2xl p-5">
            <div className="eyebrow">{item.label}</div>
            <div className="mt-2 font-bold text-lg">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="panel rounded-3xl p-6 md:p-8 space-y-5">
          <div>
            <h2 className="display text-3xl">Admission snapshot</h2>
            <p className="mt-3 text-[var(--ink-soft)] leading-relaxed">{uni.notes}</p>
          </div>
          <div className="section-rule" />
          <div>
            <div className="eyebrow">English requirement</div>
            <p className="mt-2 font-semibold">{uni.englishRequirement}</p>
          </div>
          <div>
            <div className="eyebrow">CGPA / academic profile</div>
            <p className="mt-2 font-semibold">{uni.cgpaRequirement}</p>
          </div>
        </div>

        <div className="panel rounded-3xl p-6 md:p-8 space-y-4">
          <h2 className="display text-3xl">Apply links</h2>
          <a
            href={uni.admissionPortal}
            target="_blank"
            rel="noreferrer"
            className="btn btn-sea w-full"
          >
            Main admission portal <ExternalLink size={16} />
          </a>
          <a
            href={uni.website}
            target="_blank"
            rel="noreferrer"
            className="block font-semibold text-[var(--sea-deep)] hover:underline"
          >
            Official university website
          </a>
          <div className="section-rule" />
          <ul className="space-y-3">
            {uni.applyLinks.map((link) => (
              <li key={link.url + link.label}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 font-semibold hover:text-[var(--sea)]"
                >
                  {link.label} <ExternalLink size={14} />
                </a>
                <div className="text-xs uppercase tracking-wider text-[var(--ink-soft)] mt-1">
                  {link.type}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="display text-3xl md:text-4xl">English programmes on our list</h2>
        <p className="mt-3 text-[var(--ink-soft)] max-w-2xl">
          Where a programme has its own page or apply flow, the direct link is
          included. Otherwise use the main admission portal above.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <ProgramGroup title="Bachelor's" programs={bachelors} />
          <ProgramGroup title="Master's" programs={masters} />
          <ProgramGroup title="Single-cycle" programs={singleCycle} />
        </div>
      </section>
    </div>
  );
}

function ProgramGroup({
  title,
  programs,
}: {
  title: string;
  programs: {
    name: string;
    applyUrl: string | null;
    field: string;
    admissionTest?: string | null;
  }[];
}) {
  return (
    <div className="panel rounded-3xl p-6">
      <div className="eyebrow">{title}</div>
      <div className="display mt-2 text-3xl">{programs.length}</div>
      <ul className="mt-5 space-y-3">
        {programs.length === 0 && (
          <li className="text-[var(--ink-soft)]">No English programmes listed yet.</li>
        )}
        {programs.map((program) => (
          <li
            key={program.name}
            className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-3"
          >
            <div>
              <div className="font-bold">{program.name}</div>
              <div className="text-sm text-[var(--ink-soft)]">
                {program.field || "—"}
                {program.admissionTest ? ` · Test: ${program.admissionTest}` : ""}
              </div>
            </div>
            {program.applyUrl ? (
              <a
                href={program.applyUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-sm font-semibold text-[var(--sea-deep)] hover:underline"
              >
                Open
              </a>
            ) : (
              <span className="text-sm text-[var(--ink-soft)]">Via portal</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
