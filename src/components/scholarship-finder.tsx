"use client";

import { useMemo, useState } from "react";
import { SCHOLARSHIP_LABEL, matchScholarships, type ScholarshipLabel } from "@/lib/scholarships/scholarship-match";
import type { ScholarshipsDataset } from "@/lib/scholarship-types";
import { EMPTY_PROFILE, type StudentProfile } from "@/lib/student-types";

const LABELS: Array<[ScholarshipLabel | "", string]> = [
  ["", "All labels"],
  ["potentially-relevant", "Potentially relevant"],
  ["check-current-call", "Check current call"],
  ["not-relevant", "Not relevant to selected region"],
  ["closed", "Currently closed"],
  ["upcoming", "Upcoming / not announced"],
];

export function ScholarshipFinder({
  dataset,
  initialProfile,
}: {
  dataset: ScholarshipsDataset;
  initialProfile?: StudentProfile;
}) {
  const [profile, setProfile] = useState<StudentProfile>(initialProfile ?? EMPTY_PROFILE);
  const [label, setLabel] = useState<ScholarshipLabel | "">("");
  const [accommodation, setAccommodation] = useState(false);
  const [meals, setMeals] = useState(false);
  const [regional, setRegional] = useState(false);

  const rows = useMemo(() => {
    const matched = matchScholarships(
      { ...profile, scholarshipInterest: profile.scholarshipInterest || "yes" },
      dataset,
    ).map((row) => {
      const stillRequired = [...row.stillRequired];
      if (accommodation) stillRequired.push("Confirm whether the current call includes accommodation.");
      if (meals) stillRequired.push("Confirm whether the current call includes meals or canteen support.");
      if (regional) stillRequired.push("Regional right-to-study support has its own call and income rules.");
      return { ...row, stillRequired };
    });
    return label ? matched.filter((row) => row.label === label) : matched;
  }, [profile, dataset, label, accommodation, meals, regional]);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Screening tool</p>
        <h1 className="display mt-3 text-4xl md:text-5xl">Scholarship finder</h1>
        <p className="mt-3 max-w-3xl text-[var(--ink-soft)]">
          This screens the stored regional scholarship records against the region you select. Final eligibility depends on the official call and may include income or ISEE rules, merit, enrolment, residency, documents, and deadlines. This page does not award a scholarship.
        </p>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">Dataset updated {dataset.lastUpdated}. Intake {dataset.intake}.</p>
      </div>
      <form className="panel grid gap-3 rounded-3xl p-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">
          Preferred region
          <select
            className="select"
            value={profile.regionPreference}
            onChange={(event) =>
              setProfile({ ...profile, regionPreference: event.target.value as StudentProfile["regionPreference"] })
            }
          >
            <option value="">Not selected</option>
            <option value="lazio">Lazio</option>
            <option value="north">North</option>
            <option value="centre">Centre</option>
            <option value="south">South</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Result label
          <select className="select" value={label} onChange={(event) => setLabel(event.target.value as ScholarshipLabel | "")}>
            {LABELS.map(([value, text]) => (
              <option key={text} value={value}>{text}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={accommodation} onChange={(event) => setAccommodation(event.target.checked)} />
          I need accommodation
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={meals} onChange={(event) => setMeals(event.target.checked)} />
          I want meals or canteen support
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2">
          <input type="checkbox" checked={regional} onChange={(event) => setRegional(event.target.checked)} />
          I intend to ask about regional right-to-study support
        </label>
      </form>
      <div className="grid gap-4">
        {rows.map((row) => (
          <article key={row.id} className="panel rounded-3xl p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="display text-2xl">{row.name}</h2>
                <p className="text-sm text-[var(--ink-soft)]">{row.region} · {row.agency}</p>
              </div>
              <p className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-bold uppercase tracking-wide">
                {SCHOLARSHIP_LABEL[row.label]}
              </p>
            </div>
            <p className="text-sm">
              Stored status: {row.status}.
              {row.academicYear ? ` Academic year stated in the record: ${row.academicYear}.` : ""}
              {" "}Deadline note: {row.deadline || "Not recorded."}
            </p>
            {row.nextCall ? <p className="text-sm font-semibold">{row.nextCall}</p> : null}
            {row.benefits.length ? (
              <ul className="text-sm">
                {row.benefits.map((benefit) => (
                  <li key={benefit}>Stored benefit: {benefit}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm">No benefit text is stored.</p>
            )}
            <div>
              <h3 className="text-sm font-bold">Why shown</h3>
              <ul className="mt-1 text-sm">
                {row.why.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold">Still required</h3>
              <ul className="mt-1 text-sm">
                {row.stillRequired.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            {row.sourceUrl ? (
              <p className="text-sm">
                Stored source: <a className="underline" href={row.sourceUrl}>{row.sourceTitle || row.sourceUrl}</a>
                {" "}· Last updated {row.lastUpdated}
              </p>
            ) : (
              <p className="text-sm">No official source is stored. Last updated {row.lastUpdated}.</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
