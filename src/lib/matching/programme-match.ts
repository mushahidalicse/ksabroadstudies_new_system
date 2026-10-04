import type { CatalogueCard } from "@/lib/programme-catalogue";
import { publicEnglishLine, publicTuitionLine } from "@/lib/programme-enrichment";
import type { StudentProfile, StudyLevel } from "@/lib/student-types";

export type MatchCategory = "strong" | "possible" | "needs-checking" | "mismatch";

export type MatchReason = {
  tone: "match" | "check" | "published-conflict" | "preference-conflict";
  text: string;
};

export type RequirementState = "no-known-conflict" | "published-conflict" | "unknown";
export type PreferenceState = "fits" | "conflict";

export type ProgrammeMatch = {
  slug: string;
  name: string;
  universityName: string;
  city: string;
  region: string;
  level: CatalogueCard["level"];
  field: string;
  finderStatus: CatalogueCard["finderStatus"];
  deadline: string | null;
  deadlineLabel: string;
  applicationFeeEuro: number | null;
  catalogueChecked: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
  englishLine: string | null;
  tuitionLine: string | null;
  category: MatchCategory;
  factorCount: number;
  reasons: MatchReason[];
  checks: MatchReason[];
  publishedConflicts: MatchReason[];
  preferenceConflicts: MatchReason[];
  requirementState: RequirementState;
  preferenceState: PreferenceState;
};

export type MatchQuery = {
  category?: MatchCategory | "";
  status?: CatalogueCard["finderStatus"] | "";
  region?: string;
  field?: string;
  maxFee?: number | null;
  sort?: "relevance" | "deadline" | "fee" | "verified";
  offset?: number;
  limit?: number;
};

const CATEGORY_RANK: Record<MatchCategory, number> = {
  strong: 0,
  possible: 1,
  "needs-checking": 2,
  mismatch: 3,
};

const FIELD_ALIASES: Record<string, string[]> = {
  business: ["business", "economics", "management", "commerce", "finance"],
  economics: ["economics", "business", "finance"],
  engineering: ["engineering", "mechanical", "civil", "electronic"],
  computer: ["computer", "informatics", "software", "computing", "data"],
  medicine: ["medicine", "medical", "surgery"],
  data: ["data", "statistics", "computer"],
};

export function targetLevel(profile: StudentProfile): StudyLevel | "single-cycle" | null {
  if (profile.targetStudyLevel) return profile.targetStudyLevel;
  switch (profile.studyLevel) {
    case "intermediate":
      return "bachelor";
    case "bachelors":
    case "bsc":
    case "bcom":
    case "mbbs":
    case "dpt":
    case "bds":
      return "master";
    case "masters":
    case "phd":
      return "phd";
    default:
      return null;
  }
}

function tokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function fieldTokens(value: string) {
  const base = tokens(value);
  const extra = base.flatMap((token) => FIELD_ALIASES[token] ?? []);
  return new Set([...base, ...extra]);
}

function fieldsOverlap(profile: StudentProfile, programme: CatalogueCard) {
  const wanted = fieldTokens(`${profile.field} ${profile.preferredFields} ${profile.specialization}`);
  if (wanted.size === 0) return null;
  const offered = fieldTokens(`${programme.field} ${programme.name}`);
  for (const token of wanted) {
    if (offered.has(token)) return true;
  }
  return false;
}

