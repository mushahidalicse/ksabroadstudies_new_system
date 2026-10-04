"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  STUDENT_STATUS_STEPS,
  studentStatusLabel,
  type ApplicationStatus,
  type PackItem,
  type StudentApplication,
} from "@/lib/application-types";

type UniOption = {
  id: string;
  name: string;
  city: string;
  status: string;
  admissionPortal: string;
  programs: Array<{ name: string; level: string }>;
};

type CaseOption = {
  id: string;
  topic: string;
  status: string;
  type: string;
};

type HubPayload = {
  unlocked: boolean;
  vault: {
    items: PackItem[];
    readyCount: number;
    requiredCount: number;
    complete: boolean;
  };
  applications: Array<
    StudentApplication & {
      pack: {
        applicationId: string;
        items: PackItem[];
        readyCount: number;
        requiredCount: number;
        complete: boolean;
      };
    }
  >;
  cases: CaseOption[];
  universities: UniOption[];
};

function StatusLine({ status }: { status: ApplicationStatus }) {
  if (status === "on_hold" || status === "rejected" || status === "closed") return null;
  const index = STUDENT_STATUS_STEPS.indexOf(status);
  return (
    <ol className="flex flex-wrap gap-1.5">
      {STUDENT_STATUS_STEPS.map((step, stepIndex) => {
        const done = index >= stepIndex;
        return (
          <li
            key={step}
            className={
              done
                ? "rounded-full bg-[rgba(15,106,111,0.12)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--sea-deep)]"
                : "rounded-full border border-[var(--line)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)]"
            }
          >
            {studentStatusLabel(step)}
          </li>
        );
      })}
    </ol>
  );
}

