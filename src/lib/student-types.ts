export const CONSENT_POLICY_VERSION =
  process.env.CONSENT_POLICY_VERSION?.trim() || "2026-09-20";

export type StudentConsent = {
  /** Privacy Policy accepted */
  privacyAcceptedAt: string;
  /** Terms / consultancy agreement accepted */
  termsAcceptedAt: string;
  /** Version string of policies at acceptance time */
  policyVersion: string;
  /** Optional marketing / WhatsApp updates */
  marketingOptIn: boolean;
  marketingOptInAt?: string;
  /** IP captured at registration (abuse + accountability) */
  acceptedFromIp?: string;
  /** User-agent snapshot (truncated) */
  acceptedUserAgent?: string;
};

export type StudyLevel = "bachelor" | "master" | "single-cycle" | "phd";

/** What the student has finished, or is finishing now. Documents follow the next admission. */
export type CurrentEducation =
  | "intermediate"
  | "bachelors"
  | "masters"
  | "phd"
  | "bsc"
  | "bcom"
  | "mbbs"
  | "dpt"
  | "bds";

export const CURRENT_EDUCATION: Array<{ id: CurrentEducation; label: string }> = [
  { id: "intermediate", label: "Intermediate" },
  { id: "bachelors", label: "Bachelors" },
  { id: "bsc", label: "BSc" },
  { id: "bcom", label: "B.Com" },
  { id: "mbbs", label: "MBBS" },
  { id: "dpt", label: "DPT" },
  { id: "bds", label: "BDS" },
  { id: "masters", label: "Masters" },
  { id: "phd", label: "PhD" },
];

export type DocumentKind =
  | "passport"
  | "transcript"
  | "degree"
  | "english"
  | "other"
  | "ssc"
  | "hssc"
  | "bachelors-degree"
  | "masters-degree"
  | "photo"
  | "europass-cv"
  | "recommendation"
  | "course-description"
  | "motivation-letter"
  | "research-proposal"
  | "publications"
  | "fbr-return"
  | "health-insurance"
  | "hotel-booking"
  | "flight-ticket"
  | "payment-proof";

export type GradeSystem = "cgpa" | "percentage" | "";
export type YesNo = "yes" | "no" | "";

export type StudentProfile = {
  /** Current or highest education. Drives the usual next application level. */
  studyLevel: CurrentEducation | "";
  /** Primary field of study. */
  field: string;
  /** CGPA or percentage as entered. Not converted automatically. */
  cgpa: string;
  englishProof: string;
  cityPreference: string;
  regionPreference: "lazio" | "south" | "centre" | "north" | "";
  /** Intended intake, for example 2026/27. */
  intake: string;
  notes: string;
  nationality: string;
  countryOfEducation: string;
  countryOfResidence: string;
  degreeTitle: string;
  /** Optional override of the usual next study level. */
  targetStudyLevel: StudyLevel | "";
  specialization: string;
  institution: string;
  graduationYear: string;
  gradeSystem: GradeSystem;
  cgpaScale: string;
  percentage: string;
  englishScore: string;
  moiAvailable: YesNo;
  preferredFields: string;
  maxApplicationFeeEuro: string;
  annualBudgetEuro: string;
  scholarshipInterest: YesNo;
  willingToTakeTest: YesNo;
};

export type StudentDocument = {
  id: string;
  kind: DocumentKind;
  originalName: string;
  storedName: string;
  uploadedAt: string;
};

export type StudentRecord = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  surname: string;
  dateOfBirth: string;
  placeOfBirth: string;
  passportOrCnic: string;
  phone: string;
  currentCity: string;
  address: string;
  createdAt: string;
  profile: StudentProfile;
  documents: StudentDocument[];
  /** Catalogue slugs only. Programme details are read from the live catalogue. */
  shortlist?: ShortlistEntry[];
  /** Required for new accounts — lawful basis = consent */
  consent?: StudentConsent;
};

export type ShortlistEntry = {
  slug: string;
  savedAt: string;
};

export type PublicStudent = Omit<StudentRecord, "passwordHash">;

export function shortlistReady(profile: StudentProfile) {
  return Boolean(
    profile.studyLevel &&
      profile.field.trim() &&
      profile.cgpa.trim() &&
      profile.englishProof.trim(),
  );
}

export const EMPTY_PROFILE: StudentProfile = {
  studyLevel: "",
  field: "",
  cgpa: "",
  englishProof: "",
  cityPreference: "",
  regionPreference: "",
  intake: "",
  notes: "",
  nationality: "",
  countryOfEducation: "",
  countryOfResidence: "",
  degreeTitle: "",
  targetStudyLevel: "",
  specialization: "",
  institution: "",
  graduationYear: "",
  gradeSystem: "",
  cgpaScale: "",
  percentage: "",
  englishScore: "",
  moiAvailable: "",
  preferredFields: "",
  maxApplicationFeeEuro: "",
  annualBudgetEuro: "",
  scholarshipInterest: "",
  willingToTakeTest: "",
};

export const DOCUMENT_KINDS: Array<{ id: DocumentKind; label: string }> = [
  { id: "ssc", label: "SSC diploma + marksheet" },
  { id: "hssc", label: "HSSC diploma + marksheet" },
  { id: "bachelors-degree", label: "Bachelor's degree + transcript" },
  { id: "masters-degree", label: "Master's degree + transcript" },
  { id: "degree", label: "Degree (earlier upload)" },
  { id: "transcript", label: "Transcript (earlier upload)" },
  { id: "english", label: "English certificate or IELTS" },
  { id: "recommendation", label: "Recommendation letter" },
  { id: "course-description", label: "Course description" },
  { id: "motivation-letter", label: "Motivational letter" },
  { id: "research-proposal", label: "Research proposal" },
  { id: "publications", label: "Publications" },
  { id: "passport", label: "Passport" },
  { id: "photo", label: "Passport size photo" },
  { id: "europass-cv", label: "Europass CV" },
  { id: "fbr-return", label: "FBR tax return" },
  { id: "health-insurance", label: "Health insurance" },
  { id: "hotel-booking", label: "Hotel booking for visa" },
  { id: "flight-ticket", label: "Flight ticket for visa" },
  { id: "payment-proof", label: "First installment proof" },
  { id: "other", label: "Other" },
];