function publishedIelts(text: string) {
  const patterns = [
    /ielts[^0-9]{0,24}(\d(?:\.\d)?)/i,
    /(\d(?:\.\d)?)\s*(?:overall\s*)?ielts/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

function numberOrNull(value: string) {
  const parsed = Number(value.replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function levelLabel(level: string) {
  if (level === "single-cycle") return "Single-cycle";
  if (level === "phd") return "PhD";
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function matchProgramme(profile: StudentProfile, programme: CatalogueCard): ProgrammeMatch {
  const reasons: MatchReason[] = [];
  const checks: MatchReason[] = [];
  const publishedConflicts: MatchReason[] = [];
  const preferenceConflicts: MatchReason[] = [];
  const wanted = targetLevel(profile);

  if (!wanted) {
    checks.push({ tone: "check", text: "Add your current education so the study level can be compared." });
  } else if (programme.level === wanted) {
    reasons.push({
      tone: "match",
      text: `${levelLabel(programme.level)} level matches your target. This is not an admission decision.`,
    });
  } else if (wanted === "master" && programme.level === "single-cycle") {
    checks.push({
      tone: "check",
      text: "This is a single-cycle medicine-style programme, not a master's degree. Confirm it is the path you want.",
    });
  } else {
    preferenceConflicts.push({
      tone: "preference-conflict",
      text: `This programme is ${levelLabel(programme.level)}. Your target is ${levelLabel(wanted)}. That is a preference, not a university decision.`,
    });
  }

  const field = fieldsOverlap(profile, programme);
  if (field === true) {
    reasons.push({ tone: "match", text: "The programme field overlaps a field you entered." });
  } else if (field === false) {
    preferenceConflicts.push({
      tone: "preference-conflict",
      text: "The programme field does not closely match the field you entered.",
    });
  } else {
    checks.push({ tone: "check", text: "Add your preferred field to compare subjects." });
  }

  if (profile.regionPreference) {
    if (programme.region === profile.regionPreference) {
      reasons.push({ tone: "match", text: "The university region matches your preference." });
    } else {
      preferenceConflicts.push({ tone: "preference-conflict", text: "The university is outside your preferred region." });
    }
  }

  if (profile.cityPreference.trim()) {
    const city = profile.cityPreference.toLowerCase();
    if (programme.city.toLowerCase().includes(city) || city.includes(programme.city.toLowerCase())) {
      reasons.push({ tone: "match", text: `${programme.city} matches your city preference.` });
    }
  }

  const cap = numberOrNull(profile.maxApplicationFeeEuro);
  if (cap != null && programme.applicationFeeEuro != null) {
    if (programme.applicationFeeEuro <= cap) {
      reasons.push({
        tone: "match",
        text: `Application fee of €${programme.applicationFeeEuro} is within your €${cap} preference.`,
      });
    } else {
      preferenceConflicts.push({
        tone: "preference-conflict",
        text: `The application fee of €${programme.applicationFeeEuro} is above your €${cap} preference.`,
      });
    }
  } else if (programme.applicationFeeEuro == null) {
    checks.push({ tone: "check", text: "Application fee is not recorded in the catalogue." });
  }

  const english = programme.requirements.english;
  const proof = profile.englishProof.trim();
  const score = numberOrNull(profile.englishScore);
  const minimum = english.ieltsMin ?? publishedIelts(english.notes || "");
  if (!english.notes) {
    checks.push({ tone: "check", text: "The catalogue does not record an English requirement for this programme." });
  } else if (proof === "IELTS" && score != null && minimum != null) {
    if (score + 0.001 >= minimum) {
      reasons.push({ tone: "match", text: `Your IELTS ${score} meets the published minimum of ${minimum}.` });
    } else {
      publishedConflicts.push({
        tone: "published-conflict",
        text: `Your IELTS ${score} is below the published IELTS ${minimum} minimum.`,
      });
    }
  } else if (proof === "TOEFL" && score != null && english.toeflMin != null) {
    if (score + 0.001 >= english.toeflMin) {
      reasons.push({ tone: "match", text: `Your TOEFL ${score} meets the published minimum of ${english.toeflMin}.` });
    } else {
      publishedConflicts.push({
        tone: "published-conflict",
        text: `Your TOEFL ${score} is below the published TOEFL ${english.toeflMin} minimum.`,
      });
    }
  } else if (proof === "MOI" || profile.moiAvailable === "yes") {
    if (english.moiAccepted === true) {
      reasons.push({ tone: "match", text: "The stored official text explicitly accepts medium of instruction." });
    } else if (english.moiAccepted === false) {
      publishedConflicts.push({
        tone: "published-conflict",
        text: "The stored official text says medium of instruction is not accepted.",
      });
    } else {
      checks.push({ tone: "check", text: "MOI acceptance is not clearly stated in the stored official information." });
    }
  } else if (!proof || proof === "None") {
    checks.push({ tone: "check", text: "English proof is missing, so the published language rule cannot be compared." });
  } else if (minimum != null) {
    checks.push({
      tone: "check",
      text: `A published IELTS minimum of ${minimum} is recorded. Your proof is ${proof || "not entered"}.`,
    });
  } else {
    checks.push({ tone: "check", text: "The stored English text cannot be compared with the proof you entered." });
  }

  const academic = programme.requirements.academic;
  const studentPercentage = numberOrNull(profile.percentage);
  const studentCgpa = profile.gradeSystem === "cgpa" ? numberOrNull(profile.cgpa) : null;
  const studentScale = numberOrNull(profile.cgpaScale);
  if (academic.minimumPercentage != null && studentPercentage != null) {
    if (studentPercentage + 0.001 >= academic.minimumPercentage) {
      reasons.push({
        tone: "match",
        text: `Your percentage ${studentPercentage} meets the published minimum of ${academic.minimumPercentage}%.`,
      });
    } else {
      publishedConflicts.push({
        tone: "published-conflict",
        text: `Your percentage ${studentPercentage} is below the published minimum of ${academic.minimumPercentage}%.`,
      });
    }
  } else if (academic.minimumCgpa != null && studentCgpa != null && academic.cgpaScale != null && studentScale != null) {
    if (studentScale === academic.cgpaScale && studentCgpa + 0.001 >= academic.minimumCgpa) {
      reasons.push({
        tone: "match",
        text: `Your CGPA ${studentCgpa}/${studentScale} meets the published minimum of ${academic.minimumCgpa}/${academic.cgpaScale}.`,
      });
    } else if (studentScale === academic.cgpaScale) {
      publishedConflicts.push({
        tone: "published-conflict",
        text: `Your CGPA ${studentCgpa}/${studentScale} is below the published minimum of ${academic.minimumCgpa}/${academic.cgpaScale}.`,
      });
    } else {
      checks.push({ tone: "check", text: "A CGPA cutoff is stored on a different scale, so the two figures were not converted." });
    }
  }

  const test = programme.requirements.test;
  if (test.required === true) {
    const label = test.type.join(", ") || test.notes || "an admission test";
    if (profile.willingToTakeTest === "yes") {
      reasons.push({ tone: "match", text: `The programme requires ${label}, and you are willing to take an admission test.` });
    } else if (profile.willingToTakeTest === "no") {
      preferenceConflicts.push({
        tone: "preference-conflict",
        text: `The programme requires ${label}. You indicated that you prefer not to take an admission test.`,
      });
    } else {
      checks.push({ tone: "check", text: `The programme requires ${label}. Confirm whether you will take it.` });
    }
  }

  const tuition = programme.requirements.tuition;
  const budget = numberOrNull(profile.annualBudgetEuro);
  if (tuition?.amount != null && budget != null && tuition.amount > budget) {
    preferenceConflicts.push({
      tone: "preference-conflict",
      text: `The stored tuition of €${tuition.amount} is above your €${budget} yearly budget.`,
    });
  } else if (tuition && tuition.amount == null && (tuition.min != null || tuition.max != null)) {
    checks.push({ tone: "check", text: "Tuition is stored as a range, so it was not compared as one number." });
  }

  let category: MatchCategory;
  if (publishedConflicts.length) category = "mismatch";
  else if (checks.length) category = "needs-checking";
  else if (preferenceConflicts.length || reasons.length < 2) category = "possible";
  else category = "strong";

  return {
    slug: programme.slug,
    name: programme.name,
    universityName: programme.universityName,
    city: programme.city,
    region: programme.region,
    level: programme.level,
    field: programme.field,
    finderStatus: programme.finderStatus,
    deadline: programme.deadline,
    deadlineLabel: programme.deadlineLabel,
    applicationFeeEuro: programme.applicationFeeEuro,
    catalogueChecked: programme.catalogueChecked,
    sourceUrl: programme.requirementOrigin === "verified" || programme.requirementOrigin === "partial" ? programme.enrichmentSourceUrl : programme.sourceUrl,
    sourceTitle: programme.requirementOrigin === "verified" || programme.requirementOrigin === "partial" ? programme.enrichmentSourceTitle : programme.sourceTitle,
    englishLine: publicEnglishLine(programme),
    tuitionLine: publicTuitionLine(programme),
    category,
    factorCount: reasons.length,
    reasons,
    checks,
    publishedConflicts,
    preferenceConflicts,
    requirementState: publishedConflicts.length ? "published-conflict" : checks.length ? "unknown" : "no-known-conflict",
    preferenceState: preferenceConflicts.length ? "conflict" : "fits",
  };
}

export function matchProgrammes(profile: StudentProfile, catalogue: CatalogueCard[], query: MatchQuery = {}) {
  const limit = Math.min(Math.max(query.limit ?? 24, 1), 60);
  const offset = Math.max(query.offset ?? 0, 0);
  let rows = catalogue.map((programme) => matchProgramme(profile, programme));
  if (query.category) rows = rows.filter((row) => row.category === query.category);
  if (query.status) rows = rows.filter((row) => row.finderStatus === query.status);
  if (query.region) rows = rows.filter((row) => row.region === query.region);
  if (query.field) {
    const needle = query.field.toLowerCase();
    rows = rows.filter((row) => `${row.field} ${row.name}`.toLowerCase().includes(needle));
  }
  if (query.maxFee != null) {
    rows = rows.filter((row) => row.applicationFeeEuro == null || row.applicationFeeEuro <= query.maxFee!);
  }
  rows.sort((a, b) => {
    if (query.sort === "deadline") return (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
    if (query.sort === "fee") return (a.applicationFeeEuro ?? 999999) - (b.applicationFeeEuro ?? 999999);
    if (query.sort === "verified") return b.catalogueChecked.localeCompare(a.catalogueChecked);
    const rank = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
    if (rank !== 0) return rank;
    return b.factorCount - a.factorCount;
  });
  return {
    total: rows.length,
    offset,
    limit,
    matches: rows.slice(offset, offset + limit),
  };
}
