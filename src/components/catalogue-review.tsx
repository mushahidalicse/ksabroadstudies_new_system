"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SOURCE_TYPES, type EnrichmentRecord } from "@/lib/programme-enrichment";

type Row = {
  slug: string;
  name: string;
  universityName: string;
  level: string;
  region: string;
  city: string;
  finderStatus: string;
  enrichmentStatus: string | null;
  lastChecked: string | null;
  requirementOrigin: string;
  saves: number;
  score: number;
};

type Quality = Record<string, number>;

const TESTS = ["CEnT-S", "TOLC", "SAT", "GRE", "GMAT", "interview", "university test", "other"];

function password() {
  return localStorage.getItem("ks-admin-password") || "";
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": password(),
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

export function CatalogueReview() {
  const [rows, setRows] = useState<Row[]>([]);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [record, setRecord] = useState<EnrichmentRecord | null>(null);
  const [detail, setDetail] = useState<{ originalEnglish: string; parsed: string; history: { field: string; at: string }[] } | null>(null);
  const [message, setMessage] = useState("");
  const [confirmSource, setConfirmSource] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ q: query, ...filters });
    const body = await api(`/api/admin/catalogue-review?${params}`);
    setRows(body.rows);
    setQuality(body.quality);
  }, [filters, query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load().catch((error: Error) => setMessage(error.message));
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function open(slug: string) {
    const body = await api(`/api/admin/catalogue-review?slug=${encodeURIComponent(slug)}`);
    setRecord(body.enrichment);
    setDetail({
      originalEnglish: body.originalEnglish,
      parsed: JSON.stringify(body.parsed, null, 2),
      history: body.history,
    });
    setConfirmClear(false);
    setConfirmSource(false);
    setMessage("");
  }

  async function save() {
    if (!record) return;
    setMessage("");
    try {
      await api("/api/admin/catalogue-review", {
        method: "PUT",
        body: JSON.stringify({ ...record, confirmSource, confirmClear }),
      });
      setMessage("Saved.");
      await open(record.slug);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    }
  }

  async function remove() {
    if (!record || !window.confirm("Delete this enrichment record? The original catalogue text stays.")) return;
    await api("/api/admin/catalogue-review", { method: "DELETE", body: JSON.stringify({ slug: record.slug, confirm: "delete" }) });
    setRecord(null);
    await load();
  }

  async function importJson(file: File) {
    const text = await file.text();
    const parsed = JSON.parse(text) as { records?: unknown };
    await api("/api/admin/catalogue-review", { method: "POST", body: JSON.stringify({ records: parsed.records ?? parsed }) });
    setMessage("Import saved. A backup was written first.");
    await load();
  }

  function patch(next: EnrichmentRecord) {
    setRecord(next);
  }

  return (
    <div className="stack">
      <p className="eyebrow">Catalogue review</p>
      <h1>Programme requirements</h1>
      <p className="lead">Add a verified programme-level value only when an official source states it. Unknown is a valid answer.</p>
      {quality ? (
        <div className="grid grid-3">
          {Object.entries(quality).map(([key, value]) => (
            <article className="panel" key={key}><strong>{value}</strong><p>{key}</p></article>
          ))}
        </div>
      ) : null}
      <div className="panel stack">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search programme or university" />
        <div className="row wrap">
          {[
            ["missingSource", "Missing source"],
            ["missingIelts", "Missing IELTS"],
            ["moiUnknown", "MOI unknown"],
            ["missingTuition", "Missing tuition"],
            ["missingAcademic", "Missing academic requirement"],
            ["needsReview", "Needs review"],
          ].map(([key, label]) => (
            <label key={key}><input type="checkbox" checked={filters[key] === "1"} onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.checked ? "1" : "" }))} /> {label}</label>
          ))}
          <select value={filters.level || ""} onChange={(event) => setFilters((current) => ({ ...current, level: event.target.value }))}>
            <option value="">Degree</option>
            <option value="bachelor">Bachelor</option>
            <option value="master">Master</option>
            <option value="single-cycle">Single-cycle</option>
            <option value="phd">PhD</option>
          </select>
          <select value={filters.region || ""} onChange={(event) => setFilters((current) => ({ ...current, region: event.target.value }))}>
            <option value="">Region</option>
            <option value="lazio">Lazio</option>
            <option value="south">South</option>
            <option value="centre">Centre</option>
            <option value="north">North</option>
          </select>
          <select value={filters.status || ""} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">Verification</option>
            <option value="needs_review">Needs review</option>
            <option value="partially_verified">Partially verified</option>
            <option value="verified">Verified</option>
            <option value="outdated">Outdated</option>
          </select>
          <label>Last checked before <input type="date" value={filters.checkedBefore || ""} onChange={(event) => setFilters((current) => ({ ...current, checkedBefore: event.target.value }))} /></label>
        </div>
        <p><a href="/api/admin/catalogue-review?export=json">JSON export</a> needs the admin header, so use the browser only after saving from this page via the buttons below.</p>
        <button className="btn btn-line" type="button" onClick={() => void api("/api/admin/catalogue-review?export=json").then((body) => {
          const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = "programme-enrichment.json";
          link.click();
        })}>Download JSON</button>
        <label className="btn btn-line">Import JSON<input type="file" accept="application/json" hidden onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importJson(file).catch((error: Error) => setMessage(error.message));
        }} /></label>
      </div>
      {message ? <p role="status">{message}</p> : null}
      <div className="grid grid-2">
        <div className="stack">
          {rows.map((row) => (
            <button className="panel" key={row.slug} type="button" onClick={() => void open(row.slug)}>
              <strong>{row.name}</strong>
              <p>{row.universityName} · {row.level} · {row.city} · {row.region || "region not set"}</p>
              <p>{row.enrichmentStatus || "No enrichment"} · {row.lastChecked || "Not checked"} · saves {row.saves} · priority {row.score}</p>
            </button>
          ))}
        </div>
        {record && detail ? (
          <form className="panel stack" onSubmit={(event) => { event.preventDefault(); void save(); }}>
            <h2>{record.slug}</h2>
            <button className="btn btn-line" type="button" onClick={() => {
              void api("/api/admin/research", { method: "POST", body: JSON.stringify({ action: "start", slug: record.slug }) })
                .then(() => setMessage("Research finished as pending review. It is not verified until you approve it."))
                .catch((error: Error) => {
                  if (error.message.includes("Research again") && window.confirm(error.message)) {
                    void api("/api/admin/research", { method: "POST", body: JSON.stringify({ action: "start", slug: record.slug, confirmAgain: true }) })
                      .then(() => setMessage("Research finished as pending review."))
                      .catch((retry: Error) => setMessage(retry.message));
                    return;
                  }
                  setMessage(error.message);
                });
            }}>Research with AI</button>
            <p><Link href="/admin/research">Open the research desk</Link></p>
            <p>Original catalogue text stays available:</p>
            <p>{detail.originalEnglish || "No English sentence is stored."}</p>
            <label>IELTS minimum<input value={record.english.ieltsMin ?? ""} onChange={(event) => patch({ ...record, english: { ...record.english, ieltsMin: event.target.value === "" ? null : Number(event.target.value) } })} /></label>
            <label>TOEFL minimum<input value={record.english.toeflMin ?? ""} onChange={(event) => patch({ ...record, english: { ...record.english, toeflMin: event.target.value === "" ? null : Number(event.target.value) } })} /></label>
            <label>Cambridge
              <select value={String(record.english.cambridgeAccepted)} onChange={(event) => patch({ ...record, english: { ...record.english, cambridgeAccepted: event.target.value === "true" ? true : event.target.value === "false" ? false : null } })}>
                <option value="null">Unknown</option><option value="true">Accepted</option><option value="false">Not accepted</option>
              </select>
            </label>
            <label>MOI
              <select value={record.english.moi ?? ""} onChange={(event) => patch({ ...record, english: { ...record.english, moi: (event.target.value || null) as EnrichmentRecord["english"]["moi"] } })}>
                <option value="">No override</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="unknown">Unknown</option>
              </select>
            </label>
            <label>CEFR<input value={record.english.level ?? ""} onChange={(event) => patch({ ...record, english: { ...record.english, level: event.target.value || null } })} /></label>
            <label>English notes<textarea value={record.english.notes ?? ""} onChange={(event) => patch({ ...record, english: { ...record.english, notes: event.target.value || null } })} /></label>
            <label>Test required
              <select value={String(record.test.required)} onChange={(event) => patch({ ...record, test: { ...record.test, required: event.target.value === "true" ? true : event.target.value === "false" ? false : null } })}>
                <option value="null">Unknown</option><option value="true">Yes</option><option value="false">No</option>
              </select>
            </label>
            <fieldset>
              <legend>Test types</legend>
              {TESTS.map((type) => (
                <label key={type}><input type="checkbox" checked={record.test.types.includes(type as never)} onChange={(event) => {
                  const types = event.target.checked ? [...record.test.types, type] : record.test.types.filter((item) => item !== type);
                  patch({ ...record, test: { ...record.test, types: types as EnrichmentRecord["test"]["types"] } });
                }} /> {type}</label>
              ))}
            </fieldset>
            <label>Tuition mode
              <select value={record.tuition.mode ?? ""} onChange={(event) => patch({ ...record, tuition: { ...record.tuition, mode: (event.target.value || null) as EnrichmentRecord["tuition"]["mode"] } })}>
                <option value="">No override</option><option value="single">Single amount</option><option value="range">Range</option><option value="variable">Income-based / variable</option><option value="unknown">Unknown</option>
              </select>
            </label>
            <label>Amount<input value={record.tuition.amount ?? ""} onChange={(event) => patch({ ...record, tuition: { ...record.tuition, amount: event.target.value === "" ? null : Number(event.target.value) } })} /></label>
            <label>Minimum<input value={record.tuition.min ?? ""} onChange={(event) => patch({ ...record, tuition: { ...record.tuition, min: event.target.value === "" ? null : Number(event.target.value) } })} /></label>
            <label>Maximum<input value={record.tuition.max ?? ""} onChange={(event) => patch({ ...record, tuition: { ...record.tuition, max: event.target.value === "" ? null : Number(event.target.value) } })} /></label>
            <label>Period
              <select value={record.tuition.period ?? ""} onChange={(event) => patch({ ...record, tuition: { ...record.tuition, period: (event.target.value || null) as EnrichmentRecord["tuition"]["period"] } })}>
                <option value="">Not stated</option><option value="year">Year</option><option value="semester">Semester</option><option value="programme">Programme</option>
              </select>
            </label>
            <label>Tuition notes<textarea value={record.tuition.notes ?? ""} onChange={(event) => patch({ ...record, tuition: { ...record.tuition, notes: event.target.value || null } })} /></label>
            <label>Minimum CGPA<input value={record.academic.minimumCgpa ?? ""} onChange={(event) => patch({ ...record, academic: { ...record.academic, minimumCgpa: event.target.value === "" ? null : Number(event.target.value) } })} /></label>
            <label>CGPA scale<input value={record.academic.cgpaScale ?? ""} onChange={(event) => patch({ ...record, academic: { ...record.academic, cgpaScale: event.target.value === "" ? null : Number(event.target.value) } })} /></label>
            <label>Minimum percentage<input value={record.academic.minimumPercentage ?? ""} onChange={(event) => patch({ ...record, academic: { ...record.academic, minimumPercentage: event.target.value === "" ? null : Number(event.target.value) } })} /></label>
            <label>Required background<input value={record.academic.requiredBackground.join(", ")} onChange={(event) => patch({ ...record, academic: { ...record.academic, requiredBackground: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } })} /></label>
            <label>ECTS if published<input value={record.academic.ects ?? ""} onChange={(event) => patch({ ...record, academic: { ...record.academic, ects: event.target.value || null } })} /></label>
            <label>Source URL<input value={record.sourceUrl} onChange={(event) => patch({ ...record, sourceUrl: event.target.value })} /></label>
            <label>Source title<input value={record.sourceTitle} onChange={(event) => patch({ ...record, sourceTitle: event.target.value })} /></label>
            <label>Source type
              <select value={record.sourceType} onChange={(event) => patch({ ...record, sourceType: event.target.value as EnrichmentRecord["sourceType"] })}>
                <option value="">Choose</option>
                {SOURCE_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <label>Last checked<input type="date" value={record.lastChecked} onChange={(event) => patch({ ...record, lastChecked: event.target.value })} /></label>
            <label>Academic year<input value={record.academicYear} onChange={(event) => patch({ ...record, academicYear: event.target.value })} placeholder="2026/27" /></label>
            <label>Status
              <select value={record.verificationStatus} onChange={(event) => patch({ ...record, verificationStatus: event.target.value as EnrichmentRecord["verificationStatus"] })}>
                <option value="needs_review">Needs review</option>
                <option value="partially_verified">Partially verified</option>
                <option value="verified">Verified</option>
                <option value="outdated">Outdated</option>
              </select>
            </label>
            <label>Admin notes<textarea value={record.notes} onChange={(event) => patch({ ...record, notes: event.target.value })} /></label>
            <label><input type="checkbox" checked={confirmSource} onChange={(event) => setConfirmSource(event.target.checked)} /> I am replacing the source</label>
            <label><input type="checkbox" checked={confirmClear} onChange={(event) => setConfirmClear(event.target.checked)} /> I am clearing a verified value</label>
            <button className="btn btn-sea" type="submit">Save enrichment</button>
            <button className="btn btn-line" type="button" onClick={() => void remove()}>Delete enrichment</button>
            <pre>{detail.parsed}</pre>
            <ul>{detail.history.map((entry) => <li key={`${entry.field}-${entry.at}`}>{entry.at} · {entry.field}</li>)}</ul>
          </form>
        ) : <p>Select a programme. The queue puts open calls, saved programmes, and Lazio or South first.</p>}
      </div>
    </div>
  );
}
