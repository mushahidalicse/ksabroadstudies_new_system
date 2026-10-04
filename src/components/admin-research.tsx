"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ApprovableField } from "@/lib/research/research-schema";

type Job = {
  id: string;
  programmeSlug: string;
  university: string;
  status: string;
  provider: string;
  createdAt: string;
  error: string;
  reviewStatus: string | null;
};

type Detail = {
  mock: boolean;
  reviewStatus: string;
  result: {
    researchIncomplete: boolean;
    searchesAttempted: string[];
    discoveryTrace?: Array<{ method: string; url: string; opened: boolean }>;
    unknownFields: string[];
    researchWarnings?: string[];
    identityConfidence?: string;
    catalogueAnomaly?: { reason: string; catalogueLevel: string; officialLevel: string | null; urls: string[] } | null;
    catalogueDecision?: string | null;
    deadlines?: Array<{ applicantType: string; date: string | null; dateType: string }>;
    conflicts: Array<{ field: string; englishValue: string; italianValue: string; englishUrl: string; italianUrl: string; proposedValue: string | null; reason: string }>;
    sources: Array<{ url: string; title: string; language: string; academicYear: string | null; sourceType: string; sourceConfirmed?: boolean }>;
    provider: string;
  };
  rows: Array<{ id: ApprovableField; label: string; proposed: string; catalogue: string; enrichment: string; source: string }>;
};

