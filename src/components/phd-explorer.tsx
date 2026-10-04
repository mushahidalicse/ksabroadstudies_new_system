"use client";

import Link from "next/link";
import { ExternalLink, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { PhdUniversity } from "@/lib/phd-types";
import { regionLabel } from "@/lib/utils";

const REGION_CHIPS = [
  { value: "all", label: "All" },
  { value: "lazio", label: "Lazio" },
  { value: "south", label: "South" },
  { value: "centre", label: "Centre" },
  { value: "north", label: "North" },
] as const;

function portalLabel(type: string) {
  switch (type) {
    case "pica":
      return "PICA";
    case "esse3":
      return "Esse3";
    case "own":
      return "Own portal";
    case "mixed":
      return "Mixed";
    default:
      return "Check hub";
  }
}

export function PhdExplorer({
  universities,
  initialQuery = "",
  initialRegion = "all",
}: {
  universities: PhdUniversity[];
  initialQuery?: string;
  initialRegion?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [region, setRegion] = useState(initialRegion || "all");
  const [portal, setPortal] = useState("all");
  const [englishOnly, setEnglishOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return universities.filter((u) => {
      if (region !== "all" && u.region !== region) return false;
      if (portal !== "all" && u.portalType !== portal) return false;
      if (englishOnly && !(u.programmes?.length > 0)) return false;
      if (!q) return true;
      const hay = [
        u.name,
        u.city,
        u.englishNote,
        u.selection,
        ...u.programmes.map((p) => `${p.name} ${p.field} ${p.language}`),
      ]
        .join(" ")
        .toLowerCase();
      return q
        .split("|")
        .map((token) => token.trim())
        .filter(Boolean)
        .some((token) => hay.includes(token));
    });
  }, [universities, query, region, portal, englishOnly]);

  const hasFilters = query || region !== "all" || portal !== "all" || englishOnly;

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
            placeholder="Search university, PhD field, English…"
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

        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className="select"
            value={portal}
            onChange={(e) => setPortal(e.target.value)}
          >
            <option value="all">All portals</option>
            <option value="pica">PICA (CINECA)</option>
            <option value="esse3">Esse3</option>
            <option value="own">Own university portal</option>
            <option value="mixed">Mixed</option>
          </select>
          <label className="flex items-center gap-2 text-sm font-semibold px-1">
            <input
              type="checkbox"
              checked={englishOnly}
              onChange={(e) => setEnglishOnly(e.target.checked)}
            />
            Only unis with listed English-friendly programmes
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[var(--ink-soft)] font-semibold">
          Showing {filtered.length} of {universities.length} universities
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setRegion("all");
              setPortal("all");
              setEnglishOnly(false);
            }}
            className="inline-flex items-center gap-1 text-sm font-bold text-[var(--sea-deep)]"
          >
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((u) => (
          <article key={u.id} className="panel rounded-3xl p-5 md:p-6 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  href={`/phd/${u.id}`}
                  className="font-bold text-lg leading-tight hover:text-[var(--sea)]"
                >
                  {u.name}
                </Link>
                <div className="mt-1 text-xs font-semibold text-[var(--ink-soft)]">
                  {u.city}
                  {u.region ? ` · ${regionLabel(u.region)}` : ""} ·{" "}
                  {u.programmes.length} English-friendly courses listed
                </div>
              </div>
              <span className="status-pill status-soon text-[0.65rem]">
                {portalLabel(u.portalType)}
              </span>
            </div>
            <p className="text-sm text-[var(--ink-soft)] line-clamp-3 leading-relaxed">
              {u.englishNote || u.cycleNote}
            </p>
            {u.typicalDeadlineWindow && (
              <p className="text-xs font-semibold text-[var(--sea-deep)]">
                Deadlines: {u.typicalDeadlineWindow}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href={`/phd/${u.id}`} className="btn btn-sea text-sm py-2 px-3">
                PhD details
              </Link>
              {u.applicationPortal && (
                <a
                  href={u.applicationPortal}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline text-sm py-2 px-3"
                >
                  Apply portal <ExternalLink size={14} />
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
