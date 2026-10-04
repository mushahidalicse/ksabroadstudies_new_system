import type { AcademicRequirement, EnglishRequirement, TestRequirement, TestType, TuitionRequirement } from "@/lib/catalogue-requirements";
import type { CatalogueCard } from "@/lib/programme-catalogue";

export const SOURCE_TYPES = [
  "official_programme_page",
  "official_admission_call",
  "official_university_regulation",
  "official_application_portal",
  "official_pdf",
  "other_official_source",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];
export type EnrichmentStatus = "needs_review" | "partially_verified" | "verified" | "outdated";
export type MoiChoice = "accepted" | "rejected" | "unknown" | null;
export type TuitionMode = "single" | "range" | "variable" | "unknown" | null;

export type EnglishEnrichment = {
  ieltsMin: number | null;
  toeflMin: number | null;
  cambridgeAccepted: true | false | null;
  moi: MoiChoice;
  level: string | null;
  notes: string | null;
};

export type TestEnrichment = {
  required: true | false | null;
  types: TestType[];
  notes: string | null;
};

export type TuitionEnrichment = {
  mode: TuitionMode;
  amount: number | null;
  min: number | null;
  max: number | null;
  currency: "EUR";
  period: "year" | "programme" | "semester" | null;
  notes: string | null;
};

export type AcademicEnrichment = {
  minimumCgpa: number | null;
  cgpaScale: number | null;
  minimumPercentage: number | null;
  requiredBackground: string[];
  ects: string | null;
  notes: string | null;
};

export type EnrichmentRecord = {
  slug: string;
  english: EnglishEnrichment;
  test: TestEnrichment;
  tuition: TuitionEnrichment;
  academic: AcademicEnrichment;
  sourceUrl: string;
  sourceTitle: string;
  sourceType: SourceType | "";
  lastChecked: string;
  academicYear: string;
  verificationStatus: EnrichmentStatus;
  notes: string;
};

export type HistoryEntry = {
  slug: string;
  field: string;
  previous: string;
  next: string;
  lastChecked: string;
  sourceUrl: string;
  at: string;
  actor: "admin";
};

export type EnrichmentStore = {
  records: EnrichmentRecord[];
  history: HistoryEntry[];
};

export const EMPTY_ENGLISH: EnglishEnrichment = {
  ieltsMin: null,
  toeflMin: null,
  cambridgeAccepted: null,
  moi: null,
  level: null,
  notes: null,
};

export const EMPTY_TEST: TestEnrichment = {
  required: null,
  types: [],
  notes: null,
};

export const EMPTY_TUITION: TuitionEnrichment = {
  mode: null,
  amount: null,
  min: null,
  max: null,
  currency: "EUR",
  period: null,
  notes: null,
};

export const EMPTY_ACADEMIC: AcademicEnrichment = {
  minimumCgpa: null,
  cgpaScale: null,
  minimumPercentage: null,
  requiredBackground: [],
  ects: null,
  notes: null,
};

