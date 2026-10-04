import type { DocumentKind, StudyLevel } from "@/lib/student-types";

/** Staff-driven pipeline — students request; KS Abroad updates status. */
export type ApplicationStatus =
  | "requested"
  | "reviewing"
  | "submitting"
  | "submitted"
  | "pre_admitted"
  | "universitaly"
  | "visa"
  | "enrolled"
  | "on_hold"
  | "rejected"
  | "closed";

export type ApplicationStatusEvent = {
  at: string;
  status: ApplicationStatus;
  by: "student" | "staff";
  note?: string;
};

export type StudentApplication = {
  id: string;
  studentId: string;
  universityId: string;
  universityName: string;
  programName: string;
  level: StudyLevel | "";
  portalUrl: string;
  consultancyCaseId: string | null;
  status: ApplicationStatus;
  staffNote: string;
  createdAt: string;
  updatedAt: string;
  history: ApplicationStatusEvent[];
};

export type PackItem = {
  kind: DocumentKind;
  label: string;
  required: boolean;
  present: boolean;
  documentId?: string;
  originalName?: string;
};

export type ApplicationPack = {
  applicationId: string;
  items: PackItem[];
  readyCount: number;
  requiredCount: number;
  complete: boolean;
};

export const APPLICATION_STATUSES: Array<{
  id: ApplicationStatus;
  label: string;
}> = [
  { id: "requested", label: "Requested (awaiting KS)" },
  { id: "reviewing", label: "KS reviewing docs" },
  { id: "submitting", label: "KS submitting on portal" },
  { id: "submitted", label: "Submitted on university portal" },
  { id: "pre_admitted", label: "Pre-admitted" },
  { id: "universitaly", label: "Universitaly / visa prep" },
  { id: "visa", label: "Visa in progress" },
  { id: "enrolled", label: "Enrolled" },
  { id: "on_hold", label: "On hold" },
  { id: "rejected", label: "Rejected / not proceeded" },
  { id: "closed", label: "Closed" },
];

export function applicationStatusLabel(status: ApplicationStatus) {
  return APPLICATION_STATUSES.find((s) => s.id === status)?.label ?? status;
}

/** Student-facing case line. Staff labels stay on the admin desk. */
export const STUDENT_STATUS_LABEL: Record<ApplicationStatus, string> = {
  requested: "Case opened",
  reviewing: "In progress",
  submitting: "Apply ready",
  submitted: "Applied",
  pre_admitted: "Pre-enrolment done",
  universitaly: "Universitaly done",
  visa: "Ready for visa file",
  enrolled: "Enrolled",
  on_hold: "On hold",
  rejected: "Not proceeded",
  closed: "Closed",
};

export const STUDENT_STATUS_STEPS: ApplicationStatus[] = [
  "requested",
  "reviewing",
  "submitting",
  "submitted",
  "pre_admitted",
  "universitaly",
  "visa",
  "enrolled",
];

export function studentStatusLabel(status: ApplicationStatus) {
  return STUDENT_STATUS_LABEL[status] ?? status;
}
