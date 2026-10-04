import type { CurrentEducation, DocumentKind, PublicStudent } from "@/lib/student-types";

export type ProgramTrack = "bachelor" | "master" | "phd";

/** Current education decides the next admission file. */
export function programTrack(level: CurrentEducation | ""): ProgramTrack | "" {
  if (level === "intermediate") return "bachelor";
  if (
    level === "bachelors" ||
    level === "bsc" ||
    level === "bcom" ||
    level === "mbbs" ||
    level === "dpt" ||
    level === "bds"
  ) {
    return "master";
  }
  if (level === "masters" || level === "phd") return "phd";
  return "";
}

export type VaultSlot = {
  id: DocumentKind;
  label: string;
  detail: string;
  required: boolean;
  minCount: number;
};

const optional = (
  id: DocumentKind,
  label: string,
  detail: string,
  minCount = 1,
): VaultSlot => ({ id, label, detail, required: false, minCount });

const required = (id: DocumentKind, label: string, detail: string): VaultSlot => ({
  id,
  label,
  detail,
  required: true,
  minCount: 1,
});

const BACHELOR: VaultSlot[] = [
  required("ssc", "Matric / SSC marksheet", "Matric certificate and full marksheet. Up to 8 MB."),
  required(
    "hssc",
    "FSc / HSSC marksheet or hope certificate",
    "Intermediate certificate and marksheet, or a hope certificate if the result is pending.",
  ),
  required(
    "english",
    "English certificate",
    "College English letter, IELTS, TOEFL, or Duolingo.",
  ),
  required("passport", "Passport", "Bio page, valid for the intake."),
  optional(
    "recommendation",
    "Two recommendation letters from college",
    "Upload both letters when you have them.",
    2,
  ),
  optional("photo", "Passport size photo", "Recent photo, plain background."),
  optional("europass-cv", "Europass CV", "PDF from the Europass editor."),
];

const MASTER: VaultSlot[] = [
  required(
    "bachelors-degree",
    "Degree and transcript",
    "Bachelor's degree and full transcript. Up to 8 MB.",
  ),
  required(
    "english",
    "MOI or IELTS",
    "Medium of instruction letter, IELTS, TOEFL, or Duolingo.",
  ),
  required("europass-cv", "Europass CV", "PDF from the Europass editor."),
  required("motivation-letter", "Statement of purpose", "1–2 pages for the evaluation board."),
  required("passport", "Passport", "Bio page, valid for the intake."),
  optional("hssc", "HSSC diploma + marksheet", "Intermediate certificate and marksheet."),
  optional("ssc", "SSC diploma + marksheet", "Matric certificate and marksheet."),
  optional(
    "recommendation",
    "Two recommendation letters from university supervisors",
    "Upload both letters when you have them.",
    2,
  ),
  optional(
    "course-description",
    "Course description from the university",
    "Official syllabus for the bachelor's.",
  ),
  optional("photo", "Passport size photo", "Recent photo, plain background."),
];

const PHD: VaultSlot[] = [
  required(
    "masters-degree",
    "Master's degree + transcript (2 years)",
    "Master's degree and full transcript.",
  ),
  required(
    "bachelors-degree",
    "Bachelor's degree + transcript (min. 3 years)",
    "Bachelor's degree and full transcript.",
  ),
  optional("hssc", "HSSC diploma + marksheet", "Intermediate certificate and marksheet."),
  optional("ssc", "SSC diploma + marksheet", "Matric certificate and marksheet."),
  optional(
    "english",
    "English language certificate from university or IELTS",
    "University English letter, or IELTS.",
  ),
  optional("publications", "Publications, if any", "Papers or a list. Skip if you have none."),
  optional("research-proposal", "Research proposal", "Your proposed PhD topic and plan."),
  optional("motivation-letter", "Motivational letter", "Why this PhD, and why Italy."),
  optional(
    "recommendation",
    "Two recommendation letters from university supervisors",
    "Upload both letters when you have them.",
    2,
  ),
  optional("passport", "Passport", "Bio page."),
  optional("photo", "Passport size photo", "Recent photo, plain background."),
  required("europass-cv", "Europass CV", "PDF from the Europass editor."),
];

export const VISA_FILE_SLOTS: VaultSlot[] = [
  {
    id: "fbr-return",
    label: "FBR tax returns",
    detail: "For the visa file, when KS Abroad is preparing it.",
    required: false,
    minCount: 1,
  },
  {
    id: "health-insurance",
    label: "Health insurance",
    detail: "Policy that covers the visa appointment period.",
    required: false,
    minCount: 1,
  },
  {
    id: "hotel-booking",
    label: "Hotel booking for visa submission",
    detail: "Booking used for the visa file.",
    required: false,
    minCount: 1,
  },
  {
    id: "flight-ticket",
    label: "Flight ticket for visa submission",
    detail: "Ticket or reservation used for the visa file.",
    required: false,
    minCount: 1,
  },
];

export function checklistForLevel(level: CurrentEducation | ""): VaultSlot[] {
  const track = programTrack(level);
  if (track === "phd") return PHD;
  if (track === "master") return MASTER;
  if (track === "bachelor") return BACHELOR;
  return [];
}

export function levelVaultTitle(level: CurrentEducation | "") {
  const track = programTrack(level);
  if (track === "phd") return "PhD documents";
  if (track === "master") return "Master's documents";
  if (track === "bachelor") return "Bachelor's documents";
  return "Choose your current study level first";
}

/** Older generic uploads still count toward the matching new slot. */
const LEGACY: Partial<Record<DocumentKind, DocumentKind[]>> = {
  "bachelors-degree": ["bachelors-degree", "degree", "transcript"],
  "masters-degree": ["masters-degree"],
  english: ["english"],
  passport: ["passport"],
};

export function filesForSlot(student: PublicStudent, slot: VaultSlot) {
  const accepted = new Set<DocumentKind>(LEGACY[slot.id] ?? [slot.id]);
  return (student.documents ?? []).filter((doc) => accepted.has(doc.kind));
}

export function slotReady(student: PublicStudent, slot: VaultSlot) {
  return filesForSlot(student, slot).length >= slot.minCount;
}
