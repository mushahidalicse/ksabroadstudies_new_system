"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApplicationStatus } from "@/lib/application-types";
import type { ConsultancyCase, ConsultancyStatus } from "@/lib/consultancy-types";
import type { AdmissionStatus, UniversitiesDataset, University } from "@/lib/types";

const STORAGE_KEY = "ks-admin-password";

type AdminTab = "universities" | "applications" | "consultancy";

type AdminApplication = {
  id: string;
  studentId: string;
  universityName: string;
  programName: string;
  status: ApplicationStatus;
  statusLabel: string;
  staffNote: string;
  portalUrl: string;
  updatedAt: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  documents: Array<{ kind: string; originalName: string }>;
};

type AdminCase = ConsultancyCase & {
  studentName: string;
  studentEmail: string;
};

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<AdminTab>("universities");
  const [message, setMessage] = useState("");

  const [dataset, setDataset] = useState<UniversitiesDataset | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<AdmissionStatus>("tba");
  const [estimatedOpenDate, setEstimatedOpenDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [fee, setFee] = useState("");
  const [notes, setNotes] = useState("");

  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [appStatuses, setAppStatuses] = useState<
    Array<{ id: ApplicationStatus; label: string }>
  >([]);
  const [selectedAppId, setSelectedAppId] = useState("");
  const [appStatus, setAppStatus] = useState<ApplicationStatus>("requested");
  const [appNote, setAppNote] = useState("");
  const [appSaving, setAppSaving] = useState(false);

  const [cases, setCases] = useState<AdminCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [caseStatus, setCaseStatus] = useState<ConsultancyStatus>("open");
  const [caseReply, setCaseReply] = useState("");
  const [caseSaving, setCaseSaving] = useState(false);

  const selected = useMemo(
    () => dataset?.universities.find((u) => u.id === selectedId) || null,
    [dataset, selectedId],
  );
  const selectedApp = useMemo(
    () => applications.find((a) => a.id === selectedAppId) || null,
    [applications, selectedAppId],
  );
  const selectedCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) || null,
    [cases, selectedCaseId],
  );

  const loadUniversities = useCallback(async (pwd: string) => {
    const res = await fetch("/api/admin/universities", {
      headers: { "x-admin-password": pwd },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as UniversitiesDataset;
    setDataset(data);
    if (!selectedId && data.universities[0]) setSelectedId(data.universities[0].id);
    return true;
  }, [selectedId]);

  const loadApplications = useCallback(async (pwd: string) => {
    const res = await fetch("/api/admin/applications", {
      headers: { "x-admin-password": pwd },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      applications: AdminApplication[];
      statuses: Array<{ id: ApplicationStatus; label: string }>;
    };
    setApplications(data.applications);
    setAppStatuses(data.statuses);
    if (!selectedAppId && data.applications[0]) {
      setSelectedAppId(data.applications[0].id);
    }
    return true;
  }, [selectedAppId]);

  const loadCases = useCallback(async (pwd: string) => {
    const res = await fetch("/api/admin/consultancy", {
      headers: { "x-admin-password": pwd },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { cases: AdminCase[] };
    setCases(data.cases);
    if (!selectedCaseId && data.cases[0]) setSelectedCaseId(data.cases[0].id);
    return true;
  }, [selectedCaseId]);

  async function unlock(pwd: string) {
    setMessage("");
    const ok = await loadUniversities(pwd);
    if (!ok) {
      setAuthed(false);
      setMessage("Wrong password or API error.");
      return;
    }
    setAuthed(true);
    window.localStorage.setItem(STORAGE_KEY, pwd);
    await Promise.all([loadApplications(pwd), loadCases(pwd)]);
  }

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const timer = window.setTimeout(() => {
      setPassword(saved);
      void unlock(saved);
    }, 0);
    return () => window.clearTimeout(timer);
    // The saved password is applied after mount. unlock is recreated with selection state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedFormId = selected?.id ?? "";
  const [appliedUniversityId, setAppliedUniversityId] = useState("");
  if (selected && selectedFormId !== appliedUniversityId) {
    setAppliedUniversityId(selectedFormId);
    setStatus(selected.status);
    setEstimatedOpenDate(selected.estimatedOpenDate || "");
    setDeadline(selected.deadline || "");
    setFee(selected.applicationFeeEuro === null ? "" : String(selected.applicationFeeEuro));
    setNotes(selected.notes || "");
  }

  const [appliedAppId, setAppliedAppId] = useState("");
  if (selectedApp && selectedApp.id !== appliedAppId) {
    setAppliedAppId(selectedApp.id);
    setAppStatus(selectedApp.status);
    setAppNote(selectedApp.staffNote || "");
  }

  const [appliedCaseId, setAppliedCaseId] = useState("");
  if (selectedCase && selectedCase.id !== appliedCaseId) {
    setAppliedCaseId(selectedCase.id);
    setCaseStatus(selectedCase.status);
    setCaseReply("");
  }

  async function saveUniversity() {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/universities", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password,
      },
      body: JSON.stringify({
        id: selected.id,
        status,
        estimatedOpenDate: estimatedOpenDate || null,
        deadline: deadline || null,
        applicationFeeEuro: fee === "" ? null : Number(fee),
        notes,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage("Save failed.");
      return;
    }
    const json = (await res.json()) as { university: University };
    setDataset((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lastUpdated: new Date().toISOString().slice(0, 10),
        universities: prev.universities.map((u) =>
          u.id === json.university.id ? json.university : u,
        ),
      };
    });
    setMessage("University saved.");
  }

  async function saveApplication() {
    if (!selectedApp) return;
    setAppSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/applications", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password,
      },
      body: JSON.stringify({
        id: selectedApp.id,
        status: appStatus,
        staffNote: appNote,
      }),
    });
    setAppSaving(false);
    if (!res.ok) {
      setMessage("Application update failed.");
      return;
    }
    await loadApplications(password);
    setMessage("Application status updated. Student will see it in portal.");
  }

  async function saveCaseStatus() {
    if (!selectedCase) return;
    setCaseSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/consultancy", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password,
      },
      body: JSON.stringify({ id: selectedCase.id, status: caseStatus }),
    });
    setCaseSaving(false);
    if (!res.ok) {
      setMessage("Case status update failed.");
      return;
    }
    await loadCases(password);
    setMessage("Consultancy status saved.");
  }

  async function sendCaseReply() {
    if (!selectedCase || !caseReply.trim()) return;
    setCaseSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/consultancy", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password,
      },
      body: JSON.stringify({ id: selectedCase.id, reply: caseReply.trim() }),
    });
    setCaseSaving(false);
    if (!res.ok) {
      setMessage("Reply failed.");
      return;
    }
    setCaseReply("");
    await loadCases(password);
    setMessage("Staff reply posted.");
  }

  if (!authed) {
    return (
      <div className="site-shell py-16 max-w-lg">
        <p className="eyebrow">Team only</p>
        <h1 className="display mt-3 text-4xl">Admin panel</h1>
        <p className="mt-3 text-[var(--ink-soft)]">
          Universities, student applications, and consultancy cases.
        </p>
        <form
          className="mt-6 panel rounded-3xl p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const pwd = String(fd.get("password") || password);
            setPassword(pwd);
            void unlock(pwd);
          }}
        >
          <input
            className="input"
            type="password"
            name="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button type="submit" className="btn btn-sea">
            Unlock
          </button>
          {message && <p className="text-sm text-[var(--coral)]">{message}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="site-shell py-12 md:py-16">
      <p className="eyebrow">Team desk</p>
      <h1 className="display mt-3 text-4xl md:text-5xl">Admin</h1>
      <p className="mt-3 text-[var(--ink-soft)]">
        Status updates for applications are manual — you control each step after
        consultancy.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["universities", "Universities"],
            ["applications", "Applications"],
            ["consultancy", "Consultancy"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "btn btn-sea text-sm" : "btn btn-outline text-sm"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
        <a className="btn btn-outline text-sm" href="/admin/catalogue-review">Catalogue review</a>
        <Link className="btn btn-outline text-sm" href="/admin/crm">Student CRM</Link>
        <Link className="btn btn-outline text-sm" href="/admin/operations">Staff desk</Link>
        <Link className="btn btn-outline text-sm" href="/admin/communications">Communications</Link>
        <Link className="btn btn-outline text-sm" href="/admin/audit">Audit log</Link>
        <Link className="btn btn-outline text-sm" href="/admin/research">Programme research</Link>
      </div>

      {message ? (
        <p className="mt-4 text-sm font-semibold text-[var(--sea-deep)]">{message}</p>
      ) : null}

      {tab === "universities" ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="panel rounded-3xl p-5">
            <label className="eyebrow">University</label>
            <select
              className="select mt-2"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {dataset?.universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            {selected && (
              <div className="mt-4 text-sm text-[var(--ink-soft)] space-y-2">
                <div>
                  Portal:{" "}
                  <a
                    href={selected.admissionPortal}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[var(--sea-deep)]"
                  >
                    open
                  </a>
                </div>
                <div>{selected.programs.length} English programmes listed</div>
              </div>
            )}
          </div>

          <div className="panel rounded-3xl p-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="eyebrow">Status</span>
                <select
                  className="select mt-2"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AdmissionStatus)}
                >
                  <option value="open">Open</option>
                  <option value="soon">Opening soon</option>
                  <option value="closed">Closed</option>
                  <option value="tba">Check portal</option>
                </select>
              </label>
              <label className="block">
                <span className="eyebrow">Application fee (€)</span>
                <input
                  className="input mt-2"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder="0 for no fee"
                />
              </label>
              <label className="block">
                <span className="eyebrow">Estimated open date</span>
                <input
                  className="input mt-2"
                  value={estimatedOpenDate}
                  onChange={(e) => setEstimatedOpenDate(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="eyebrow">Deadline</span>
                <input
                  className="input mt-2"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </label>
            </div>
            <label className="block">
              <span className="eyebrow">Notes</span>
              <textarea
                className="textarea mt-2 min-h-28"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn-sea"
              disabled={saving}
              onClick={() => void saveUniversity()}
            >
              {saving ? "Saving…" : "Save university dates"}
            </button>
          </div>
        </div>
      ) : null}

      {tab === "applications" ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="panel rounded-3xl p-5 space-y-3">
            <div className="eyebrow">Student applications ({applications.length})</div>
            <select
              className="select"
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
            >
              {applications.length === 0 ? (
                <option value="">No requests yet</option>
              ) : (
                applications.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.studentName} · {a.universityName} · {a.status}
                  </option>
                ))
              )}
            </select>
            {selectedApp ? (
              <div className="text-sm text-[var(--ink-soft)] space-y-1">
                <div>
                  {selectedApp.studentEmail}
                  {selectedApp.studentPhone ? ` · ${selectedApp.studentPhone}` : ""}
                </div>
                <div>{selectedApp.programName}</div>
                <div>
                  Portal:{" "}
                  <a
                    href={selectedApp.portalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[var(--sea-deep)]"
                  >
                    open
                  </a>
                </div>
                <div className="pt-2">
                  Docs in vault:{" "}
                  {selectedApp.documents.length
                    ? selectedApp.documents
                        .map((d) => `${d.kind}:${d.originalName}`)
                        .join(" · ")
                    : "none"}
                </div>
              </div>
            ) : null}
          </div>

          <div className="panel rounded-3xl p-6 space-y-4">
            <label className="block">
              <span className="eyebrow">Status (you update manually)</span>
              <select
                className="select mt-2"
                value={appStatus}
                onChange={(e) => setAppStatus(e.target.value as ApplicationStatus)}
                disabled={!selectedApp}
              >
                {appStatuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="eyebrow">Note visible to student</span>
              <textarea
                className="textarea mt-2 min-h-28"
                value={appNote}
                onChange={(e) => setAppNote(e.target.value)}
                disabled={!selectedApp}
                placeholder="e.g. Submitted on GOMP today. Waiting evaluation."
              />
            </label>
            <button
              type="button"
              className="btn btn-sea"
              disabled={!selectedApp || appSaving}
              onClick={() => void saveApplication()}
            >
              {appSaving ? "Saving…" : "Update application status"}
            </button>
          </div>
        </div>
      ) : null}

      {tab === "consultancy" ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="panel rounded-3xl p-5 space-y-3">
            <div className="eyebrow">Cases ({cases.length})</div>
            <select
              className="select"
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
            >
              {cases.length === 0 ? (
                <option value="">No cases yet</option>
              ) : (
                cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.studentName} · {c.topic} · {c.status}
                  </option>
                ))
              )}
            </select>
            {selectedCase ? (
              <div className="text-sm space-y-2">
                <div className="text-[var(--ink-soft)]">{selectedCase.studentEmail}</div>
                <p>{selectedCase.message}</p>
                <div className="space-y-2 pt-2">
                  {selectedCase.replies.map((r, i) => (
                    <div
                      key={`${r.at}-${i}`}
                      className="rounded-xl border border-[var(--line)] px-3 py-2"
                    >
                      <div className="text-xs font-bold uppercase text-[var(--ink-soft)]">
                        {r.from} · {r.at.slice(0, 16).replace("T", " ")}
                      </div>
                      <div className="mt-1">{r.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="panel rounded-3xl p-6 space-y-4">
            <label className="block">
              <span className="eyebrow">Case status</span>
              <select
                className="select mt-2"
                value={caseStatus}
                onChange={(e) => setCaseStatus(e.target.value as ConsultancyStatus)}
                disabled={!selectedCase}
              >
                <option value="open">Open (unlocks apply hub)</option>
                <option value="in_progress">In progress</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <button
              type="button"
              className="btn btn-outline"
              disabled={!selectedCase || caseSaving}
              onClick={() => void saveCaseStatus()}
            >
              Save case status
            </button>
            <label className="block">
              <span className="eyebrow">Staff reply</span>
              <textarea
                className="textarea mt-2 min-h-28"
                value={caseReply}
                onChange={(e) => setCaseReply(e.target.value)}
                disabled={!selectedCase}
                placeholder="Reply visible in student portal…"
              />
            </label>
            <button
              type="button"
              className="btn btn-sea"
              disabled={!selectedCase || caseSaving || !caseReply.trim()}
              onClick={() => void sendCaseReply()}
            >
              {caseSaving ? "Sending…" : "Post staff reply"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
