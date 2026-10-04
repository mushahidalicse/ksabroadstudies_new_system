import Link from "next/link";
import { ProgrammeActions } from "@/components/programme-actions";
import { finderStatusLabel } from "@/lib/deadline-display";
import type { CatalogueCard } from "@/lib/programme-catalogue";
import { levelLabel } from "@/lib/programme-filters";
import { formatFee, regionLabel } from "@/lib/utils";
import { publicEnglishLine, publicTuitionLine } from "@/lib/programme-enrichment";

export function ProgrammeResult({ programme }: { programme: CatalogueCard }) {
  return (
    <article className="panel rounded-3xl p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--sea-deep)]">
            {levelLabel(programme.level)}
            {programme.field ? ` · ${programme.field}` : ""}
          </p>
          <h2 className="display mt-1 text-2xl leading-tight">
            <Link href={`/programs/p/${programme.slug}`} className="hover:text-[var(--sea)]">
              {programme.name}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            <Link href={programme.level === "phd" ? `/phd/${programme.universityId}` : `/universities/${programme.universityId}`} className="font-semibold hover:text-[var(--sea)]">
              {programme.universityName}
            </Link>
            {programme.city ? ` · ${programme.city}` : ""}
            {programme.region ? ` · ${regionLabel(programme.region)}` : ""}
          </p>
        </div>
        <span className={`status-pill status-${programme.finderStatus === "closing" ? "soon" : programme.finderStatus === "upcoming" ? "soon" : programme.finderStatus === "open" ? "open" : programme.finderStatus === "closed" ? "closed" : "tba"}`}>
          {finderStatusLabel(programme.finderStatus)}
        </span>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--ink-soft)]">Deadline</dt>
          <dd className="font-semibold">
            {programme.deadlineLabel}
            {programme.countdown ? ` · ${programme.countdown}` : ""}
            {programme.estimatedDeadline ? " · Estimated" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--ink-soft)]">Application fee</dt>
          <dd className="font-semibold">{formatFee(programme.applicationFeeEuro)}</dd>
        </div>
        <div>
          <dt className="text-[var(--ink-soft)]">Language</dt>
          <dd className="font-semibold">{programme.language}</dd>
        </div>
        <div>
          <dt className="text-[var(--ink-soft)]">English</dt>
          <dd className="font-semibold">{publicEnglishLine(programme) || programme.englishRequirement || "Check official source"}</dd>
        </div>
        {publicTuitionLine(programme) ? (
          <div>
            <dt className="text-[var(--ink-soft)]">Tuition</dt>
            <dd className="font-semibold">{publicTuitionLine(programme)}</dd>
          </div>
        ) : null}
      </dl>
      <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">
        {programme.admissionTest ? <span className="rounded-full border border-[var(--line)] px-2 py-1">{programme.admissionTest}</span> : null}
        {programme.centS ? <span className="rounded-full border border-[var(--line)] px-2 py-1">CEnT-S</span> : null}
        {programme.greGmat ? <span className="rounded-full border border-[var(--line)] px-2 py-1">GRE / GMAT</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ProgrammeActions slug={programme.slug} />
        <Link href={`/programs/p/${programme.slug}`} className="btn btn-outline text-sm py-2 px-3">
          View programme
        </Link>
      </div>
    </article>
  );
}
