import { EMPTY_PROFILE, type PublicStudent, type StudentRecord } from "@/lib/student-types";
import { deleteStudent, findStudentByEmail, findStudentById, listStudents, saveStudent } from "@/lib/portal-store/students";

export async function getStudents(): Promise<StudentRecord[]> {
  return listStudents();
}

export async function getStudentByEmail(email: string) {
  return findStudentByEmail(email);
}

export async function getStudentById(id: string) {
  return findStudentById(id);
}

export async function upsertStudent(next: StudentRecord) {
  const saved = await saveStudent(next);
  return saved ?? next;
}

export async function removeStudent(id: string) {
  await deleteStudent(id);
}

export function toPublic(student: StudentRecord): PublicStudent {
  const { passwordHash: _omit, ...rest } = student;
  void _omit;
  return {
    ...rest,
    surname: student.surname ?? "",
    dateOfBirth: student.dateOfBirth ?? "",
    placeOfBirth: student.placeOfBirth ?? "",
    passportOrCnic: student.passportOrCnic ?? "",
    currentCity: student.currentCity ?? "",
    address: student.address ?? "",
    profile: { ...EMPTY_PROFILE, ...student.profile },
    documents: student.documents ?? [],
    shortlist: Array.isArray(student.shortlist) ? student.shortlist : [],
  };
}
