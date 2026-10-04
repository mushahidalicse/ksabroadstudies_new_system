"use client";

import Link from "next/link";
import { ExternalLink, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ProgrammeActions } from "@/components/programme-actions";
import { englishBand, type EnglishFilter } from "@/lib/english-band";
import type { CatalogueCard } from "@/lib/programme-catalogue";
import { formatFee, regionLabel } from "@/lib/utils";

function matchesField(program: CatalogueCard, selected: string) {
  if (selected === "all") return true;
  const hay = `${program.field} ${program.name}`.toLowerCase();
  return selected
    .split("|")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .some((token) => hay.includes(token));
}

function feeOk(fee: number | null, band: string) {
  if (band === "all") return true;
  if (fee === null) return false;
  if (band === "free") return fee === 0;
  return fee < Number(band);
}

export function ProgramExplorer({
  programs,
  levelLabel,
  initialField = "",
  initialRegion = "",
  initialStatus = "",
  initialFee = "",
  englishFilter = "all",
}: {
  programs: CatalogueCard[];
  levelLabel: string;
  initialField?: string;
  initialRegion?: string;
  initialStatus?: string;
  initialFee?: string;
  englishFilter?: EnglishFilter;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [field, setField] = useState(initialField || "all");
  const [region, setRegion] = useState(initialRegion || "all");
  const [status, setStatus] = useState(initialStatus || "all");
  const [fee, setFee] = useState(initialFee || "all");
  const [test, setTest] = useState("all");

  useEffect(() => {
    const current = new URLSearchParams(window.location.search);
    const params = new URLSearchParams(current);
    const setOrDelete = (key: string, value: string) => {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    };
    setOrDelete("field", field);
    setOrDelete("region", region);
    setOrDelete("status", status);
    setOrDelete("fee", fee);
    if (params.toString() === current.toString()) return;
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [field, region, status, fee, pathname, router]);

  const fields = useMemo(() => {
    return Array.from(new Set(programs.map((p) => p.field).filter(Boolean))).sort();
  }, [programs]);

  const tests = useMemo(() => {
    return Array.from(
      new Set(programs.map((p) => p.admissionTest).filter((t): t is string => Boolean(t))),
    ).sort();
  }, [programs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return programs.filter((p) => {
      if (!matchesField(p, field)) return false;
      if (region !== "all" && p.region && p.region !== region) return false;
      if (status !== "all" && p.finderStatus !== status) return false;
      if (!feeOk(p.applicationFeeEuro, fee)) return false;
      if (englishFilter !== "all" && englishBand(p.englishRequirement) !== englishFilter) return false;
      if (test !== "all" && (p.admissionTest || "") !== test) return false;
      if (!q) return true;
      return [p.name, p.universityName, p.city, p.field, p.admissionTest]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [programs, query, field, region, status, fee, test, englishFilter]);

  const hasFilters = query || field !== "all" || region !== "all" || test !== "all" || status !== "all" || fee !== "all";

  return (
    <div className="space-y-5">
      <div
        className="panel rounded-3xl p-4 md:p-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3"
      >
        <label className="relative block">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]"
          />
          <input
            className="input pl-10"
            placeholder={`Search ${levelLabel.toLowerCase()} programmes…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select className="select" value={field} onChange={(e) => setField(e.target.value)}>
          <option value="all">All fields</option>
          {field !== "all" && !fields.includes(field) ? <option value={field}>From search</option> : null}
          {fields.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <select className="select" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="all">All regions</option>
          <option value="lazio">Lazio</option>
          <option value="south">South</option>
          <option value="centre">Centre</option>
          <option value="north">North</option>
        </select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="closing">Closing soon</option>
          <option value="upcoming">Upcoming</option>
          <option value="closed">Closed</option>
        </select>
        <select className="select" value={fee} onChange={(e) => setFee(e.target.value)}>
          <option value="all">Any application fee</option>
          <option value="free">Free</option>
          <option value="30">Under €30</option>
          <option value="50">Under €50</option>
        </select>
        {tests.length > 0 && (
          <select
            className="select"
            value={test}
            onChange={(e) => setTest(e.target.value)}
          >
            <option value="all">All admission tests</option>
            {tests.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[var(--ink-soft)] font-semibold">
          Showing {filtered.length} of {programs.length} {levelLabel.toLowerCase()} programmes
        </div>
        {hasFilters && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-bold text-[var(--sea-deep)]"
            onClick={() => {
              setQuery("");
              setField("all");
              setRegion("all");
              setStatus("all");
              setFee("all");
              setTest("all");
            }}
          >
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      <div className="grid gap-3 md:hidden">
        {filtered.map((program, index) => (
          <article
            key={`${program.universityId}-${program.name}-${index}`}
            className="mobile-card space-y-2"
          >
            <div className="font-bold text-lg leading-tight">
              <Link href={`/programs/p/${program.slug}`} className="hover:text-[var(--sea)]">{program.name}</Link>
            </div>
            <div className="text-sm text-[var(--ink-soft)]">
              <Link href={`/universities/${program.universityId}`} className="font-semibold hover:text-[var(--sea)]">
                {program.universityName}
              </Link>
              {" · "}
              {program.city}
              {program.region ? ` · ${regionLabel(program.region)}` : ""}
              {program.field ? ` · ${program.field}` : ""}
            </div>
            <p className="text-sm font-semibold">
              {program.deadlineLabel} · {formatFee(program.applicationFeeEuro)}
            </p>
            <ProgrammeActions slug={program.slug} compact />
            {program.applyUrl ? (
              <a
                href={program.applyUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline text-sm py-2 px-3"
              >
                Programme page <ExternalLink size={14} />
              </a>
            ) : (
              <Link
                href={`/universities/${program.universityId}`}
                className="btn btn-outline text-sm py-2 px-3"
              >
                University portal
              </Link>
            )}
          </article>
        ))}
      </div>

      <div className="table-wrap hidden md:block">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Program</th>
              <th>University</th>
              <th>City</th>
              <th>Deadline</th>
              <th>Fee</th>
              <th>Apply / details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((program, index) => (
              <tr key={`${program.universityId}-${program.name}-${index}`}>
                <td className="text-[var(--ink-soft)]">{index + 1}</td>
                <td className="font-bold">
                  <Link href={`/programs/p/${program.slug}`} className="hover:text-[var(--sea)]">{program.name}</Link>
                </td>
                <td>
                  <Link href={`/universities/${program.universityId}`} className="font-semibold hover:text-[var(--sea)]">
                    {program.universityName}
                  </Link>
                </td>
                <td>{program.city}</td>
                <td>{program.deadlineLabel}</td>
                <td>{formatFee(program.applicationFeeEuro)}</td>
                <td>
                  {program.applyUrl ? (
                    <a
                      href={program.applyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-[var(--sea-deep)] hover:underline"
                    >
                      Programme page <ExternalLink size={14} />
                    </a>
                  ) : (
                    <Link
                      href={`/universities/${program.universityId}`}
                      className="font-semibold text-[var(--sea-deep)] hover:underline"
                    >
                      See university portal
                    </Link>
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
