import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProgrammeActions } from "@/components/programme-actions";
import { JsonLd } from "@/components/json-ld";
import { getCatalogue, getProgrammeBySlug } from "@/lib/data";
import { finderStatusLabel } from "@/lib/deadline-display";
import { englishBand } from "@/lib/english-band";
import { levelLabel } from "@/lib/programme-filters";
import { absoluteUrl } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { publicEnglishLine, publicMoiLine, publicTuitionLine } from "@/lib/programme-enrichment";
import { formatAdmissionDate, formatFee, regionLabel } from "@/lib/utils";

export const revalidate = 120;

export async function generateStaticParams() {
  const rows = await getCatalogue();
  return [
    ...rows.map((row) => ({ slug: row.slug })),
    ...rows.flatMap((row) => (row.aliasSlugs ?? []).map((slug) => ({ slug }))),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const programme = await getProgrammeBySlug(slug);
  if (!programme) return { title: "Programme" };
  const title = `${programme.name} at ${programme.universityName}`;
  const description = `${levelLabel(programme.level)} in ${programme.city || "Italy"}. Application status: ${finderStatusLabel(programme.finderStatus)}. Confirm the official university call before you apply.`;
  return {
    title,
    description,
    alternates: { canonical: `/programs/p/${programme.slug}` },
    openGraph: { title, description, url: `/programs/p/${programme.slug}` },
  };
}

function fact(label: string, value: string) {
  return (
    <div className="rounded-2xl border border-[var(--line)] px-4 py-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

export default async function ProgrammeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const programme = await getProgrammeBySlug(slug);
  if (!programme) notFound();
  if (programme.slug !== slug) redirect(`/programs/p/${programme.slug}`);

  const band = englishBand(programme.englishRequirement);
  const englishCopy =
    band === "moi"
      ? "The university note mentions MOI or an English letter. That is not a promise that this programme accepts it. Confirm the official call."
      : band === "ielts"
        ? "The university note mentions IELTS or TOEFL. Confirm the required score on the official call."
        : "Not specified on this record. Check the official source.";
  const statusClass =
    programme.finderStatus === "open"
      ? "status-open"
      : programme.finderStatus === "closed"
        ? "status-closed"
        : programme.finderStatus === "unannounced"
          ? "status-tba"
          : "status-soon";
  const universityHref = programme.level === "phd" ? `/phd/${programme.universityId}` : `/universities/${programme.universityId}`;
  const ask = `${SITE.whatsappUrl}?text=${encodeURIComponent(`Assalam o alaikum, I have a question about ${programme.name} at ${programme.universityName}.`)}`;
  const checked = formatAdmissionDate(programme.catalogueChecked, { emptyLabel: "Not available" });
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Find My Programme", item: absoluteUrl("/programs/find") },
          { "@type": "ListItem", position: 3, name: programme.name, item: absoluteUrl(`/programs/p/${programme.slug}`) },
        ],
      },
      {
        "@type": "Course",
        name: programme.name,
        description: englishCopy,
        provider: {
          "@type": "CollegeOrUniversity",
          name: programme.universityName,
          ...(programme.universityWebsite ? { url: programme.universityWebsite } : {}),
        },
        url: absoluteUrl(`/programs/p/${programme.slug}`),
      },
    ],
  };

  return (
    <div className="site-shell page-hero pb-16">
      <JsonLd data={graph} />
      <nav className="text-sm font-semibold text-[var(--ink-soft)]" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[var(--sea)]">Home</Link>
        {" / "}
        <Link href="/programs/find" className="hover:text-[var(--sea)]">Programmes</Link>
        {" / "}
        <span>{programme.name}</span>
      </nav>
      <p className="eyebrow mt-6">{levelLabel(programme.level)}</p>
      <h1 className="display mt-3 text-4xl md:text-6xl max-w-4xl">{programme.name}</h1>
      <p className="mt-3 text-lg">
        <Link href={universityHref} className="font-semibold text-[var(--sea-deep)] hover:underline">
          {programme.universityName}
        </Link>
        {programme.city ? ` · ${programme.city}` : ""}
        {programme.region ? ` · ${regionLabel(programme.region)}` : ""}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className={`status-pill ${statusClass}`}>{finderStatusLabel(programme.finderStatus)}</span>
        <p className="text-sm font-semibold">
          Deadline: {programme.deadlineLabel}
          {programme.countdown ? ` · ${programme.countdown}` : ""}
        </p>
        <p className="text-sm text-[var(--ink-soft)]">Last checked: {checked}</p>
      </div>
      <div className="mt-5">
        <ProgrammeActions slug={programme.slug} />
      </div>

      <section className="mt-10">
        <h2 className="display text-3xl">Quick facts</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fact("University", programme.universityName)}
          {fact("Degree", levelLabel(programme.level))}
          {programme.degreeClass ? fact("Degree class", programme.degreeClass) : null}
          {fact("Duration", "Not available")}
          {fact("Language", programme.language || "Check official source")}
          {fact("Application fee", formatFee(programme.applicationFeeEuro))}
          {fact("Tuition", publicTuitionLine(programme) || "Not available")}
          {fact("English requirement", publicEnglishLine(programme) || programme.englishRequirement || "Check official source")}
          {fact("Test", programme.admissionTest || "Not recorded")}
          {fact("CEnT-S", programme.centS ? "Mentioned on this record" : "Not recorded")}
          {fact("GRE/GMAT", programme.greGmat ? "Mentioned on this record" : "Not recorded")}
          {fact("CIMEA", programme.requiresCimea === null ? "Not available" : programme.requiresCimea ? "Marked required on the university record" : "Not marked required")}
          {fact("DOV", "Check official source")}
          {fact("Scholarship", "Check official source")}
        </dl>
      </section>

      <section className="panel mt-8 rounded-3xl p-6 md:p-8 space-y-3">
        <h2 className="display text-3xl">About the programme</h2>
        <p className="text-[var(--ink-soft)] leading-relaxed">
          {programme.name} is listed under {programme.universityName}
          {programme.field ? ` in ${programme.field}` : ""}. According to the published catalogue this is a {programme.language.toLowerCase()} record for {programme.intake}. Subject to university evaluation.
        </p>
        {programme.renames?.length ? (
          <p className="text-[var(--ink-soft)] leading-relaxed">
            Previously offered as {programme.renames.map((item) => item.title).join(", ")}
            {programme.renames[0]?.academicYear ? `. The denomination changed in ${programme.renames[0].academicYear}` : ""}.
            {programme.italianTitle ? ` Italian title: ${programme.italianTitle}.` : ""}
          </p>
        ) : null}
      </section>

      <section className="panel mt-6 rounded-3xl p-6 md:p-8 space-y-3">
        <h2 className="display text-3xl">Admission requirements</h2>
        <p className="text-[var(--ink-soft)] leading-relaxed">
          Programme-level entry rules are not copied here unless the catalogue already stores them. Read the official call for degree, credits, and documents.
        </p>
        <p>
          <Link href="/guides/documents" className="font-semibold text-[var(--sea-deep)] hover:underline">
            Pakistan document chain
          </Link>
        </p>
      </section>

      <section className="panel mt-6 rounded-3xl p-6 md:p-8 space-y-3">
        <h2 className="display text-3xl">English requirement</h2>
        {programme.requirementOrigin === "verified" || programme.requirementOrigin === "partial" ? (
          <>
            <p className="font-semibold">{publicEnglishLine(programme) || "No numeric English score is stored."}</p>
            <p>MOI: {publicMoiLine(programme)}</p>
            <p>Source: {programme.enrichmentSourceTitle || programme.enrichmentSourceType || "Official source"}</p>
            <p>Last checked: {programme.enrichmentLastChecked ? formatAdmissionDate(programme.enrichmentLastChecked) : "Not available"}</p>
            {programme.enrichmentAcademicYear ? <p>Academic year on this check: {programme.enrichmentAcademicYear}</p> : null}
          </>
        ) : (
          <p className="font-semibold">Not yet verified at programme level.</p>
        )}
        <p className="text-[var(--ink-soft)] leading-relaxed">{programme.englishRequirement || "No catalogue sentence is stored."}</p>
        <p className="text-[var(--ink-soft)] leading-relaxed">{englishCopy}</p>
      </section>

      <section className="panel mt-6 rounded-3xl p-6 md:p-8 space-y-3">
        <h2 className="display text-3xl">Application deadline</h2>
        <p className="font-semibold">{programme.deadlineLabel}</p>
        {programme.countdown ? <p className="font-semibold text-[var(--sea-deep)]">{programme.countdown}</p> : null}
        {programme.estimatedDeadline ? (
          <p className="text-sm text-[var(--ink-soft)]">Estimated — confirm the official call. This is not a countdown.</p>
        ) : null}
        <p className="text-[var(--ink-soft)] leading-relaxed">
          EU and non-EU dates are not stored as separate fields on this record. The date above is the university call in the catalogue, not a personal deadline.
        </p>
      </section>

      <section className="panel mt-6 rounded-3xl p-6 md:p-8 space-y-3">
        <h2 className="display text-3xl">Application process</h2>
        <ol className="list-decimal space-y-2 pl-5 text-[var(--ink-soft)]">
          <li>Read the official university call for this programme.</li>
          <li>Prepare the Pakistan document file. <Link href="/guides" className="font-semibold text-[var(--sea-deep)] hover:underline">Guides</Link></li>
          <li>Non-EU applicants usually complete Universitaly pre-enrolment when the call requires it.</li>
          <li>After a university outcome, follow the embassy visa steps. <Link href="/guides/visa" className="font-semibold text-[var(--sea-deep)] hover:underline">Visa guide</Link></li>
        </ol>
        <p className="text-sm">Typical path for Pakistani applicants. The university call can change the order.</p>
      </section>

      <section className="panel mt-6 rounded-3xl p-6 md:p-8 space-y-3">
        <h2 className="display text-3xl">Official sources</h2>
        <ul className="space-y-2">
          <li>
            {programme.applyUrl ? (
              <a href={programme.applyUrl} target="_blank" rel="noreferrer" className="font-semibold text-[var(--sea-deep)] hover:underline">Programme or course link</a>
            ) : (
              "Programme page: Not available"
            )}
          </li>
          <li>
            {programme.sourceUrl ? (
              <a href={programme.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-[var(--sea-deep)] hover:underline">{programme.sourceTitle || "Recorded source"}</a>
            ) : (
              "Official call: Source not yet recorded"
            )}
          </li>
          <li>
            {programme.admissionPortal ? (
              <a href={programme.admissionPortal} target="_blank" rel="noreferrer" className="font-semibold text-[var(--sea-deep)] hover:underline">University application portal</a>
            ) : (
              "Application portal: Check official source"
            )}
          </li>
        </ul>
      </section>

      <section className="panel mt-6 rounded-3xl p-6 md:p-8 space-y-2">
        <h2 className="display text-3xl">Data verification</h2>
        <p>Last checked: {checked}</p>
        <p>
          Status:{" "}
          {programme.verificationStatus === "verified"
            ? "Verified from the recorded programme source"
            : programme.verificationStatus === "partially_verified"
              ? "Partially verified — university record checked, not a full programme audit"
              : "Needs review"}
        </p>
        <p className="text-sm text-[var(--ink-soft)]">
          {programme.sourceUrl ? "A source link is stored on this record." : "Source not yet recorded for this programme."}
        </p>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/programs/compare`} className="btn btn-outline">Compare</Link>
        {programme.applyUrl || programme.universityWebsite ? (
          <a href={programme.applyUrl || programme.universityWebsite || "#"} target="_blank" rel="noreferrer" className="btn btn-sea">
            Official website
          </a>
        ) : null}
        <a href={ask} className="btn btn-primary" target="_blank" rel="noreferrer">Ask KS Abroad</a>
      </div>
    </div>
  );
}
