"use client";

import Link from "next/link";
import { ExternalLink, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import type { University } from "@/lib/types";
import { effectiveAdmissionStatus } from "@/lib/admission-status";
import { formatAdmissionDate, formatFee, regionLabel } from "@/lib/utils";

const REGION_CHIPS = [
  { value: "all", label: "All" },
  { value: "lazio", label: "Lazio" },
  { value: "south", label: "South" },
  { value: "centre", label: "Centre" },
  { value: "north", label: "North" },
] as const;

export function UniversityExplorer({
  universities,
  initialRegion = "all",
}: {
  universities: University[];
  initialRegion?: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [region, setRegion] = useState(initialRegion || "all");
  const [fee, setFee] = useState("all");
  const [cimea, setCimea] = useState("all");

  const listed = useMemo(
    () =>
      universities.map((uni) => ({
        ...uni,
        status: effectiveAdmissionStatus(uni),
      })),
    [universities],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listed.filter((uni) => {
      if (status !== "all" && uni.status !== status) return false;
      if (region !== "all" && uni.region !== region) return false;
      if (fee === "free" && uni.applicationFeeEuro !== 0) return false;
      if (fee === "paid" && !(uni.applicationFeeEuro && uni.applicationFeeEuro > 0))
        return false;
      if (cimea === "yes" && !uni.requiresCimea) return false;
      if (cimea === "no" && uni.requiresCimea) return false;
      if (!q) return true;
      const hay = [
        uni.name,
        uni.city,
        uni.region,
        uni.englishRequirement,
        uni.cgpaRequirement,
        uni.status,
        uni.notes,
        ...uni.programs.map((p) => p.name),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [listed, query, status, region, fee, cimea]);

  const hasFilters =
    query || status !== "all" || region !== "all" || fee !== "all" || cimea !== "all";

  function reset() {
    setQuery("");
    setStatus("all");
    setRegion("all");
    setFee("all");
    setCimea("all");
  }

  return (
    <div className="space-y-5">
      <div className="panel rounded-3xl p-4 md:p-5 space-y-4">
        <label className="relative block">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]"
          />
          <input
            className="input pl-10"
            placeholder="Search university, city, IELTS, CGPA…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <div>
          <div className="eyebrow mb-2">Region</div>
          <div className="chip-row">
            {REGION_CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                className={`chip ${region === chip.value ? "chip-active" : ""}`}
                onClick={() => setRegion(chip.value)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="soon">Opening soon</option>
            <option value="closed">Closed</option>
          </select>
          <select className="select" value={fee} onChange={(e) => setFee(e.target.value)}>
            <option value="all">Any fee</option>
            <option value="free">No application fee</option>
            <option value="paid">Paid application</option>
          </select>
          <select
            className="select"
            value={cimea}
            onChange={(e) => setCimea(e.target.value)}
          >
            <option value="all">CIMEA any</option>
            <option value="yes">CIMEA often needed</option>
            <option value="no">CIMEA not flagged</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[var(--ink-soft)] font-semibold">
          Showing {filtered.length} of {universities.length} universities
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-sm font-bold text-[var(--sea-deep)]"
          >
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {filtered.map((uni) => (
          <article key={uni.id} className="mobile-card space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`/universities/${uni.id}`}
                  className="font-bold text-lg leading-tight hover:text-[var(--sea)]"
                >
                  {uni.name}
                </Link>
                <div className="mt-1 text-xs text-[var(--ink-soft)] font-semibold">
                  {uni.city} · {regionLabel(uni.region)} · {uni.programs.length} programmes
                </div>
              </div>
              <StatusBadge status={uni.status} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="eyebrow">Fee</div>
                <div className="font-semibold mt-1">{formatFee(uni.applicationFeeEuro)}</div>
              </div>
              <div>
                <div className="eyebrow">Deadline</div>
                <div className="font-semibold mt-1" suppressHydrationWarning>
                  {formatAdmissionDate(uni.deadline ?? uni.estimatedOpenDate, {
                    status: uni.status,
                  })}
                </div>
              </div>
            </div>
            <p className="text-sm text-[var(--ink-soft)] line-clamp-2">
              {uni.englishRequirement}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/universities/${uni.id}`} className="btn btn-sea text-sm py-2 px-3">
                Details
              </Link>
              <a
                href={uni.admissionPortal}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline text-sm py-2 px-3"
              >
                Apply portal <ExternalLink size={14} />
              </a>
            </div>
          </article>
        ))}
      </div>

      {/* Desktop table */}
      <div className="table-wrap hidden md:block">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>University</th>
              <th>Region</th>
              <th>Admission portal</th>
              <th>Fee</th>
              <th>English</th>
              <th>Open / Deadline</th>
              <th>Status</th>
              <th>CGPA / notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((uni, index) => (
              <tr key={uni.id}>
                <td className="text-[var(--ink-soft)]">{index + 1}</td>
                <td>
                  <Link
                    href={`/universities/${uni.id}`}
                    className="font-bold hover:text-[var(--sea)]"
                  >
                    {uni.name}
                  </Link>
                  <div className="text-xs text-[var(--ink-soft)] mt-1">
                    {uni.city} · {uni.programs.length} English programmes listed
                  </div>
                </td>
                <td className="whitespace-nowrap font-semibold">
                  {regionLabel(uni.region)}
                </td>
                <td>
                  <a
                    href={uni.admissionPortal}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[var(--sea-deep)] hover:underline"
                  >
                    Apply portal <ExternalLink size={14} />
                  </a>
                </td>
                <td className="whitespace-nowrap font-semibold">
                  {formatFee(uni.applicationFeeEuro)}
                </td>
                <td className="text-sm max-w-[180px]">{uni.englishRequirement}</td>
                <td className="text-sm" suppressHydrationWarning>
                  <div>
                    {formatAdmissionDate(uni.estimatedOpenDate, {
                      status: uni.status,
                    })}
                  </div>
                  <div className="text-[var(--ink-soft)] mt-1">
                    {["Deadline:", formatAdmissionDate(uni.deadline ?? uni.estimatedOpenDate, { status: uni.status })].join(" ")}
                  </div>
                </td>
                <td>
                  <StatusBadge status={uni.status} />
                </td>
                <td className="text-sm max-w-[220px]">
                  <div className="font-semibold">{uni.cgpaRequirement}</div>
                  {uni.requiresCimea && (
                    <div className="text-xs text-[var(--coral)] mt-1 font-semibold">
                      CIMEA / DOV often required
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
