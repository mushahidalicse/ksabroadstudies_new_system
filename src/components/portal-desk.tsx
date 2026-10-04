"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  Compass,
  CreditCard,
  FileCheck,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import {
  CURRENT_EDUCATION,
  shortlistReady,
  type DocumentKind,
  type PublicStudent,
} from "@/lib/student-types";
import type { MatchRow, ProfileAnalysis, ScholarshipHint } from "@/lib/match-student";
import type { ApplicationStatus } from "@/lib/application-types";
import { ConsultancyPanel } from "@/components/consultancy-panel";
import { DocumentTracker } from "@/components/DocumentTracker";
import { IeltsMoiFilter } from "@/components/IeltsMoiFilter";
import { ScholarshipEstimator } from "@/components/ScholarshipEstimator";
import { englishBand, type EnglishFilter } from "@/lib/english-band";
import { DocumentVault } from "@/components/document-vault";
import { ApplyHub } from "@/components/apply-hub";
import { PortalShortlist } from "@/components/portal-shortlist";
import { PortalDecisionTools } from "@/components/portal-decision-tools";
import { programTrack } from "@/lib/document-vault";
import { SITE } from "@/lib/site";
import { regionLabel } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import type { AdmissionStatus } from "@/lib/types";

type Payload = {
  student: PublicStudent;
  analysis: ProfileAnalysis;
  matches: MatchRow[];
  scholarships?: ScholarshipHint[];
};

const STEP_KEY = "ks-portal-step";
const CACHE_KEY = "ks-portal-cache";

const STEPS = [
  { id: 1, label: "Identity and studies", icon: GraduationCap },
  { id: 2, label: "Document vault", icon: FileCheck },
  { id: 3, label: "Matches", icon: Sparkles },
  { id: 4, label: "Services", icon: Briefcase },
  { id: 5, label: "Payment", icon: CreditCard },
  { id: 6, label: "Visa desk", icon: Compass },
] as const;

const FIELD_OPTIONS = [
  "Computer Science",
  "Engineering",
  "Economics",
  "Business",
  "Medicine",
  "Data Science",
];

const SERVICES = [
  {
    id: "one-to-one",
    type: "one-to-one" as const,
    kicker: "Counselling",
    title: "1-to-1 Profile Evaluation & Shortlist Discussion",
    detail: "A private session to settle the shortlist, scholarship window, and English proof.",
  },
  {
    id: "cimea",
    type: "private-case" as const,
    kicker: "Documents",
    title: "Document Verification & CIMEA Review",
    detail: "We check the vault and the CIMEA statement path before filing.",
  },
  {
    id: "admission",
    type: "private-case" as const,
    kicker: "Admission",
    title: "Complete Assisted Admission & Universitaly Pre-enrolment",
    detail: "University filing and the Universitaly pre-enrolment step.",
  },
  {
    id: "visa-desk",
    type: "private-case" as const,
    kicker: "Visa",
    title: "Embassy Visa File Preparation (FBR Tax, Health Insurance, Flight, Hotel)",
    detail: "FBR tax returns, health insurance, hotel booking, and the flight ticket for the embassy file.",
  },
];

const SHORTLIST_KEY = "ks-portal-shortlist";

function phoneOk(value: string) {
  const compact = value.replace(/[\s()-]/g, "");
  return /^(\+?92|\+?39|03)\d{8,12}$/.test(compact);
}

function fitBand(score: number) {
  if (score >= 80) return "Strong Match";
  if (score >= 60) return "Target";
  return "Reach";
}

function readCache(): Payload | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Payload;
    return parsed?.student?.id ? parsed : null;
  } catch {
    return null;
  }
}

function readStep() {
  const value = Number(localStorage.getItem(STEP_KEY));
  return value >= 1 && value <= 6 ? value : 1;
}

