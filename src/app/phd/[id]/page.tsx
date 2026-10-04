import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { getPhdUniversities, getPhdUniversity } from "@/lib/phd";
import {
  breadcrumbJsonLd,
  phdUniversityJsonLd,
} from "@/lib/structured-data";
import { regionLabel } from "@/lib/utils";

export const revalidate = 120;

type Props = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  const universities = await getPhdUniversities();
  return universities.map((u) => ({ id: u.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const uni = await getPhdUniversity(id);
  if (!uni) return { title: "PhD" };
  return {
    title: `${uni.name} PhD`,
    description: `PhD / Dottorato admissions at ${uni.name}: portal, requirements, English-friendly programmes.`,
    alternates: { canonical: `/phd/${uni.id}` },
    openGraph: {
      title: `${uni.name} PhD`,
      description: `PhD / Dottorato at ${uni.name}`,
      url: `/phd/${uni.id}`,
    },
  };
}

function portalLabel(type: string) {
  switch (type) {
    case "pica":
      return "PICA (CINECA)";
    case "esse3":
      return "Esse3 student portal";
    case "own":
      return "University own portal";
    case "mixed":
      return "Mixed portals";
    default:
      return "Confirm on PhD hub";
  }
}

export default async function PhdUniversityPage({ params }: Props) {
  const { id } = await params;
  const uni = await getPhdUniversity(id);
  if (!uni) notFound();

  return (
    <div className="site-shell py-12 md:py-16">
      <JsonLd
        data={[
          phdUniversityJsonLd(uni),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "PhD", path: "/phd" },
            { name: uni.name, path: `/phd/${uni.id}` },
          ]),
        ]}
      />
      <Link href="/phd" className="text-sm font-semibold text-[var(--sea-deep)] hover:underline">
        ← All PhD universities
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {uni.city}
            {uni.region ? ` · ${regionLabel(uni.region)}` : ""} · {uni.cycleNote}
          </p>
          <h1 className="display mt-2 text-4xl md:text-6xl max-w-3xl">{uni.name}</h1>
        </div>
        <span className="status-pill status-soon">{portalLabel(uni.portalType)}</span>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="panel rounded-2xl p-5">
          <div className="eyebrow">Application portal</div>
          <div className="mt-2 font-bold">{portalLabel(uni.portalType)}</div>
        </div>
        <div className="panel rounded-2xl p-5">
          <div className="eyebrow">Deadline window</div>
          <div className="mt-2 font-bold text-sm leading-snug">
            {uni.typicalDeadlineWindow || "See current bando"}
          </div>
        </div>
        <div className="panel rounded-2xl p-5">
          <div className="eyebrow">Confidence</div>
          <div className="mt-2 font-bold capitalize">{uni.confidence}</div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {uni.applicationPortal && (
          <a
            href={uni.applicationPortal}
            target="_blank"
            rel="noreferrer"
            className="btn btn-sea"
          >
            Open application portal <ExternalLink size={16} />
          </a>
        )}
        {uni.phdHubUrl && (
          <a
            href={uni.phdHubUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline"
          >
            Official PhD hub <ExternalLink size={16} />
          </a>
        )}
        {uni.website && (
          <a href={uni.website} target="_blank" rel="noreferrer" className="btn btn-outline">
            University site
          </a>
        )}
      </div>

      {uni.applicationPortalNote && (
        <p className="mt-4 text-sm text-[var(--ink-soft)] leading-relaxed max-w-3xl">
          Portal note: {uni.applicationPortalNote}
        </p>
      )}

      <section className="mt-10 panel rounded-3xl p-6 md:p-8 space-y-5">
        <div>
          <h2 className="display text-3xl">English & international notes</h2>
          <p className="mt-3 text-[var(--ink-soft)] leading-relaxed">
            {uni.englishNote || "Confirm language on the programme annex."}
          </p>
        </div>
        {uni.selection && (
          <div>
            <h3 className="font-bold">Selection</h3>
            <p className="mt-2 text-[var(--ink-soft)] leading-relaxed">{uni.selection}</p>
          </div>
        )}
        {uni.scholarshipNote && (
          <div>
            <h3 className="font-bold">Scholarship</h3>
            <p className="mt-2 text-[var(--ink-soft)] leading-relaxed">{uni.scholarshipNote}</p>
          </div>
        )}
      </section>

      {uni.requirements.length > 0 && (
        <section className="mt-8 panel rounded-3xl p-6 md:p-8">
          <h2 className="display text-3xl">Typical requirements</h2>
          <ul className="mt-5 space-y-2 text-sm text-[var(--ink-soft)]">
            {uni.requirements.map((r) => (
              <li key={r.slice(0, 60)}>· {r}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="display text-3xl md:text-4xl">
          English-friendly / international PhD courses
        </h2>
        <p className="mt-3 text-sm text-[var(--ink-soft)] max-w-3xl">
          Verified from official pages where language or international delivery is clear.
          Empty list does not mean no PhD exists — only that a clear English sheet was not
          confirmed in this curation.
        </p>
        {uni.programmes.length === 0 ? (
          <p className="mt-6 panel rounded-3xl p-6 text-[var(--ink-soft)]">
            No clearly labelled English-taught PhD sheet was confirmed yet. Use the PhD hub
            and current bando annexes.
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {uni.programmes.map((p) => (
              <li key={p.name + (p.applyUrl || "")} className="panel rounded-3xl p-5 md:p-6">
                <h3 className="font-bold text-lg">{p.name}</h3>
                <p className="mt-1 text-sm font-semibold text-[var(--sea-deep)]">{p.field}</p>
                <p className="mt-2 text-sm text-[var(--ink-soft)]">{p.language}</p>
                {p.notes && (
                  <p className="mt-2 text-sm text-[var(--ink-soft)] leading-relaxed">{p.notes}</p>
                )}
                {p.applyUrl && (
                  <a
                    href={p.applyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-3 text-sm font-bold text-[var(--sea-deep)] hover:underline"
                  >
                    Programme / apply info <ExternalLink size={14} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {uni.sources.length > 0 && (
        <section className="mt-10">
          <h2 className="display text-2xl">Sources</h2>
          <ul className="mt-4 space-y-2">
            {uni.sources.map((s) => (
              <li key={s}>
                <a
                  href={s}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-[var(--sea-deep)] hover:underline break-all"
                >
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href={`/universities/${uni.id}`} className="btn btn-outline">
          Bachelor/Master admissions page
        </Link>
        <Link href="/phd" className="btn btn-outline">
          Back to PhD hub
        </Link>
      </div>
    </div>
  );
}