function password() {
  return localStorage.getItem("ks-admin-password") || "";
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", "x-admin-password": password(), ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

export function AdminResearch() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [review, setReview] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [jobId, setJobId] = useState("");
  const [chosen, setChosen] = useState<ApprovableField[]>([]);
  const [message, setMessage] = useState("");
  const [confirmMock, setConfirmMock] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    if (review) params.set("review", review);
    const body = await api(`/api/admin/research?${params}`);
    setJobs(body.rows);
    setCounts(body.counts);
  }, [query, review, status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load().catch((error: Error) => setMessage(error.message));
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function open(id: string) {
    const body = await api(`/api/admin/research?job=${encodeURIComponent(id)}`);
    setJobId(id);
    setDetail(body);
    setChosen([]);
    setConfirmMock(false);
  }

  async function send(body: Record<string, unknown>) {
    setMessage("");
    try {
      await api("/api/admin/research", { method: "POST", body: JSON.stringify(body) });
      await load();
      if (jobId) await open(jobId);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Request failed.";
      if (text.includes("Research again") && window.confirm(text)) {
        await api("/api/admin/research", { method: "POST", body: JSON.stringify({ ...body, confirmAgain: true }) });
        await load();
        return;
      }
      setMessage(text);
    }
  }

  return (
    <div className="stack">
      <p className="eyebrow">Programme research</p>
      <h1>AI research desk</h1>
      <p className="lead">AI proposes findings from official English and Italian sources. A person approves them before they can enter the catalogue enrichment. Nothing here is verified on its own.</p>
      <div className="grid grid-3">
        {Object.entries(counts).map(([key, value]) => <article className="panel" key={key}><strong>{value}</strong><p>{key}</p></article>)}
      </div>
      <div className="panel row wrap">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Programme or university" />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Job status</option>
          <option value="rate_limited">Rate limited</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="researching">Researching</option>
          <option value="queued">Queued</option>
        </select>
        <select value={review} onChange={(event) => setReview(event.target.value)}>
          <option value="">Review</option>
          <option value="pending_review">Pending review</option>
          <option value="research_incomplete_identity">Identity incomplete</option>
          <option value="catalogue_review_required">Catalogue review</option>
          <option value="needs_research_agent_fix">Needs research fix</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <button className="btn btn-line" type="button" onClick={() => void send({ action: "next" })}>Research next 5</button>
      </div>
      {message ? <p role="status">{message}</p> : null}
      <div className="grid grid-2">
        <div className="stack">
          {jobs.map((job) => (
            <button className="panel" key={job.id} type="button" onClick={() => void open(job.id)}>
              <strong>{job.programmeSlug}</strong>
              <p>{job.university} · {job.status} · {job.reviewStatus || "No review"} · {job.provider}</p>
              <p>{job.createdAt.slice(0, 10)}{job.error ? ` · ${job.error}` : ""}</p>
            </button>
          ))}
        </div>
        {detail ? (
          <div className="panel stack">
            {detail.reviewStatus === "needs_research_agent_fix" || detail.reviewStatus === "research_incomplete_identity" || detail.reviewStatus === "catalogue_review_required" ? <p>This result is not publishable. It is kept for review of the research agent and cannot be approved into the catalogue.</p> : null}
            {detail.result.catalogueAnomaly ? (
              <div>
                <p>Catalogue review required. The AI did not change the catalogue.</p>
                <p>{detail.result.catalogueAnomaly.reason}</p>
                <p>Catalogue level: {detail.result.catalogueAnomaly.catalogueLevel}. Official level found: {detail.result.catalogueAnomaly.officialLevel}.</p>
                {detail.result.catalogueAnomaly.urls.map((url) => <p key={url}><a href={url}>Supporting official page</a></p>)}
                <p>Decision recorded: {detail.result.catalogueDecision || "None yet"}.</p>
                <div className="row wrap">
                  <button className="btn btn-line" type="button" onClick={() => void send({ action: "catalogue-decision", jobId, decision: "keep" })}>Keep catalogue row</button>
                  <button className="btn btn-line" type="button" onClick={() => void send({ action: "catalogue-decision", jobId, decision: "edit_manually" })}>Edit catalogue manually</button>
                  <button className="btn btn-line" type="button" onClick={() => void send({ action: "catalogue-decision", jobId, decision: "inactive_requested" })}>Mark inactive</button>
                  <button className="btn btn-line" type="button" onClick={() => void send({ action: "catalogue-decision", jobId, decision: "investigate_later" })}>Investigate later</button>
                </div>
              </div>
            ) : null}
            {detail.result.deadlines?.map((deadline) => <p key={`${deadline.dateType}-${deadline.date}`}>{deadline.dateType}: {deadline.date || "Unknown"}. {deadline.dateType.startsWith("enrol") || deadline.dateType.startsWith("immatric") ? "This is not the application deadline." : ""}</p>)}
            {detail.result.identityConfidence ? <p>Identity: {detail.result.identityConfidence}</p> : null}
            {detail.result.researchWarnings?.map((warning) => <p key={warning}>{warning}</p>)}
            {detail.result.researchIncomplete ? <p>Research incomplete. Missing: {detail.result.unknownFields.join(", ") || "official sources"}.</p> : null}
            <p>Searches: {detail.result.searchesAttempted.join("; ") || "Not recorded"}</p>
            {detail.result.discoveryTrace?.length ? <p>Discovery: {detail.result.discoveryTrace.map((item) => `${item.method} ${item.opened ? "opened" : "not opened"}`).join("; ")}</p> : null}
            {detail.result.conflicts.map((conflict) => (
              <div key={conflict.field}>
                <p>Official-source conflict · {conflict.field}</p>
                <p>English page: {conflict.englishValue}</p>
                <p>Italian source: {conflict.italianValue}</p>
                <p>{conflict.reason}</p>
                <p>AI recommendation: {conflict.proposedValue || "No automatic choice. Human decision required."}</p>
                <p><a href={conflict.englishUrl}>English source</a> · <a href={conflict.italianUrl}>Italian source</a></p>
              </div>
            ))}
            {detail.rows.map((row) => (
              <label key={row.id}>
                <input type="checkbox" checked={chosen.includes(row.id)} onChange={(event) => setChosen((current) => event.target.checked ? [...current, row.id] : current.filter((item) => item !== row.id))} />
                {row.label}: catalogue {row.catalogue}; enrichment {row.enrichment}; AI found {row.proposed}. Source: {row.source}
              </label>
            ))}
            <div className="stack">
              {detail.result.sources.map((source) => (
                <p key={source.url}>{source.language === "it" ? "Italian" : source.language === "en" ? "English" : "Other"} · {source.academicYear || "Year not stated"} · <a href={source.url}>View original source</a></p>
              ))}
            </div>
            {detail.mock ? <label><input type="checkbox" checked={confirmMock} onChange={(event) => setConfirmMock(event.target.checked)} /> I understand this mock result is not an official finding</label> : null}
            {detail.reviewStatus === "pending_review" ? <button className="btn btn-sea" type="button" onClick={() => void send({ action: "approve", jobId, fields: chosen, confirmMock })}>Approve selected</button> : null}
            <button className="btn btn-line" type="button" onClick={() => void send({ action: "reject", jobId })}>Reject</button>
            <p><Link href="/admin/catalogue-review">Open catalogue review</Link></p>
          </div>
        ) : <p>Select a research job. Pending results stay off the public website until you approve a field.</p>}
      </div>
    </div>
  );
}
