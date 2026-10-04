import { loadLocalEnv } from "./load-env";
import { createSessionToken, hashPassword, readSessionToken, verifyPassword } from "@/lib/auth";

loadLocalEnv();
const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) {
  console.error("DATABASE_URL is missing. Start PostgreSQL with npm run db:start first.");
  process.exit(1);
}

async function main() {

function withDatabase(name: string) {
  const url = new URL(baseUrl!);
  url.pathname = `/${name}`;
  process.env.DATABASE_URL = url.toString();
}

async function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

withDatabase("ks_abroad");
const { migratePortalJson } = await import("@/lib/portal-store/migrate");
const { sql, closeDatabase, databaseUrl } = await import("@/lib/portal-store/db");

const first = await migratePortalJson();
const second = await migratePortalJson();
const unresolved = await sql()<{ source: string; record_id: string }[]>`
  SELECT source, record_id FROM unresolved_records ORDER BY source, record_id
`;
const studentCount = await sql()<{ count: string }[]>`SELECT count(*)::text AS count FROM students`;
const applicationCount = await sql()<{ count: string }[]>`SELECT count(*)::text AS count FROM applications`;
const caseCount = await sql()<{ count: string }[]>`SELECT count(*)::text AS count FROM consultancy_cases`;
assert(unresolved.length === 3, "unresolved table should keep all three raw records");
assert(Number(studentCount[0]?.count) === 0, "students table should stay empty");
assert(Number(applicationCount[0]?.count) === 0, "applications table should not receive orphans");
assert(Number(caseCount[0]?.count) === 0, "consultancy table should not receive orphans");
assert(second.orphanRecords === 0, "second migration should not insert the orphans again");
assert(second.duplicateRecordsSkipped === 3, "second migration should skip the same orphan records");
await closeDatabase();

withDatabase("ks_abroad_test");
const { upsertStudent, getStudentByEmail, getStudentById, removeStudent, toPublic } = await import("@/lib/students");
const { addShortlistItem, listShortlist, removeShortlistItem } = await import("@/lib/portal-store/shortlist");
const { createCase, getCasesForStudent, addStudentReply, getCaseById } = await import("@/lib/consultancy");
const { insertApplication, listApplicationsForStudent, patchApplicationStatus } = await import("@/lib/portal-store/applications");
const { getDatasetFresh } = await import("@/lib/data");
const { buildDegreeCatalogue } = await import("@/lib/programme-catalogue");
const { EMPTY_PROFILE } = await import("@/lib/student-types");

for (const email of ["portal-a@example.com", "portal-b@example.com"]) {
  const existing = await getStudentByEmail(email);
  if (existing) await removeStudent(existing.id);
}

const password = "PortalCheck1";
const hash = await hashPassword(password);
const now = new Date().toISOString();
const studentA = await upsertStudent({
  id: crypto.randomUUID(),
  email: "portal-a@example.com",
  passwordHash: hash,
  name: "Portal",
  surname: "A",
  dateOfBirth: "2000-01-01",
  placeOfBirth: "Lahore",
  passportOrCnic: "TEST-A",
  phone: "+920000000001",
  currentCity: "Lahore",
  address: "Test address A",
  createdAt: now,
  profile: { ...EMPTY_PROFILE, field: "Economics" },
  documents: [],
  shortlist: [],
});
const studentB = await upsertStudent({
  id: crypto.randomUUID(),
  email: "portal-b@example.com",
  passwordHash: hash,
  name: "Portal",
  surname: "B",
  dateOfBirth: "2000-01-02",
  placeOfBirth: "Karachi",
  passportOrCnic: "TEST-B",
  phone: "+920000000002",
  currentCity: "Karachi",
  address: "Test address B",
  createdAt: now,
  profile: { ...EMPTY_PROFILE },
  documents: [],
  shortlist: [],
});

const updated = await upsertStudent({ ...studentA, profile: { ...studentA.profile, field: "Business" } });
assert(updated.profile.field === "Business", "profile update should persist");
const reread = await getStudentById(studentA.id);
assert(reread?.profile.field === "Business", "profile should survive a fresh read");
assert(!("passwordHash" in toPublic(reread!)), "public student must omit the password hash");

const login = await getStudentByEmail("portal-a@example.com");
if (!login || !(await verifyPassword(password, login.passwordHash))) {
  throw new Error("login should verify the stored password");
}
const token = createSessionToken(login.id);
assert(readSessionToken(token) === login.id, "session token should resolve the same student");
assert(readSessionToken("") === null, "cleared session should not resolve a student");

const slug = "roma-tre-bachelor-international-studies";
const catalogue = buildDegreeCatalogue(await getDatasetFresh());
const programme = catalogue.find((row) => row.slug === slug);
assert(programme?.name && programme.deadlineLabel, "catalogue still supplies programme details");
const saved = await addShortlistItem(studentA.id, slug);
assert(saved && "entries" in saved && saved.entries.length === 1, "shortlist create should store one slug");
const again = await addShortlistItem(studentA.id, slug);
assert(again && "duplicate" in again && again.duplicate === true, "duplicate save should not create a second row");
const listed = await listShortlist(studentA.id);
assert(listed?.length === 1 && listed[0]?.slug === slug, "shortlist read should return only the catalogue slug");
const removed = await removeShortlistItem(studentA.id, slug);
assert(removed?.length === 0, "shortlist delete should remove the row");
const otherList = await listShortlist(studentB.id);
assert(otherList?.length === 0, "user B must not see user A's shortlist");

const opened = await createCase({
  studentId: studentA.id,
  type: "private-case",
  topic: "Test case",
  message: "Persistence check",
});
const replied = await addStudentReply(opened.id, studentA.id, "Follow up");
assert(replied?.replies.length === 1, "consultancy reply should persist");
const foreignReply = await addStudentReply(opened.id, studentB.id, "Not allowed");
assert(foreignReply === null, "user B must not reply on user A's case");
const hidden = await getCaseById(opened.id);
assert(hidden?.studentId === studentA.id, "case stays owned by user A");
const bCases = await getCasesForStudent(studentB.id);
assert(bCases.length === 0, "user B must not list user A's consultancy case");

const { studentHasActiveConsultancy } = await import("@/lib/applications");
assert(await studentHasActiveConsultancy(studentA.id), "an open consultancy case unlocks applications");
assert(!(await studentHasActiveConsultancy(studentB.id)), "user B has no consultancy case");
const dataset = await getDatasetFresh();
const uni = dataset.universities.find((row) => row.id === "university-of-cassino");
assert(uni, "catalogue university should exist");
if (!uni) throw new Error("catalogue university should exist");
const nowApp = new Date().toISOString();
const applicationId = crypto.randomUUID();
const application = await insertApplication({
  id: applicationId,
  studentId: studentA.id,
  universityId: uni.id,
  universityName: uni.name,
  programName: "Economics and Business",
  level: "bachelor",
  portalUrl: uni.admissionPortal,
  consultancyCaseId: opened.id,
  status: "requested",
  staffNote: "",
  createdAt: nowApp,
  updatedAt: nowApp,
  history: [{ at: nowApp, status: "requested", by: "student", note: "Persistence check" }],
});
assert(application?.studentId === studentA.id, "application create should belong to user A");
const changed = await patchApplicationStatus({ id: applicationId, status: "reviewing", staffNote: "Checked" });
assert(changed?.status === "reviewing" && changed.history.length === 2, "application status should append history");
assert(changed?.programName === "Economics and Business" && !("programs" in (changed ?? {})), "application stores the requested name, not a programme copy");
const aApps = await listApplicationsForStudent(studentA.id);
const bApps = await listApplicationsForStudent(studentB.id);
assert(aApps.length === 1 && bApps.length === 0, "user B must not read user A's application");

await removeStudent(studentA.id);
await removeStudent(studentB.id);
assert((await getStudentById(studentA.id)) === undefined, "deleted student should be gone");
assert((await getCasesForStudent(studentA.id)).length === 0, "deleted student's cases should be gone");
assert((await listApplicationsForStudent(studentA.id)).length === 0, "deleted student's applications should be gone");

const savedUrl = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;
let missing = false;
try {
  databaseUrl();
} catch {
  missing = true;
}
assert(missing, "missing DATABASE_URL must fail closed");
process.env.DATABASE_URL = "file:///tmp/students.json";
let fileUrl = false;
try {
  databaseUrl();
} catch {
  fileUrl = true;
}
assert(fileUrl, "a file path must not be accepted as the database");
process.env.DATABASE_URL = savedUrl;

await closeDatabase();
console.log(JSON.stringify({
  ok: true,
  migration: {
    studentsImported: first.studentsImported,
    applicationsImported: first.applicationsImported,
    consultancyCasesImported: first.consultancyCasesImported,
    orphanRecordsStored: unresolved.length,
    duplicateRecordsSkippedOnRerun: second.duplicateRecordsSkipped,
    manualReviewRequired: Math.max(first.manualReviewRequired, unresolved.length),
    unresolved: unresolved.map((row) => ({ source: row.source, recordId: row.record_id })),
  },
}, null, 2));
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  const { closeDatabase } = await import("@/lib/portal-store/db");
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
