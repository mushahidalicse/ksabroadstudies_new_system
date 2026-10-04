import { NextRequest, NextResponse } from "next/server";
import {
  buildPackForStudent,
  createApplication,
  getApplicationsForStudent,
  packSummary,
  studentHasActiveConsultancy,
} from "@/lib/applications";
import { studentIdFromRequest } from "@/lib/auth";
import { getCasesForStudent } from "@/lib/consultancy";
import { getUniversities } from "@/lib/data";
import { effectiveAdmissionStatus } from "@/lib/admission-status";
import {
  assertTrustedOrigin,
  clientIp,
  forbiddenOrigin,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/security";
import { getStudentById, toPublic } from "@/lib/students";
import type { StudyLevel } from "@/lib/student-types";

function clean(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, max);
}

export async function GET(req: NextRequest) {
  if (!rateLimit(`apps-get:${clientIp(req)}`, 30)) return rateLimitedResponse();
  const studentId = await studentIdFromRequest(req);
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const student = await getStudentById(studentId);
  if (!student) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [applications, unlocked, cases, universities] = await Promise.all([
    getApplicationsForStudent(studentId),
    studentHasActiveConsultancy(studentId),
    getCasesForStudent(studentId),
    getUniversities(),
  ]);

  const publicStudent = toPublic(student);
  const vault = packSummary(buildPackForStudent(publicStudent));

  return NextResponse.json({
    unlocked,
    vault,
    applications: applications.map((app) => ({
      ...app,
      pack: {
        applicationId: app.id,
        ...packSummary(buildPackForStudent(publicStudent)),
      },
    })),
    cases: cases.map((c) => ({
      id: c.id,
      topic: c.topic,
      status: c.status,
      type: c.type,
    })),
    universities: universities.map((u) => ({
      id: u.id,
      name: u.name,
      city: u.city,
      status: effectiveAdmissionStatus(u),
      admissionPortal: u.admissionPortal,
      programs: u.programs.map((p) => ({
        name: p.name,
        level: p.level,
      })),
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`apps-post:${clientIp(req)}`, 10)) return rateLimitedResponse();
  const studentId = await studentIdFromRequest(req);
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const universityId = clean(body.universityId, 120);
  const programName = clean(body.programName, 200);
  const level = clean(body.level, 40) as StudyLevel | "";
  const consultancyCaseId = clean(body.consultancyCaseId, 80) || null;

  if (!universityId) {
    return NextResponse.json({ error: "Choose a university." }, { status: 400 });
  }

  const result = await createApplication({
    studentId,
    universityId,
    programName,
    level: level || "",
    consultancyCaseId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  return NextResponse.json({ ok: true, application: result.application });
}
