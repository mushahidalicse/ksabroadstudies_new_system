"use client";

import Link from "next/link";
import { ExternalLink, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import type { RegionalScholarship } from "@/lib/scholarship-types";
import type { AdmissionStatus } from "@/lib/types";

function asAdmissionStatus(status: string): AdmissionStatus {
  if (status === "open" || status === "soon" || status === "closed") return status;
  return "tba";
}

function priorityLabel(priority: number): string {
  switch (priority) {
    case 0:
      return "Lazio";
    case 1:
      return "South";
    case 2:
      return "Centre";
    default:
      return "North";
  }
}

const BAND_CHIPS = [
  { value: "all", label: "All Italy" },
  { value: "0", label: "Lazio" },
  { value: "1", label: "South" },
  { value: "2", label: "Centre" },
  { value: "3", label: "North" },
] as const;

export function ScholarshipExplorer({
  regions,
}: {
  regions: RegionalScholarship[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [band, setBand] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return regions.filter((region) => {
      if (status !== "all" && region.status !== status) return false;
      if (band !== "all" && String(region.priority) !== band) return false;
      if (!q) return true;
      const agencyText = (region.agencies || [])
        .map((a) => `${a.name} ${a.portalUrl}`)
        .join(" ");
      const hay = [
        region.region,
        region.regionIt,
        region.agencyName,
        region.citiesServed.join(" "),
        region.deadlineNote,
        region.notes,
        agencyText,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [regions, query, status, band]);

  const hasFilters = query || status !== "all" || band !== "all";

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
            placeholder="Search region, DiSCo, ERSU, city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <div>
          <div className="eyebrow mb-2">Area</div>
          <div className="chip-row">
            {BAND_CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                className={`chip ${band === chip.value ? "chip-active" : ""}`}
                onClick={() => setBand(chip.value)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <select
          className="select max-w-xs"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="soon">Opening soon</option>
          <option value="closed">Closed</option>
          <option value="tba">Check portal</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[var(--ink-soft)] font-semibold">
          Showing {filtered.length} of {regions.length} regions / provinces
        </div>
        {hasFilters && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-bold text-[var(--sea-deep)]"
            onClick={() => {
              setQuery("");
              setStatus("all");
              setBand("all");
            }}
          >
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      <div className="grid gap-3 md:hidden">
        {filtered.map((region) => (
          <article key={region.id} className="mobile-card space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`/scholarships/${region.id}`}
                  className="font-bold text-lg hover:text-[var(--sea)]"
                >
                  {region.region}
                </Link>
                <div className="mt-1 text-xs text-[var(--ink-soft)] font-semibold">
                  {priorityLabel(region.priority)} · {region.agencyName}
                </div>
              </div>
              <StatusBadge status={asAdmissionStatus(region.status)} />
            </div>
            <p className="text-sm text-[var(--ink-soft)] line-clamp-3">
              {region.openPeriod}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/scholarships/${region.id}`}
                className="btn btn-sea text-sm py-2 px-3"
              >
                Details
              </Link>
              <a
                href={region.applyUrl || region.portalUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline text-sm py-2 px-3"
              >
                Portal <ExternalLink size={14} />
              </a>
            </div>
          </article>
        ))}
      </div>

      <div className="table-wrap hidden md:block">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Region</th>
              <th>Agency / portal</th>
              <th>Open period</th>
              <th>Status</th>
              <th>Cities</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((region, index) => (
              <tr key={region.id}>
                <td className="text-[var(--ink-soft)]">{index + 1}</td>
                <td>
                  <Link
                    href={`/scholarships/${region.id}`}
                    className="font-bold hover:text-[var(--sea)]"
                  >
                    {region.region}
                  </Link>
                  <div className="text-xs text-[var(--ink-soft)] mt-1">
                    {region.regionIt} · {priorityLabel(region.priority)} desk
                  </div>
                </td>
                <td>
                  <div className="font-semibold">{region.agencyName}</div>
                  <a
                    href={region.applyUrl || region.portalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[var(--sea-deep)] hover:underline"
                  >
                    Official portal <ExternalLink size={14} />
                  </a>
                </td>
                <td className="text-sm max-w-[240px]">
                  <div>{region.openPeriod}</div>
                  <div className="text-[var(--ink-soft)] mt-1 line-clamp-3">
                    {region.deadlineNote}
                  </div>
                </td>
                <td>
                  <StatusBadge status={asAdmissionStatus(region.status)} />
                </td>
                <td className="text-sm max-w-[180px]">
                  {region.citiesServed.slice(0, 4).join(", ")}
                  {region.citiesServed.length > 4 ? "…" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