export function ApplyHub({ statusEnabled = false }: { statusEnabled?: boolean }) {
  const [data, setData] = useState<HubPayload | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [universityId, setUniversityId] = useState("");
  const [programName, setProgramName] = useState("");
  const [caseId, setCaseId] = useState("");

  const selectedUni = useMemo(
    () => data?.universities.find((u) => u.id === universityId) ?? null,
    [data, universityId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portal/applications");
      if (res.status === 401) {
        setError("Please log in again.");
        return;
      }
      const json = (await res.json()) as HubPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not load apply hub.");
      setData(json);
      setCaseId((prev) => prev || json.cases[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load apply hub.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const programmeSignature = `${universityId}:${selectedUni?.programs[0]?.name || ""}`;
  const [appliedProgramme, setAppliedProgramme] = useState("");
  if (programmeSignature !== appliedProgramme) {
    setAppliedProgramme(programmeSignature);
    setProgramName(selectedUni?.programs[0]?.name || "");
  }

  async function requestApply(e: React.FormEvent) {
    e.preventDefault();
    if (!universityId) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/portal/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universityId,
          programName,
          level: selectedUni?.programs.find((p) => p.name === programName)?.level || "",
          consultancyCaseId: caseId || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not create request.");
      setMessage(
        "Request sent. KS Abroad will submit on the university portal and update your status here.",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel rounded-3xl p-6 md:p-8 space-y-5">
      <div>
        <p className="eyebrow">Stages 5–8 · Application</p>
        <h2 className="display mt-2 text-3xl">Admission updates</h2>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Stage 5 is the application update: secure the admission, and you apply for
          CIMEA yourself. Stage 6 is pre-enrolment. Stage 7 opens the visa file. Stage
          8 is visa approved or rejected. The status line turns on after the first
          installment proof.
        </p>
      </div>

      {error ? <p className="text-sm font-semibold text-[var(--coral)]">{error}</p> : null}
      {message ? (
        <p className="text-sm font-semibold text-[var(--sea-deep)]">{message}</p>
      ) : null}

      {loading || !data ? (
        <p className="text-sm text-[var(--ink-soft)]">Loading…</p>
      ) : (
        <>
          <div className="rounded-2xl border border-[var(--line)] p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">Document vault</span>
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--sea-deep)]">
                {data.vault.readyCount}/{data.vault.requiredCount} required ready
              </span>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.vault.items
                .filter((i) => i.required || i.present)
                .map((item) => (
                  <li
                    key={item.kind}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                  >
                    <span className="font-semibold">
                      {item.label}
                      {item.required ? "" : " (optional)"}
                    </span>
                    <span
                      className={
                        item.present
                          ? "text-xs font-bold uppercase text-[var(--sea-deep)]"
                          : "text-xs font-bold uppercase text-[var(--coral)]"
                      }
                    >
                      {item.present ? "In vault" : "Missing"}
                    </span>
                  </li>
                ))}
            </ul>
            <p className="text-xs text-[var(--ink-soft)]">
              This checklist follows your study level. Upload missing items in the vault
              above. The same files are reused for every university.
            </p>
          </div>

          {!data.unlocked ? (
            <div className="rounded-2xl border border-[var(--coral)]/40 bg-[var(--coral)]/5 p-4 space-y-2">
              <p className="font-semibold text-[var(--coral)]">Consultancy required</p>
              <p className="text-sm text-[var(--ink-soft)]">
                Open a consultancy case in Step 4 (1-to-1 or private case). Once your case
                is open, this apply hub unlocks — KS Abroad handles portal submissions and
                status updates.
              </p>
              <Link href="#consultancy" className="btn btn-outline text-sm w-fit">
                Go to consultancy
              </Link>
            </div>
          ) : (
            <form onSubmit={requestApply} className="grid gap-3">
              <p className="text-sm font-semibold text-[var(--sea-deep)]">
                Consultancy active — you can request assisted apply.
              </p>
              <label className="block">
                <span className="eyebrow">University</span>
                <select
                  className="select mt-2"
                  value={universityId}
                  onChange={(e) => setUniversityId(e.target.value)}
                  required
                >
                  <option value="">Select university…</option>
                  {data.universities.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {u.city}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="eyebrow">Programme</span>
                <select
                  className="select mt-2"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  required
                  disabled={!selectedUni}
                >
                  {!selectedUni ? (
                    <option value="">Select university first</option>
                  ) : selectedUni.programs.length === 0 ? (
                    <option value="Programme TBD">Programme TBD</option>
                  ) : (
                    selectedUni.programs.map((p) => (
                      <option key={`${p.level}-${p.name}`} value={p.name}>
                        {p.name} ({p.level})
                      </option>
                    ))
                  )}
                </select>
              </label>
              {data.cases.length > 0 ? (
                <label className="block">
                  <span className="eyebrow">Link consultancy case</span>
                  <select
                    className="select mt-2"
                    value={caseId}
                    onChange={(e) => setCaseId(e.target.value)}
                  >
                    {data.cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.topic} · {c.status}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button className="btn btn-sea w-fit" type="submit" disabled={submitting}>
                {submitting ? "Sending…" : "Request KS to apply"}
              </button>
            </form>
          )}

          <div className="space-y-3">
            <div className="eyebrow">Your applications · status by KS Abroad</div>
            {data.applications.length === 0 ? (
              <p className="text-sm text-[var(--ink-soft)]">
                No assisted-apply requests yet.
              </p>
            ) : (
              data.applications.map((app) => (
                <article
                  key={app.id}
                  className="rounded-2xl border border-[var(--line)] p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="font-bold">{app.universityName}</h3>
                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--sea-deep)]">
                      {studentStatusLabel(app.status)}
                    </span>
                  </div>
                  {statusEnabled ? <StatusLine status={app.status} /> : (
                    <p className="text-xs font-semibold text-[var(--ink-soft)]">
                      Status line opens after Stage 4 payment proof.
                    </p>
                  )}
                  <p className="text-sm text-[var(--ink-soft)]">{app.programName}</p>
                  <p className="text-xs text-[var(--ink-soft)]">
                    Pack {app.pack.readyCount}/{app.pack.requiredCount} docs · updated{" "}
                    {app.updatedAt.slice(0, 10)}
                  </p>
                  {app.staffNote ? (
                    <p className="text-sm">
                      <span className="font-semibold">KS note: </span>
                      {app.staffNote}
                    </p>
                  ) : null}
                  <a
                    href={app.portalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-[var(--sea-deep)] hover:underline"
                  >
                    Official portal (reference)
                  </a>
                </article>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