const TEST_TYPES = new Set<TestType>(["CEnT-S", "TOLC", "SAT", "GRE", "GMAT", "interview", "university test", "other"]);
const STATUSES = new Set<EnrichmentStatus>(["needs_review", "partially_verified", "verified", "outdated"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function emptyRecord(slug: string): EnrichmentRecord {
  return {
    slug,
    english: { ...EMPTY_ENGLISH },
    test: { ...EMPTY_TEST },
    tuition: { ...EMPTY_TUITION },
    academic: { ...EMPTY_ACADEMIC, requiredBackground: [] },
    sourceUrl: "",
    sourceTitle: "",
    sourceType: "",
    lastChecked: "",
    academicYear: "",
    verificationStatus: "needs_review",
    notes: "",
  };
}

function numberOrNull(value: unknown, min: number, max: number) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return undefined;
  return parsed;
}

export function normalizeRecord(input: unknown, slug: string): { record: EnrichmentRecord | null; errors: string[] } {
  if (!input || typeof input !== "object") return { record: null, errors: ["Record must be an object."] };
  const body = input as Record<string, unknown>;
  const errors: string[] = [];
  const englishIn = (body.english ?? {}) as Record<string, unknown>;
  const testIn = (body.test ?? {}) as Record<string, unknown>;
  const tuitionIn = (body.tuition ?? {}) as Record<string, unknown>;
  const academicIn = (body.academic ?? {}) as Record<string, unknown>;
  const ieltsMin = numberOrNull(englishIn.ieltsMin, 4, 9);
  const toeflMin = numberOrNull(englishIn.toeflMin, 0, 120);
  if (ieltsMin === undefined) errors.push("IELTS minimum must be between 4 and 9.");
  if (toeflMin === undefined) errors.push("TOEFL minimum must be between 0 and 120.");
  const moi = englishIn.moi;
  if (moi != null && moi !== "accepted" && moi !== "rejected" && moi !== "unknown") errors.push("MOI must be accepted, rejected, or unknown.");
  const cambridge = englishIn.cambridgeAccepted;
  if (cambridge != null && cambridge !== true && cambridge !== false) errors.push("Cambridge must be yes, no, or unknown.");
  const required = testIn.required;
  if (required != null && required !== true && required !== false) errors.push("Test required must be yes, no, or unknown.");
  const types = Array.isArray(testIn.types) ? testIn.types.filter((item): item is TestType => typeof item === "string" && TEST_TYPES.has(item as TestType)) : [];
  if (Array.isArray(testIn.types) && types.length !== testIn.types.length) errors.push("A test type is not recognised.");
  const mode = tuitionIn.mode;
  if (mode != null && mode !== "single" && mode !== "range" && mode !== "variable" && mode !== "unknown") {
    errors.push("Tuition mode is not recognised.");
  }
  const amount = numberOrNull(tuitionIn.amount, 0, 100000);
  const min = numberOrNull(tuitionIn.min, 0, 100000);
  const max = numberOrNull(tuitionIn.max, 0, 100000);
  if (amount === undefined || min === undefined || max === undefined) errors.push("Tuition amounts must be numbers.");
  if (mode === "single" && amount == null) errors.push("A single tuition amount is required.");
  if (mode === "range" && (min == null || max == null || min > max)) errors.push("A tuition range needs a minimum and a maximum, with the minimum first.");
  if (mode === "variable" && !String(tuitionIn.notes ?? "").trim()) errors.push("Variable tuition needs a note. Do not enter one number.");
  const minimumCgpa = numberOrNull(academicIn.minimumCgpa, 0, 100);
  const cgpaScale = numberOrNull(academicIn.cgpaScale, 1, 100);
  const minimumPercentage = numberOrNull(academicIn.minimumPercentage, 0, 100);
  if (minimumCgpa === undefined || cgpaScale === undefined || minimumPercentage === undefined) errors.push("Academic numbers are out of range.");
  if (minimumCgpa != null && cgpaScale != null && minimumCgpa > cgpaScale) errors.push("Minimum CGPA cannot be higher than the scale.");
  const status = String(body.verificationStatus ?? "needs_review");
  if (!STATUSES.has(status as EnrichmentStatus)) errors.push("Verification status is not recognised.");
  const sourceUrl = String(body.sourceUrl ?? "").trim().slice(0, 400);
  const sourceType = String(body.sourceType ?? "");
  const lastChecked = String(body.lastChecked ?? "").trim();
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) errors.push("Source URL must start with http:// or https://.");
  if (sourceType && !SOURCE_TYPES.includes(sourceType as SourceType)) errors.push("Source type is not an official source type.");
  if (lastChecked && !DATE.test(lastChecked)) errors.push("Last checked must be YYYY-MM-DD.");
  if (status === "verified") {
    if (!sourceUrl) errors.push("A verified record needs a source URL.");
    if (!sourceType) errors.push("A verified record needs a source type.");
    if (!lastChecked) errors.push("A verified record needs a last checked date.");
  }
  if (errors.length) return { record: null, errors };
  const background = Array.isArray(academicIn.requiredBackground)
    ? academicIn.requiredBackground.map((item) => String(item).trim()).filter(Boolean).slice(0, 12)
    : [];
  return {
    record: {
      slug,
      english: {
        ieltsMin: ieltsMin ?? null,
        toeflMin: toeflMin ?? null,
        cambridgeAccepted: cambridge === true || cambridge === false ? cambridge : null,
        moi: (moi as MoiChoice) ?? null,
        level: String(englishIn.level ?? "").trim().slice(0, 8) || null,
        notes: String(englishIn.notes ?? "").trim().slice(0, 500) || null,
      },
      test: {
        required: required === true || required === false ? required : null,
        types,
        notes: String(testIn.notes ?? "").trim().slice(0, 500) || null,
      },
      tuition: {
        mode: (mode as TuitionMode) ?? null,
        amount: mode === "single" ? amount ?? null : null,
        min: mode === "range" ? min ?? null : null,
        max: mode === "range" ? max ?? null : null,
        currency: "EUR",
        period: tuitionIn.period === "year" || tuitionIn.period === "programme" || tuitionIn.period === "semester" ? tuitionIn.period : null,
        notes: String(tuitionIn.notes ?? "").trim().slice(0, 500) || null,
      },
      academic: {
        minimumCgpa: minimumCgpa ?? null,
        cgpaScale: cgpaScale ?? null,
        minimumPercentage: minimumPercentage ?? null,
        requiredBackground: background,
        ects: String(academicIn.ects ?? "").trim().slice(0, 80) || null,
        notes: String(academicIn.notes ?? "").trim().slice(0, 500) || null,
      },
      sourceUrl,
      sourceTitle: String(body.sourceTitle ?? "").trim().slice(0, 160),
      sourceType: (sourceType || "") as SourceType | "",
      lastChecked,
      academicYear: String(body.academicYear ?? "").trim().slice(0, 40),
      verificationStatus: status as EnrichmentStatus,
      notes: String(body.notes ?? "").trim().slice(0, 1000),
    },
    errors: [],
  };
}

