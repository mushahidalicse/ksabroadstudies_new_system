"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProgrammeActions } from "@/components/programme-actions";
import { MATCH_CATEGORY_LABEL, MATCH_STATUS_LABEL, PREFERENCE_LABEL, REQUIREMENT_LABEL } from "@/lib/matching/match-reasons";
import type { ProfileCompleteness } from "@/lib/matching/profile-completeness";
import type { MatchCategory, ProgrammeMatch } from "@/lib/matching/programme-match";

type Payload = {
  matches: ProgrammeMatch[];
  total: number;
  offset: number;
  completeness: ProfileCompleteness;
  notice: string;
  prompts: string[];
  error?: string;
};

const CATEGORIES: Array<[MatchCategory | "", string]> = [
  ["", "All match types"],
  ["strong", "Strong profile match"],
  ["possible", "Possible match"],
  ["needs-checking", "Needs checking"],
  ["mismatch", "Profile mismatch"],
];

export function PortalMatches() {
  const [filters, setFilters] = useState({
    category: "",
    status: "",
    region: "",
    field: "",
    maxFee: "",
    sort: "relevance",
  });
  const [rows, setRows] = useState<ProgrammeMatch[]>([]);
  const [total, setTotal] = useState(0);
  const [completeness, setCompleteness] = useState<ProfileCompleteness | null>(null);
  const [notice, setNotice] = useState("");
  const [prompts, setPrompts] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(offset: number, append: boolean) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.status) params.set("status", filters.status);
    if (filters.region) params.set("region", filters.region);
    if (filters.field.trim()) params.set("field", filters.field.trim());
    if (filters.maxFee) params.set("maxFee", filters.maxFee);
    if (filters.sort) params.set("sort", filters.sort);
    params.set("offset", String(offset));
    try {
      const res = await fetch(`/api/portal/matches?${params.toString()}`, { credentials: "same-origin" });
      const json = (await res.json()) as Payload;
      if (res.status === 401) {
        setError("Please log in.");
        return;
      }
      if (!res.ok) throw new Error(json.error || "Could not load matches.");
      setRows((current) => (append ? [...current, ...json.matches] : json.matches));
      setTotal(json.total);
      setCompleteness(json.completeness);
      setNotice(json.notice);
      setPrompts(json.prompts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load matches.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/portal/matches?sort=relevance&offset=0", { credentials: "same-origin" })
      .then(async (res) => {
        const json = (await res.json()) as Payload;
        if (cancelled) return;
        if (res.status === 401) {
          setError("Please log in.");
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error(json.error || "Could not load matches.");
        setRows(json.matches);
        setTotal(json.total);
        setCompleteness(json.completeness);
        setNotice(json.notice);
        setPrompts(json.prompts);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load matches.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Decision support</p>
        <h1 className="display mt-3 text-4xl md:text-5xl">Programme matches</h1>
        <p className="mt-3 max-w-2xl text-[var(--ink-soft)]">
          These results compare your profile with the published catalogue. They are not an admission decision.
        </p>
      </div>
      {completeness ? (
        <p className="text-sm font-semibold">
          Profile {completeness.percent}% complete
          {notice ? `. ${notice}` : ""}
        </p>
      ) : null}
      {prompts.length ? (
        <ul className="grid gap-2 text-sm">
          {prompts.map((prompt) => (
            <li key={prompt}>{prompt}</li>
          ))}
        </ul>
      ) : null}
      <form
        className="panel grid gap-3 rounded-3xl p-4 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          void load(0, false);
        }}
      >
        <label className="grid gap-1 text-sm font-semibold">
          Match type
          <select className="select" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
            {CATEGORIES.map(([value, label]) => (
              <option key={label} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Call status
          <select className="select" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">Any status</option>
            <option value="open">Open</option>
            <option value="closing">Closing soon</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Region
          <select className="select" value={filters.region} onChange={(event) => setFilters({ ...filters, region: event.target.value })}>
            <option value="">Any region</option>
            <option value="lazio">Lazio</option>
            <option value="north">North</option>
            <option value="centre">Centre</option>
            <option value="south">South</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Field
          <input className="input" value={filters.field} onChange={(event) => setFilters({ ...filters, field: event.target.value })} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Maximum application fee (EUR)
          <input className="input" inputMode="decimal" value={filters.maxFee} onChange={(event) => setFilters({ ...filters, maxFee: event.target.value })} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Sort
          <select className="select" value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>
            <option value="relevance">Match relevance</option>
            <option value="deadline">Deadline</option>
            <option value="fee">Application fee</option>
            <option value="verified">Recently checked</option>
          </select>
        </label>
        <button className="btn btn-sea md:col-span-3 w-fit" type="submit" disabled={loading}>
          {loading ? "Updating…" : "Apply filters"}
        </button>
      </form>
      {error ? <p className="text-sm font-semibold text-[var(--coral)]">{error} {error === "Please log in." ? <Link href="/login" className="underline">Log in</Link> : null}</p> : null}
      <p className="text-sm font-semibold text-[var(--ink-soft)]">{total} programmes</p>
      <div className="grid gap-4">
        {rows.map((match) => (
          <article key={match.slug} className="panel rounded-3xl p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="display text-2xl">{match.name}</h2>
                <p className="text-sm text-[var(--ink-soft)]">{match.universityName} · {match.city}</p>
              </div>
              <p className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-bold uppercase tracking-wide">
                {MATCH_CATEGORY_LABEL[match.category]}
              </p>
            </div>
            <p className="text-sm">{match.factorCount} profile factors matched · {MATCH_STATUS_LABEL[match.finderStatus] || match.finderStatus}</p>
            <p className="text-sm">Requirements: {REQUIREMENT_LABEL[match.requirementState]}</p>
            <p className="text-sm">Preferences: {PREFERENCE_LABEL[match.preferenceState]}</p>
            {match.englishLine ? <p className="text-sm">English: {match.englishLine}</p> : null}
            {match.tuitionLine ? <p className="text-sm">Tuition: {match.tuitionLine}</p> : null}
            <div>
              <h3 className="text-sm font-bold">Why it matched</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {match.reasons.map((reason) => (
                  <li key={reason.text}>Matched: {reason.text}</li>
                ))}
                {match.reasons.length === 0 ? <li>No positive factor is confirmed yet.</li> : null}
              </ul>
            </div>
            {match.publishedConflicts.length ? (
              <div>
                <h3 className="text-sm font-bold">Published requirement conflict</h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {match.publishedConflicts.map((reason) => (
                    <li key={reason.text}>{reason.text}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {match.preferenceConflicts.length ? (
              <div>
                <h3 className="text-sm font-bold">Preference conflict</h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {match.preferenceConflicts.map((reason) => (
                    <li key={reason.text}>{reason.text}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {match.checks.length ? (
              <div>
                <h3 className="text-sm font-bold">Needs checking</h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {match.checks.map((reason) => (
                    <li key={reason.text}>Check: {reason.text}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-sm text-[var(--ink-soft)]">
              {match.applicationFeeEuro == null ? "Application fee is not recorded." : `Application fee: €${match.applicationFeeEuro}. Catalogue value.`}
              {match.deadlineLabel ? ` Deadline: ${match.deadlineLabel}.` : ""}
            </p>
            {match.sourceUrl && match.catalogueChecked ? (
              <p className="text-sm">
                Stored source: <a className="underline" href={match.sourceUrl}>{match.sourceTitle || match.sourceUrl}</a>
                {` · Last checked ${match.catalogueChecked}`}
              </p>
            ) : match.sourceUrl ? (
              <p className="text-sm">
                Stored source: <a className="underline" href={match.sourceUrl}>{match.sourceTitle || match.sourceUrl}</a>
              </p>
            ) : (
              <p className="text-sm">No official source is stored. This requirement needs review.</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Link className="btn btn-outline text-sm py-2 px-3" href={`/programs/p/${match.slug}`}>Programme page</Link>
              <Link className="btn btn-outline text-sm py-2 px-3" href={`/tools/italy-cost-calculator?slug=${match.slug}`}>Estimate cost</Link>
              <ProgrammeActions slug={match.slug} compact saveLabel="Save to My Shortlist" />
            </div>
          </article>
        ))}
      </div>
      {rows.length < total ? (
        <button type="button" className="btn btn-outline" disabled={loading} onClick={() => void load(rows.length, true)}>
          {loading ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
