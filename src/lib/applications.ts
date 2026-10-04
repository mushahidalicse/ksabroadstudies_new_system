import {
  APPLICATION_STATUSES,
  applicationStatusLabel,
  type ApplicationPack,
  type ApplicationStatus,
  type PackItem,
  type StudentApplication,
} from "@/lib/application-types";
import { getCasesForStudent } from "@/lib/consultancy";
import { getUniversities } from "@/lib/data";
import { checklistForLevel, filesForSlot, slotReady } from "@/lib/document-vault";
import {
  findApplication,
  insertApplication,
  listApplications,
  listApplicationsForStudent,
  patchApplicationStatus,
} from "@/lib/portal-store/applications";
import { type PublicStudent, type StudyLevel } from "@/lib/student-types";

export type {
  ApplicationPack,
  ApplicationStatus,
  ApplicationStatusEvent,
  PackItem,
  StudentApplication,
} from "@/lib/application-types";
export { APPLICATION_STATUSES, applicationStatusLabel };

export async function getApplications(): Promise<StudentApplication[]> {
  return listApplications();
}

export async function getApplicationsForStudent(studentId: string) {
  return listApplicationsForStudent(studentId);
}

export async function getApplicationById(id: string) {
  return findApplication(id);
}

/** Active consultancy unlocks the apply hub. */
export async function studentHasActiveConsultancy(studentId: string) {
  const cases = await getCasesForStudent(studentId);
  return cases.some((c) => c.status === "open" || c.status === "in_progress");
}

export function buildPackForStudent(student: PublicStudent): PackItem[] {
  const slots = checklistForLevel(student.profile.studyLevel);
  return slots.map((slot) => {
    const docs = filesForSlot(student, slot);
    const latest = docs[docs.length - 1];
    return {
      kind: slot.id,
      label: slot.label,
      required: slot.required,
      present: slot.required ? slotReady(student, slot) : docs.length > 0,
      documentId: latest?.id,
      originalName: latest?.originalName,
    };
  });
}

export function packSummary(items: PackItem[]): Omit<ApplicationPack, "applicationId"> {
  const required = items.filter((i) => i.required);
  const readyCount = required.filter((i) => i.present).length;
  return {
    items,
    readyCount,
    requiredCount: required.length,
    complete: required.length > 0 && readyCount === required.length,
  };
}

export async function createApplication(input: {
  studentId: string;
  universityId: string;
  programName?: string;
  level?: StudyLevel | "";
  consultancyCaseId?: string | null;
}): Promise<{ ok: true; application: StudentApplication } | { ok: false; error: string }> {
  const unlocked = await studentHasActiveConsultancy(input.studentId);
  if (!unlocked) {
    return {
      ok: false,
      error:
        "Start consultancy first (Step 4). Apply hub unlocks after you open a case with KS Abroad.",
    };
  }

  const universities = await getUniversities();
  const uni = universities.find((u) => u.id === input.universityId);
  if (!uni) return { ok: false, error: "University not found in catalogue." };

  const programName = (input.programName || "").trim();
  if (programName) {
    const known = uni.programs.some(
      (p) => p.name.toLowerCase() === programName.toLowerCase(),
    );
    if (!known) {
      // Allow free-text programme names for assisted apply outside listed English set
    }
  }

  const now = new Date().toISOString();
  const application: StudentApplication = {
    id: crypto.randomUUID(),
    studentId: input.studentId,
    universityId: uni.id,
    universityName: uni.name,
    programName: programName || uni.programs[0]?.name || "Programme TBD",
    level: input.level || uni.programs[0]?.level || "",
    portalUrl: uni.admissionPortal,
    consultancyCaseId: input.consultancyCaseId || null,
    status: "requested",
    staffNote: "",
    createdAt: now,
    updatedAt: now,
    history: [
      {
        at: now,
        status: "requested",
        by: "student",
        note: "Student requested assisted apply via portal.",
      },
    ],
  };

  const saved = await insertApplication(application);
  return { ok: true, application: saved ?? application };
}

export async function updateApplicationStatus(input: {
  id: string;
  status: ApplicationStatus;
  staffNote?: string;
}): Promise<StudentApplication | null> {
  return patchApplicationStatus(input);
}
