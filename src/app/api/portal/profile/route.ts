import { NextRequest, NextResponse } from "next/server";
import { clean, sessionIdFromRequest } from "@/lib/auth";
import { portalMatch } from "@/lib/match-student";
import {
  assertTrustedOrigin,
  clientIp,
  forbiddenOrigin,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/security";
import {
  CURRENT_EDUCATION,
  EMPTY_PROFILE,
  type CurrentEducation,
  type GradeSystem,
  type StudyLevel,
  type YesNo,
} from "@/lib/student-types";
import { getStudentById, toPublic, upsertStudent } from "@/lib/students";

const LEVELS: CurrentEducation[] = CURRENT_EDUCATION.map((item) => item.id);
const REGIONS = ["lazio", "south", "centre", "north"] as const;
const TARGETS: StudyLevel[] = ["bachelor", "master", "single-cycle", "phd"];

function keepText(body: Record<string, unknown>, key: string, current: string, max: number) {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return current;
  return clean(body[key], max);
}

function keepYesNo(body: Record<string, unknown>, key: string, current: YesNo): YesNo {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return current;
  const value = clean(body[key], 8);
  return value === "yes" || value === "no" ? value : "";
}

async function payloadFor(id: string) {
  const student = await getStudentById(id);
  if (!student) return null;
  const pub = toPublic(student);
  const result = await portalMatch(pub);
  return { student: pub, ...result };
}

export async function GET(req: NextRequest) {
  if (!rateLimit(`portal-get:${clientIp(req)}`, 40)) return rateLimitedResponse();
  const id = sessionIdFromRequest(req);
  if (!id) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const payload = await payloadFor(id);
  if (!payload) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  return NextResponse.json(payload);
}

export async function PUT(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`portal-put:${clientIp(req)}`, 20)) return rateLimitedResponse();
  const id = sessionIdFromRequest(req);
  if (!id) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const current = await getStudentById(id);
  if (!current) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const studyLevelRaw = clean(body.studyLevel, 20);
  const regionRaw = clean(body.regionPreference, 20);

  const name = clean(body.name, 80);
  const surname = clean(body.surname, 80);
  const phone = clean(body.phone, 30);
  const dateOfBirth = clean(body.dateOfBirth, 20);
  const placeOfBirth = clean(body.placeOfBirth, 80);
  const passportOrCnic = clean(body.passportOrCnic, 40);
  const currentCity = clean(body.currentCity, 80);
  const address = clean(body.address, 240);
  if (name) current.name = name;
  if (surname) current.surname = surname;
  if (phone) current.phone = phone;
  if (dateOfBirth) current.dateOfBirth = dateOfBirth;
  if (placeOfBirth) current.placeOfBirth = placeOfBirth;
  if (passportOrCnic) current.passportOrCnic = passportOrCnic;
  if (currentCity) current.currentCity = currentCity;
  if (address) current.address = address;

  current.profile = {
    ...EMPTY_PROFILE,
    ...current.profile,
    studyLevel: LEVELS.includes(studyLevelRaw as CurrentEducation)
      ? (studyLevelRaw as CurrentEducation)
      : "",
    field: clean(body.field, 80),
    cgpa: clean(body.cgpa, 40),
    englishProof: clean(body.englishProof, 80),
    cityPreference: clean(body.cityPreference, 80),
    regionPreference: REGIONS.includes(regionRaw as (typeof REGIONS)[number])
      ? (regionRaw as (typeof REGIONS)[number])
      : "",
    intake: clean(body.intake, 40),
    notes: clean(body.notes, 2000),
    nationality: keepText(body, "nationality", current.profile.nationality, 80),
    countryOfEducation: keepText(body, "countryOfEducation", current.profile.countryOfEducation, 80),
    countryOfResidence: keepText(body, "countryOfResidence", current.profile.countryOfResidence, 80),
    degreeTitle: keepText(body, "degreeTitle", current.profile.degreeTitle, 120),
    targetStudyLevel: TARGETS.includes(clean(body.targetStudyLevel, 20) as StudyLevel)
      ? (clean(body.targetStudyLevel, 20) as StudyLevel)
      : Object.prototype.hasOwnProperty.call(body, "targetStudyLevel")
        ? ""
        : current.profile.targetStudyLevel,
    specialization: keepText(body, "specialization", current.profile.specialization, 80),
    institution: keepText(body, "institution", current.profile.institution, 120),
    graduationYear: keepText(body, "graduationYear", current.profile.graduationYear, 12),
    gradeSystem: (["cgpa", "percentage"].includes(clean(body.gradeSystem, 20))
      ? clean(body.gradeSystem, 20)
      : Object.prototype.hasOwnProperty.call(body, "gradeSystem")
        ? ""
        : current.profile.gradeSystem) as GradeSystem,
    cgpaScale: keepText(body, "cgpaScale", current.profile.cgpaScale, 12),
    percentage: keepText(body, "percentage", current.profile.percentage, 12),
    englishScore: keepText(body, "englishScore", current.profile.englishScore, 12),
    moiAvailable: keepYesNo(body, "moiAvailable", current.profile.moiAvailable),
    preferredFields: keepText(body, "preferredFields", current.profile.preferredFields, 160),
    maxApplicationFeeEuro: keepText(body, "maxApplicationFeeEuro", current.profile.maxApplicationFeeEuro, 12),
    annualBudgetEuro: keepText(body, "annualBudgetEuro", current.profile.annualBudgetEuro, 12),
    scholarshipInterest: keepYesNo(body, "scholarshipInterest", current.profile.scholarshipInterest),
    willingToTakeTest: keepYesNo(body, "willingToTakeTest", current.profile.willingToTakeTest),
  };

  await upsertStudent(current);
  const payload = await payloadFor(id);
  return NextResponse.json({ ok: true, ...payload });
}