export function PortalDesk() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [step, setStep] = useState(1);
  const [ready, setReady] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [authNote, setAuthNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [hasCase, setHasCase] = useState(false);
  const [englishFilter, setEnglishFilter] = useState<EnglishFilter>("all");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [services, setServices] = useState(SERVICES);
  const [reviews, setReviews] = useState<Record<string, string>>({});
  const [unreadNotes, setUnreadNotes] = useState(0);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [payChannel, setPayChannel] = useState("easypaisa");
  const [appStatuses, setAppStatuses] = useState<ApplicationStatus[]>([]);

  const noteCases = useCallback((count: number) => {
    setHasCase(count > 0);
  }, []);

  function remember(next: Payload | null) {
    setData(next);
    try {
      if (next) sessionStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch {
      /* cache is optional */
    }
  }

  function go(next: number) {
    setStep(next);
    setMessage("");
    setError("");
    try {
      localStorage.setItem(STEP_KEY, String(next));
    } catch {
      /* ignore */
    }
  }

  function noteAuth(status: number) {
    if (status !== 401) return false;
    setAuthNote("Your session is not active. Log in again. This page will keep the step you were on.");
    return true;
  }

  useEffect(() => {
    // After mount only, so stored step and cache do not change the server HTML.
    /* eslint-disable react-hooks/set-state-in-effect */
    const cached = readCache();
    if (cached) setData(cached);
    setStep(readStep());
    try {
      const saved = JSON.parse(localStorage.getItem(SHORTLIST_KEY) || "[]") as unknown;
      if (Array.isArray(saved)) {
        setShortlist(saved.filter((item): item is string => typeof item === "string"));
      }
    } catch {
      /* ignore */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    let cancelled = false;
    fetch("/api/portal/profile", { credentials: "same-origin" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          setSignedOut(!cached);
          setAuthNote(
            cached
              ? "The server did not accept this session. Your last view is still on screen. Log in again before saving."
              : "",
          );
          setReady(true);
          return;
        }
        const json = (await res.json()) as Payload & { error?: string };
        if (!res.ok || !json.student) {
          setError(json.error || "Could not load portal.");
          setReady(true);
          return;
        }
        remember(json);
        setSignedOut(false);
        setAuthNote("");
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load portal.");
        setReady(true);
      });
    fetch("/api/consultancy", { credentials: "same-origin" })
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const json = (await res.json()) as { cases?: unknown[] };
        setHasCase((json.cases?.length ?? 0) > 0);
      })
      .catch(() => undefined);
    fetch("/api/portal/services")
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const json = (await res.json()) as { services?: typeof SERVICES };
        if (json.services && json.services.length > 0) setServices(json.services);
      })
      .catch(() => undefined);
    fetch("/api/portal/notifications", { credentials: "same-origin" })
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const json = (await res.json()) as { unread?: number };
        setUnreadNotes(json.unread ?? 0);
      })
      .catch(() => undefined);
    fetch("/api/portal/document-reviews", { credentials: "same-origin" })
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const json = (await res.json()) as { reviews?: { documentId: string; status: string }[] };
        const next: Record<string, string> = {};
        for (const review of json.reviews ?? []) next[review.documentId] = review.status;
        setReviews(next);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (step !== 6) return;
    let cancelled = false;
    fetch("/api/portal/applications", { credentials: "same-origin" })
      .then(async (res) => {
        if (cancelled || res.status === 401) {
          if (!cancelled && res.status === 401) noteAuth(401);
          return;
        }
        if (!res.ok) return;
        const json = (await res.json()) as { applications?: Array<{ status: ApplicationStatus }> };
        setAppStatuses((json.applications ?? []).map((row) => row.status));
      })
      .catch(() => setAppStatuses([]));
    return () => {
      cancelled = true;
    };
  }, [step]);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    const form = new FormData(e.currentTarget);
    const phone = String(form.get("phone") || "");
    if (phone && !phoneOk(phone)) {
      setSaving(false);
      setError("WhatsApp must start with +92, 03, or +39.");
      return;
    }
    const body = {
      name: String(form.get("name") || ""),
      surname: String(form.get("surname") || ""),
      dateOfBirth: String(form.get("dateOfBirth") || ""),
      placeOfBirth: String(form.get("placeOfBirth") || ""),
      passportOrCnic: String(form.get("passportOrCnic") || ""),
      phone: String(form.get("phone") || ""),
      currentCity: String(form.get("currentCity") || ""),
      address: String(form.get("address") || ""),
      studyLevel: String(form.get("studyLevel") || ""),
      field: String(form.get("field") || ""),
      cgpa: String(form.get("cgpa") || ""),
      englishProof: String(form.get("englishProof") || ""),
      cityPreference: String(form.get("cityPreference") || ""),
      regionPreference: String(form.get("regionPreference") || ""),
      intake: String(form.get("intake") || ""),
      notes: String(form.get("notes") || ""),
      nationality: String(form.get("nationality") || ""),
      countryOfEducation: String(form.get("countryOfEducation") || ""),
      countryOfResidence: String(form.get("countryOfResidence") || ""),
      degreeTitle: String(form.get("degreeTitle") || ""),
      targetStudyLevel: String(form.get("targetStudyLevel") || ""),
      specialization: String(form.get("specialization") || ""),
      institution: String(form.get("institution") || ""),
      graduationYear: String(form.get("graduationYear") || ""),
      gradeSystem: String(form.get("gradeSystem") || ""),
      cgpaScale: String(form.get("cgpaScale") || ""),
      percentage: String(form.get("percentage") || ""),
      englishScore: String(form.get("englishScore") || ""),
      moiAvailable: String(form.get("moiAvailable") || ""),
      preferredFields: String(form.get("preferredFields") || ""),
      maxApplicationFeeEuro: String(form.get("maxApplicationFeeEuro") || ""),
      annualBudgetEuro: String(form.get("annualBudgetEuro") || ""),
      scholarshipInterest: String(form.get("scholarshipInterest") || ""),
      willingToTakeTest: String(form.get("willingToTakeTest") || ""),
    };
    try {
      const res = await fetch("/api/portal/profile", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (noteAuth(res.status)) return;
      const json = (await res.json()) as Payload & { error?: string };
      if (!res.ok || !json.student) throw new Error(json.error || "Could not save.");
      remember(json);
      const complete = shortlistReady(json.student.profile);
      setMessage(
        complete
          ? "Profile saved. The shortlist is ready on Matches."
          : "Profile saved. Matches stays off until study level, field, CGPA, and English proof are filled.",
      );
      go(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function reanalyze() {
    if (!data || !shortlistReady(data.student.profile)) return;
    setAnalyzing(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/portal/profile", { credentials: "same-origin" });
      if (noteAuth(res.status)) return;
      const json = (await res.json()) as Payload & { error?: string };
      if (!res.ok || !json.student) throw new Error(json.error || "Analysis failed.");
      remember(json);
      setMessage(
        `Shortlist ready. ${json.matches.length} programmes from ${json.analysis.catalogueScanned} catalogue entries.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function uploadFile(kind: DocumentKind, file: File) {
    setUploading(true);
    setError("");
    setMessage("");
    const body = new FormData();
    body.set("kind", kind);
    body.set("file", file);
    try {
      const res = await fetch("/api/portal/documents", {
        method: "POST",
        credentials: "same-origin",
        body,
      });
      if (noteAuth(res.status)) return;
      const json = (await res.json()) as { student?: PublicStudent; error?: string };
      if (!res.ok || !json.student) throw new Error(json.error || "Upload failed.");
      setData((prev) => {
        if (!prev) return prev;
        const next = { ...prev, student: json.student! };
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      setMessage("Saved in your vault.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function removeDoc(id: string) {
    setError("");
    const res = await fetch("/api/portal/documents", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (noteAuth(res.status)) return;
    const json = (await res.json()) as { student?: PublicStudent; error?: string };
    if (!res.ok || !json.student) {
      setError(json.error || "Could not delete.");
      return;
    }
    setData((prev) => {
      if (!prev) return prev;
      const next = { ...prev, student: json.student! };
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (!ready && !data) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-14 rounded-2xl bg-[var(--line)]/40" />
        <div className="panel h-48 rounded-3xl" />
        <div className="panel h-32 rounded-3xl" />
      </div>
    );
  }

  if (signedOut || !data) {
    return (
      <div className="panel rounded-3xl p-6 md:p-8 space-y-3">
        <p className="eyebrow">Student portal</p>
        <h2 className="display text-3xl">Log in to open your desk</h2>
        <p className="text-sm text-[var(--ink-soft)]">
          {error || "This browser does not have an active student session."}
        </p>
        <Link href="/login" className="btn btn-sea w-fit">
          Log in
        </Link>
      </div>
    );
  }

  const { student, matches, analysis, scholarships = [] } = data;
  const p = student.profile;
  const canMatch = shortlistReady(p);
  const paid = student.documents.some((doc) => doc.kind === "payment-proof");
  const preEnrolled = appStatuses.some((status) =>
    ["pre_admitted", "universitaly", "visa", "enrolled"].includes(status),
  );

  function unlocked(id: number) {
    if (id === 5) return hasCase;
    if (id === 3) return canMatch;
    return true;
  }

  return (
    <div className="space-y-6">
      <PortalShortlist />
      <PortalDecisionTools profile={student.profile} onProfile={() => go(1)} />
      <div className="flex justify-end">
        <Link href="/portal/notifications" className="btn btn-outline text-sm">
          Notifications{unreadNotes ? ` (${unreadNotes})` : ""}
        </Link>
      </div>
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Portal steps">
        {STEPS.map((item) => {
          const open = unlocked(item.id);
          const current = step === item.id;
          const done = step > item.id && open;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              disabled={!open}
              onClick={() => go(item.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-wide ${
                current
                  ? "bg-[var(--sea-deep)] text-white"
                  : open
                    ? "border border-[var(--line)] text-[var(--ink)]"
                    : "border border-[var(--line)] text-[var(--ink-soft)] opacity-50"
              }`}
            >
              {done ? <CheckCircle2 size={14} /> : <Icon size={14} />}
              {item.id}. {item.label}
            </button>
          );
        })}
      </nav>

      {authNote ? (
        <p className="rounded-2xl border border-[var(--coral)]/40 px-4 py-3 text-sm font-semibold text-[var(--coral)]">
          {authNote}{" "}
          <Link href="/login" className="underline">
            Log in
          </Link>
        </p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-[var(--coral)]">{error}</p> : null}
      {message ? <p className="text-sm font-semibold text-[var(--sea-deep)]">{message}</p> : null}

      {step === 1 ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <form key={student.id} onSubmit={saveProfile} className="panel rounded-3xl p-6 md:p-8 space-y-4 lg:col-span-2">
            <div>
              <p className="eyebrow">Step 1 · Identity and studies</p>
              <h2 className="display mt-2 text-3xl">Student record</h2>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">
                Intermediate opens the bachelor&apos;s file. Bachelors, BSc, B.Com, MBBS, DPT, and BDS open the master&apos;s file. Masters and PhD open the PhD file.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="input" name="name" defaultValue={student.name} required placeholder="Name" />
              <input className="input" name="surname" defaultValue={student.surname} required placeholder="Surname" />
              <input className="input" name="dateOfBirth" defaultValue={student.dateOfBirth} placeholder="Date of birth" />
              <input className="input" name="placeOfBirth" defaultValue={student.placeOfBirth} placeholder="Place of birth" />
              <input className="input" name="passportOrCnic" defaultValue={student.passportOrCnic} placeholder="Passport / CNIC" />
              <input className="input" name="phone" defaultValue={student.phone} placeholder="WhatsApp (+92 or +39)" />
              <input className="input" name="currentCity" defaultValue={student.currentCity} placeholder="Current city" />
              <input className="input" name="address" defaultValue={student.address} placeholder="Address" />
              <select className="select" name="studyLevel" defaultValue={p.studyLevel} required>
                <option value="">Current education *</option>
                {CURRENT_EDUCATION.map((level) => (
                  <option key={level.id} value={level.id}>{level.label}</option>
                ))}
              </select>
              <input className="input" name="field" defaultValue={p.field} list="portal-fields" placeholder="Target field *" />
              <datalist id="portal-fields">
                {FIELD_OPTIONS.map((field) => (
                  <option key={field} value={field} />
                ))}
              </datalist>
              <input className="input" name="cgpa" defaultValue={p.cgpa} placeholder="CGPA or percentage *" />
              <select className="select" name="englishProof" defaultValue={p.englishProof || ""} aria-label="English proof">
                <option value="">English proof *</option>
                <option value="IELTS">IELTS</option>
                <option value="TOEFL">TOEFL</option>
                <option value="MOI">Medium of instruction (MOI)</option>
                <option value="Cambridge">Cambridge</option>
                <option value="Duolingo">Duolingo</option>
                <option value="Other">Other</option>
                <option value="None">None</option>
                {p.englishProof && !["MOI", "IELTS", "TOEFL", "Duolingo", "Cambridge", "Other", "None", ""].includes(p.englishProof) ? (
                  <option value={p.englishProof}>{p.englishProof}</option>
                ) : null}
              </select>
              <input className="input" name="cityPreference" defaultValue={p.cityPreference} placeholder="Preferred Italian city" />
              <input className="input sm:col-span-2" name="intake" defaultValue={p.intake} placeholder="Target intake (e.g. 2026/27)" />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ["", "Any"],
                ["lazio", "Lazio"],
                ["north", "North"],
                ["centre", "Centre"],
                ["south", "South"],
              ].map(([value, label]) => (
                <label key={value} className="cursor-pointer">
                  <input className="peer sr-only" type="radio" name="regionPreference" value={value} defaultChecked={p.regionPreference === value} />
                  <span className="inline-block rounded-full border border-[var(--line)] px-3 py-2 text-xs font-bold uppercase tracking-wide peer-checked:bg-[var(--sea-deep)] peer-checked:text-white">
                    {label}
                  </span>
                </label>
              ))}
            </div>
            <details className="rounded-2xl border border-[var(--line)] p-4">
              <summary className="cursor-pointer text-sm font-bold">Optional matching details</summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">Nationality<input className="input" name="nationality" defaultValue={p.nationality} /></label>
                <label className="grid gap-1 text-sm font-semibold">Country of education<input className="input" name="countryOfEducation" defaultValue={p.countryOfEducation} /></label>
                <label className="grid gap-1 text-sm font-semibold">Country of residence<input className="input" name="countryOfResidence" defaultValue={p.countryOfResidence} /></label>
                <label className="grid gap-1 text-sm font-semibold">Degree title<input className="input" name="degreeTitle" defaultValue={p.degreeTitle} /></label>
                <label className="grid gap-1 text-sm font-semibold">Institution<input className="input" name="institution" defaultValue={p.institution} /></label>
                <label className="grid gap-1 text-sm font-semibold">Graduation year<input className="input" name="graduationYear" defaultValue={p.graduationYear} /></label>
                <label className="grid gap-1 text-sm font-semibold">Specialization<input className="input" name="specialization" defaultValue={p.specialization} /></label>
                <label className="grid gap-1 text-sm font-semibold">Other preferred fields<input className="input" name="preferredFields" defaultValue={p.preferredFields} /></label>
                <label className="grid gap-1 text-sm font-semibold">
                  Target study level
                  <select className="select" name="targetStudyLevel" defaultValue={p.targetStudyLevel}>
                    <option value="">Use the usual next level</option>
                    <option value="bachelor">Bachelor&apos;s</option>
                    <option value="master">Master&apos;s</option>
                    <option value="phd">PhD</option>
                    <option value="single-cycle">Single-cycle medicine</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Grade system
                  <select className="select" name="gradeSystem" defaultValue={p.gradeSystem}>
                    <option value="">Not specified</option>
                    <option value="cgpa">CGPA</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">CGPA scale<input className="input" name="cgpaScale" defaultValue={p.cgpaScale} placeholder="4 or 5 or 10" /></label>
                <label className="grid gap-1 text-sm font-semibold">Percentage<input className="input" name="percentage" defaultValue={p.percentage} /></label>
                <label className="grid gap-1 text-sm font-semibold">English score<input className="input" name="englishScore" defaultValue={p.englishScore} /></label>
                <label className="grid gap-1 text-sm font-semibold">
                  MOI letter available
                  <select className="select" name="moiAvailable" defaultValue={p.moiAvailable}>
                    <option value="">Not specified</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">Maximum application fee (EUR)<input className="input" name="maxApplicationFeeEuro" inputMode="decimal" defaultValue={p.maxApplicationFeeEuro} /></label>
                <label className="grid gap-1 text-sm font-semibold">Approximate yearly budget (EUR)<input className="input" name="annualBudgetEuro" inputMode="decimal" defaultValue={p.annualBudgetEuro} /></label>
                <label className="grid gap-1 text-sm font-semibold">
                  Scholarship interest
                  <select className="select" name="scholarshipInterest" defaultValue={p.scholarshipInterest}>
                    <option value="">Not specified</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Willing to take an admission test
                  <select className="select" name="willingToTakeTest" defaultValue={p.willingToTakeTest}>
                    <option value="">Not specified</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
              </div>
            </details>
            <textarea className="textarea min-h-24" name="notes" defaultValue={p.notes} aria-label="Notes" placeholder="Goals, budget, test plans (CEnT-S / IMAT)" />
            <button className="btn btn-sea" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save & Proceed to Documents ->"}
            </button>
          </form>
          <aside className="panel h-fit rounded-3xl p-6 space-y-3">
            <p className="eyebrow">Before the shortlist</p>
            <h2 className="display text-2xl">Four fields</h2>
            <ul className="space-y-2 text-sm">
              <li>{p.studyLevel ? "Education is set." : "Choose current education."}</li>
              <li>{p.field.trim() ? `Field: ${p.field.trim()}.` : "Add a target field."}</li>
              <li>{p.cgpa.trim() ? `Result: ${p.cgpa.trim()}.` : "Add CGPA or percentage."}</li>
              <li>{p.englishProof.trim() ? `English: ${p.englishProof.trim()}.` : "Choose MOI, IELTS, or TOEFL."}</li>
            </ul>
            <p className="text-sm text-[var(--ink-soft)]">
              Scholarship amounts and tuition stay on the university and regional agency pages. This desk does not invent those figures.
            </p>
          </aside>

          <PrivacyControls
            student={student}
            onStudent={(next) => remember({ ...data, student: next })}
            onError={setError}
            onMessage={setMessage}
            onDeleted={() => {
              sessionStorage.removeItem(CACHE_KEY);
              localStorage.removeItem(STEP_KEY);
              router.push("/");
              router.refresh();
            }}
          />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <DocumentTracker />
          <DocumentVault
            student={student}
            uploading={uploading}
            onUpload={uploadFile}
            onRemove={removeDoc}
            reviews={reviews}
          />
          <div className="flex justify-end">
            <button
              type="button"
              className="btn btn-sea"
              onClick={() => {
                if (!canMatch) {
                  setError("Fill study level, field, CGPA, and English proof before the shortlist.");
                  go(1);
                  return;
                }
                setError("");
                go(3);
              }}
            >
              Generate AI University Shortlist -&gt;
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-6">
          {!canMatch ? (
            <section className="panel rounded-3xl p-6 md:p-8 space-y-3">
              <p className="eyebrow">Step 3 · Matches</p>
              <h2 className="display text-3xl">Shortlist is waiting</h2>
              <p className="text-sm text-[var(--ink-soft)]">
                Fill study level, target field, CGPA, and English proof (MOI or IELTS) on Profile, then come back. The catalogue is not scanned before that.
              </p>
              <button type="button" className="btn btn-outline" onClick={() => go(1)}>
                Back to profile
              </button>
            </section>
          ) : (
            <>
              <section className="panel rounded-3xl p-6 md:p-8 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">Step 3 · Matches</p>
                    <h2 className="display mt-2 text-3xl">{analysis.headline}</h2>
                    <p className="mt-2 text-sm text-[var(--ink-soft)]">{analysis.summary}</p>
                  </div>
                  <button type="button" className="btn btn-sea" disabled={analyzing} onClick={() => void reanalyze()}>
                    {analyzing ? "Scanning catalogue…" : "Refresh shortlist"}
                  </button>
                  <Link href="/portal/matches" className="btn btn-outline">
                    View explainable matches
                  </Link>
                </div>
              </section>
              <section className="panel rounded-3xl p-6 md:p-8 space-y-4">
                <h2 className="display text-3xl">Programmes and universities</h2>
                <IeltsMoiFilter value={englishFilter} onFilterChange={setEnglishFilter} />
                {matches.length === 0 ? (
                  <p className="text-sm text-[var(--ink-soft)]">Refresh the shortlist to rank the top 10.</p>
                ) : (
                  <ol className="grid gap-3">
                    {matches
                      .filter((row) => englishFilter === "all" || englishBand(row.englishRequirement) === englishFilter)
                      .map((row) => {
                      const band = englishBand(row.englishRequirement);
                      const key = `${row.href}|${row.title}`;
                      const saved = shortlist.includes(key);
                      const grant =
                        row.region && scholarships.find((item) =>
                          item.subtitle.toLowerCase().includes(regionLabel(row.region || "").toLowerCase()),
                        );
                      return (
                        <li key={key} className="rounded-2xl border border-[var(--line)] px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">
                              {row.university || row.subtitle}
                              {row.region ? ` · ${regionLabel(row.region)}` : ""}
                            </span>
                            <span className="ml-auto text-xs font-bold uppercase tracking-wide text-[var(--sea-deep)]">
                              {fitBand(row.fitScore)} · {row.fitScore}%
                            </span>
                          </div>
                          <Link href={row.href} className="display mt-2 block text-xl">
                            {row.title}
                          </Link>
                          <p className="mt-1 text-sm text-[var(--ink-soft)]">{row.subtitle}</p>
                          {grant ? (
                            <p className="mt-3 text-xs font-semibold text-[var(--sea-deep)]">
                              Regional window: {grant.title}
                            </p>
                          ) : null}
                          {band === "moi" ? (
                            <p className="mt-2 text-xs font-semibold text-[var(--olive)]">Accepts an English MOI letter</p>
                          ) : null}
                          {band === "ielts" ? (
                            <p className="mt-2 text-xs font-semibold text-[var(--ink-soft)]">IELTS / TOEFL required</p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {row.status ? <StatusBadge status={row.status as AdmissionStatus} /> : null}
                            <button
                              type="button"
                              className={`btn text-sm ${saved ? "btn-sea" : "btn-outline"}`}
                              onClick={() => {
                                const next = saved
                                  ? shortlist.filter((item) => item !== key)
                                  : [...shortlist, key];
                                setShortlist(next);
                                localStorage.setItem(SHORTLIST_KEY, JSON.stringify(next));
                                const universityId = row.href.startsWith("/universities/")
                                  ? row.href.slice("/universities/".length)
                                  : "";
                                if (!saved && hasCase && universityId) {
                                  const track = programTrack(p.studyLevel);
                                  void fetch("/api/portal/applications", {
                                    method: "POST",
                                    credentials: "same-origin",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      universityId,
                                      programName: row.title,
                                      level: track === "bachelor" || track === "master" || track === "phd" ? track : "",
                                    }),
                                  }).then((response) => {
                                    if (response.ok) setMessage(`${row.title} added to your application file.`);
                                  });
                                } else if (!saved) {
                                  setMessage("Saved on this shortlist. It files after a consultancy case is open.");
                                }
                              }}
                            >
                              {saved ? "In my application file" : "Add to My Application File"}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
                <div className="border-t border-[var(--line)] pt-4 space-y-3">
                  <h3 className="display text-2xl">Scholarship windows</h3>
                  {scholarships.length === 0 ? (
                    <p className="text-sm text-[var(--ink-soft)]">Save a preferred region to narrow the regional scholarships.</p>
                  ) : (
                    <ul className="grid gap-2">
                      {scholarships.map((item) => (
                        <li key={item.id}>
                          <Link href={item.href} className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-3">
                            <span className="font-semibold">{item.title}</span>
                            <StatusBadge status={item.status} />
                            <span className="text-sm text-[var(--ink-soft)]">{item.subtitle}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex justify-end">
                  <button type="button" className="btn btn-sea" onClick={() => go(4)}>
                    Proceed to Consultancy Services -&gt;
                  </button>
                </div>
              </section>
              <ScholarshipEstimator />
            </>
          )}
        </div>
      ) : null}

      {step === 4 ? (
        <div id="consultancy" className="space-y-6">
          <section className="panel rounded-3xl p-6 md:p-8 space-y-4">
            <p className="eyebrow">Step 4 · Services</p>
            <h2 className="display text-3xl">Open a case</h2>
            <p className="text-sm text-[var(--ink-soft)]">
              The shortlist is free. Choose a service to open the payment step. Account numbers stay on WhatsApp.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {services.map((service) => {
                const on = selectedServices.includes(service.id);
                return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() =>
                    setSelectedServices((current) =>
                      current.includes(service.id)
                        ? current.filter((id) => id !== service.id)
                        : [...current, service.id],
                    )
                  }
                  className={`rounded-2xl border p-4 text-left ${
                    on
                      ? "border-[var(--sea-deep)] bg-[var(--foam)]"
                      : "border-[var(--line)]"
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-wide text-[var(--sea-deep)]">{service.kicker}</div>
                  <div className="mt-2 font-semibold">{service.title}</div>
                  <p className="mt-2 text-sm text-[var(--ink-soft)]">{service.detail}</p>
                </button>
                );
              })}
            </div>
            <button
              type="button"
              className="btn btn-sea"
              disabled={saving}
              onClick={() => {
                const chosen = services.filter((item) => selectedServices.includes(item.id));
                void (async () => {
                  if (!chosen.length) {
                    setError("Choose at least one service.");
                    return;
                  }
                  setSaving(true);
                  setError("");
                  for (const service of chosen) {
                    const response = await fetch("/api/consultancy", {
                      method: "POST",
                      credentials: "same-origin",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        type: service.type,
                        topic: service.title,
                        message: service.detail,
                      }),
                    });
                    if (response.status === 401) {
                      setSaving(false);
                      setAuthNote("Log in again to open this case. Your screen stays here.");
                      return;
                    }
                    if (!response.ok) {
                      setSaving(false);
                      setError("Could not open the case.");
                      return;
                    }
                  }
                  setSaving(false);
                  setHasCase(true);
                  setMessage("Case opened. Payment step is unlocked.");
                  go(5);
                })();
              }}
            >
              {saving ? "Opening…" : "Open case and continue"}
            </button>
          </section>
          <ConsultancyPanel onCases={noteCases} />
        </div>
      ) : null}

      {step === 5 ? (
        hasCase ? (
          <section className="panel rounded-3xl p-6 md:p-8 space-y-4">
            <p className="eyebrow">Step 5 · Payment</p>
            <h2 className="display text-3xl">First installment</h2>
            <p className="text-sm text-[var(--ink-soft)]">
              Pay after the discussion. KS Abroad sends the Easypaisa, JazzCash, Sadapay, bank, or Raast details on WhatsApp. Upload the screenshot here.
            </p>
            <div className="grid gap-2 sm:grid-cols-3 text-sm">
              {[
                ["easypaisa", "Easypaisa", "Mobile account"],
                ["jazzcash", "JazzCash", "Mobile account"],
                ["sadapay", "SadaPay", "Wallet"],
                ["bank", "Bank account", "Local transfer"],
                ["raast", "Raast ID", "Instant transfer"],
              ].map(([id, name, detail]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPayChannel(id)}
                  className={`rounded-2xl border px-4 py-3 text-left ${
                    payChannel === id ? "border-[var(--sea-deep)] bg-[var(--foam)]" : "border-[var(--line)]"
                  }`}
                >
                  <div className="font-semibold">{name}</div>
                  <div className="text-[var(--ink-soft)]">{detail}</div>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <a className="btn btn-sea" href={SITE.whatsappUrl} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
              <label className="btn btn-outline cursor-pointer">
                {uploading ? "Uploading…" : "Upload Payment Screenshot / Transaction ID"}
                <input
                  className="sr-only"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void uploadFile("payment-proof", file);
                  }}
                />
              </label>
            </div>
            <p className="text-sm font-semibold text-[var(--sea-deep)]">
              {paid
                ? "Payment proof is in the vault. The tracker status line is on."
                : "The tracker status line stays off until this proof is uploaded."}
            </p>
            <button
              type="button"
              className="btn btn-sea"
              disabled={!paid}
              onClick={() => {
                if (!paid) {
                  setError("Upload the payment screenshot before opening the tracker.");
                  return;
                }
                go(6);
              }}
            >
              Submit Proof & Open Case
            </button>
          </section>
        ) : (
          <section className="panel rounded-3xl p-6 md:p-8 space-y-3">
            <p className="eyebrow">Step 5 · Payment</p>
            <h2 className="display text-3xl">Choose a service first</h2>
            <p className="text-sm text-[var(--ink-soft)]">
              Payment opens after you book a 1-to-1 session, a document review, or a visa-file case.
            </p>
            <button type="button" className="btn btn-outline" onClick={() => go(4)}>
              Go to services
            </button>
          </section>
        )
      ) : null}

      {step === 6 ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Stage 5",
                on: appStatuses.some((status) =>
                  ["submitted", "pre_admitted", "universitaly", "visa", "enrolled"].includes(status),
                ),
                detail: "University application submitted and admission status",
              },
              {
                label: "Stage 6",
                on: appStatuses.some((status) =>
                  ["pre_admitted", "universitaly", "visa", "enrolled"].includes(status),
                ),
                detail: "Universitaly pre-enrolment and CIMEA statement",
              },
              {
                label: "Stage 7",
                on: preEnrolled,
                detail: "Embassy visa vault: tax returns, tickets, insurance, accommodation",
              },
              {
                label: "Stage 8",
                on: appStatuses.some((status) => ["visa", "enrolled", "rejected"].includes(status)),
                detail: "Visa appointment, interview, and stamp outcome",
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded-2xl border p-4 ${
                  item.on ? "border-[var(--sea-deep)]" : "border-[var(--line)]"
                }`}
              >
                <div className="text-xs font-bold uppercase tracking-wide text-[var(--sea-deep)]">{item.label}</div>
                <p className="mt-2 text-sm font-semibold">{item.on ? "Recorded" : "Waiting"}</p>
                <p className="mt-1 text-xs text-[var(--ink-soft)]">{item.detail}</p>
              </div>
            ))}
          </div>
          <ApplyHub statusEnabled={paid} />
          {preEnrolled ? (
            <DocumentVault
              mode="visa"
              student={student}
              uploading={uploading}
              onUpload={uploadFile}
              onRemove={removeDoc}
              reviews={reviews}
            />
          ) : (
            <section className="panel rounded-3xl p-6 md:p-8">
              <p className="eyebrow">Visa file</p>
              <h2 className="display mt-2 text-3xl">Opens after pre-enrolment</h2>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">
                FBR tax returns, health insurance, hotel booking, and the flight ticket appear here once pre-enrolment is marked done.
              </p>
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PrivacyControls({
  student,
  onStudent,
  onError,
  onMessage,
  onDeleted,
}: {
  student: PublicStudent;
  onStudent: (student: PublicStudent) => void;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
  onDeleted: () => void;
}) {
  return (
    <section className="panel rounded-3xl p-6 md:p-8 space-y-4 lg:col-span-3">
      <div>
        <p className="eyebrow">Privacy</p>
        <h2 className="display mt-2 text-3xl">Consent and controls</h2>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Policy version: {student.consent?.policyVersion ?? "legacy"}.{" "}
          <Link href="/privacy" className="font-semibold text-[var(--sea-deep)] hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-outline"
          onClick={async () => {
            const res = await fetch("/api/portal/privacy", { credentials: "same-origin" });
            if (res.status === 401) {
              onError("Log in again before exporting your data.");
              return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "ks-abroad-my-data.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export my data
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={async () => {
            const next = !(student.consent?.marketingOptIn ?? false);
            const res = await fetch("/api/portal/privacy", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ marketingOptIn: next }),
            });
            const json = (await res.json()) as { student?: PublicStudent; error?: string };
            if (res.status === 401) {
              onError("Log in again before changing this preference.");
              return;
            }
            if (!res.ok || !json.student) {
              onError(json.error || "Could not update marketing preference.");
              return;
            }
            onStudent(json.student);
            onMessage(next ? "Marketing updates enabled." : "Marketing updates turned off.");
          }}
        >
          {student.consent?.marketingOptIn ? "Turn off marketing updates" : "Allow marketing updates"}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={async () => {
            if (!window.confirm("Delete your account and uploaded documents permanently?")) return;
            const res = await fetch("/api/portal/privacy", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "delete" }),
            });
            if (!res.ok) {
              onError("Could not delete account.");
              return;
            }
            onDeleted();
          }}
        >
          Delete my account
        </button>
      </div>
    </section>
  );
}
