import type { ConsultancyStatus, ConsultancyType } from "@/lib/consultancy-types";
import {
  findCase,
  insertCase,
  insertReply,
  listCases,
  listCasesForStudent,
  setCaseStatus,
} from "@/lib/portal-store/consultancy";

export type {
  ConsultancyCase,
  ConsultancyReply,
  ConsultancyStatus,
  ConsultancyType,
} from "@/lib/consultancy-types";

export async function getCases() {
  return listCases();
}

export async function getCasesForStudent(studentId: string) {
  return listCasesForStudent(studentId);
}

export async function getCaseById(id: string) {
  return findCase(id);
}

export async function createCase(input: {
  studentId: string;
  type: ConsultancyType;
  topic: string;
  message: string;
}) {
  const row = await insertCase(input);
  if (!row) throw new Error("Could not open the consultancy case.");
  return row;
}

export async function addStudentReply(caseId: string, studentId: string, body: string) {
  return insertReply(caseId, studentId, body, "student");
}

export async function addStaffReply(caseId: string, body: string) {
  return insertReply(caseId, null, body, "staff");
}

export async function updateCaseStatus(caseId: string, status: ConsultancyStatus) {
  return setCaseStatus(caseId, status);
}