export function isFresh(lastChecked: string, today = new Date().toISOString().slice(0, 10)) {
  if (!DATE.test(lastChecked)) return false;
  const checked = Date.parse(`${lastChecked}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  return Number.isFinite(checked) && now - checked <= 1000 * 60 * 60 * 24 * 450;
}

export function enrichmentApplies(record: EnrichmentRecord | null | undefined, today?: string) {
  if (!record) return false;
  if (record.verificationStatus === "outdated" || record.verificationStatus === "needs_review") return false;
  if (!isFresh(record.lastChecked, today)) return false;
  return record.verificationStatus === "verified" || record.verificationStatus === "partially_verified";
}

function tuitionFrom(record: TuitionEnrichment): TuitionRequirement | null {
  if (!record.mode || record.mode === "unknown") return record.mode === "unknown" ? null : null;
  if (record.mode === "single" && record.amount != null) {
    return { amount: record.amount, min: null, max: null, currency: "EUR", period: record.period, notes: record.notes };
  }
  if (record.mode === "range" && record.min != null && record.max != null) {
    return { amount: null, min: record.min, max: record.max, currency: "EUR", period: record.period, notes: record.notes || "Stored as a range, not one fee." };
  }
  if (record.mode === "variable") {
    return { amount: null, min: null, max: null, currency: "EUR", period: record.period, notes: record.notes };
  }
  return null;
}

export function applyEnrichment(card: CatalogueCard, record: EnrichmentRecord | null | undefined, today?: string): CatalogueCard {
  const meta = {
    enrichmentStatus: record?.verificationStatus ?? null,
    enrichmentSourceUrl: record?.sourceUrl || null,
    enrichmentSourceTitle: record?.sourceTitle || null,
    enrichmentSourceType: record?.sourceType || null,
    enrichmentLastChecked: record?.lastChecked || null,
    enrichmentAcademicYear: record?.academicYear || null,
  };
  if (!enrichmentApplies(record, today) || !record) {
    return { ...card, ...meta };
  }
  const english: EnglishRequirement = { ...card.requirements.english };
  if (record.english.ieltsMin != null) english.ieltsMin = record.english.ieltsMin;
  if (record.english.toeflMin != null) english.toeflMin = record.english.toeflMin;
  if (record.english.cambridgeAccepted != null) english.cambridgeAccepted = record.english.cambridgeAccepted;
  if (record.english.moi === "accepted") english.moiAccepted = true;
  if (record.english.moi === "rejected") english.moiAccepted = false;
  if (record.english.moi === "unknown") english.moiAccepted = null;
  if (record.english.level) english.level = record.english.level;
  const test: TestRequirement = record.test.required == null
    ? card.requirements.test
    : { required: record.test.required, type: record.test.types, notes: record.test.notes };
  const academic: AcademicRequirement = { ...card.requirements.academic };
  if (record.academic.minimumCgpa != null) academic.minimumCgpa = record.academic.minimumCgpa;
  if (record.academic.cgpaScale != null) academic.cgpaScale = record.academic.cgpaScale;
  if (record.academic.minimumPercentage != null) academic.minimumPercentage = record.academic.minimumPercentage;
  if (record.academic.requiredBackground.length) academic.requiredBackground = record.academic.requiredBackground;
  if (record.academic.notes) academic.notes = record.academic.notes;
  let tuition = card.requirements.tuition;
  if (record.tuition.mode === "unknown") tuition = null;
  else if (record.tuition.mode) tuition = tuitionFrom(record.tuition);
  return {
    ...card,
    ...meta,
    requirementOrigin: record.verificationStatus === "verified" ? "verified" : "partial",
    requirements: { english, test, tuition, academic },
  };
}

export function historyFor(previous: EnrichmentRecord | null, next: EnrichmentRecord, at: string): HistoryEntry[] {
  const before = previous ? JSON.stringify(previous) : "";
  const fields: Array<[string, string, string]> = [
    ["english", JSON.stringify(previous?.english ?? null), JSON.stringify(next.english)],
    ["test", JSON.stringify(previous?.test ?? null), JSON.stringify(next.test)],
    ["tuition", JSON.stringify(previous?.tuition ?? null), JSON.stringify(next.tuition)],
    ["academic", JSON.stringify(previous?.academic ?? null), JSON.stringify(next.academic)],
    ["source", `${previous?.sourceUrl ?? ""}|${previous?.sourceType ?? ""}`, `${next.sourceUrl}|${next.sourceType}`],
    ["verificationStatus", previous?.verificationStatus ?? "", next.verificationStatus],
    ["lastChecked", previous?.lastChecked ?? "", next.lastChecked],
    ["academicYear", previous?.academicYear ?? "", next.academicYear],
  ];
  return fields
    .filter(([, from, to]) => from !== to)
    .map(([field, from, to]) => ({
      slug: next.slug,
      field,
      previous: from,
      next: to,
      lastChecked: next.lastChecked,
      sourceUrl: next.sourceUrl,
      at,
      actor: "admin" as const,
    }))
    .filter(() => before !== JSON.stringify(next) || !previous);
}

export function saveGuards(
  previous: EnrichmentRecord | null,
  next: EnrichmentRecord,
  flags: { confirmSource?: boolean; confirmClear?: boolean },
) {
  const errors: string[] = [];
  const clearedVerified =
    previous?.verificationStatus === "verified" &&
    (next.verificationStatus !== "verified" ||
      (previous.english.ieltsMin != null && next.english.ieltsMin == null) ||
      (previous.english.toeflMin != null && next.english.toeflMin == null) ||
      (previous.tuition.amount != null && next.tuition.amount == null) ||
      (previous.academic.minimumCgpa != null && next.academic.minimumCgpa == null));
  if (clearedVerified && flags.confirmClear !== true) errors.push("Confirm before clearing a verified value.");
  if (previous?.sourceUrl && next.sourceUrl !== previous.sourceUrl && flags.confirmSource !== true) {
    errors.push("Confirm before replacing the source.");
  }
  return errors;
}

export function saveRecord(store: EnrichmentStore, next: EnrichmentRecord, at: string): EnrichmentStore {
  const previous = store.records.find((record) => record.slug === next.slug) ?? null;
  const records = [...store.records.filter((record) => record.slug !== next.slug), next];
  const history = [...historyFor(previous, next, at), ...store.history].slice(0, 500);
  return { records, history };
}

export function removeRecord(store: EnrichmentStore, slug: string, at: string): EnrichmentStore {
  const previous = store.records.find((record) => record.slug === slug);
  if (!previous) return store;
  return {
    records: store.records.filter((record) => record.slug !== slug),
    history: [
      {
        slug,
        field: "record",
        previous: previous.verificationStatus,
        next: "deleted",
        lastChecked: previous.lastChecked,
        sourceUrl: previous.sourceUrl,
        at,
        actor: "admin" as const,
      },
      ...store.history,
    ].slice(0, 500),
  };
}

export function publicEnglishLine(card: CatalogueCard) {
  if (card.requirementOrigin !== "verified" && card.requirementOrigin !== "partial") return null;
  const english = card.requirements.english;
  const parts = [
    english.ieltsMin != null ? `IELTS ${english.ieltsMin}` : "",
    english.toeflMin != null ? `TOEFL ${english.toeflMin}` : "",
    english.level ? `CEFR ${english.level}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function publicMoiLine(card: CatalogueCard) {
  if (card.requirementOrigin !== "verified" && card.requirementOrigin !== "partial") return null;
  if (card.requirements.english.moiAccepted === true) return "Accepted";
  if (card.requirements.english.moiAccepted === false) return "Not accepted";
  if (card.requirements.english.moiAccepted == null) return "Unknown";
  return null;
}

export function publicTuitionLine(card: CatalogueCard) {
  if (card.requirementOrigin !== "verified" && card.requirementOrigin !== "partial") return null;
  const tuition = card.requirements.tuition;
  if (!tuition) return "Unknown";
  if (tuition.amount != null) return `€${tuition.amount}${tuition.period ? ` / ${tuition.period}` : ""}`;
  if (tuition.min != null && tuition.max != null) return `€${tuition.min}–€${tuition.max}${tuition.period ? ` / ${tuition.period}` : ""}`;
  return tuition.notes || "Variable";
}
