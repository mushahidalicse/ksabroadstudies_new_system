import { promises as fs } from "fs";
import path from "path";
import type { StudentApplication } from "@/lib/application-types";
import type { ConsultancyCase } from "@/lib/consultancy-types";
import { ensureSchema, sql } from "@/lib/portal-store/db";
import type { ShortlistEntry, StudentDocument, StudentRecord } from "@/lib/student-types";

export type MigrationReport = {
  backupDir: string;
  studentsImported: number;
  applicationsImported: number;
  consultancyCasesImported: number;
  shortlistItemsImported: number;
  documentsImported: number;
  orphanRecords: number;
  duplicateRecordsSkipped: number;
  manualReviewRequired: number;
  notes: string[];
};

function dataDir() {
  return path.join(process.cwd(), "data");
}

async function readArray<T>(file: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error(`${path.basename(file)} is not a JSON array.`);
    }
    return parsed as T[];
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw error;
  }
}

function validStudent(row: StudentRecord) {
  return Boolean(row && typeof row.id === "string" && row.id && typeof row.email === "string" && row.email && typeof row.passwordHash === "string" && row.passwordHash);
}

async function backup(files: string[]) {
  const dir = path.join(dataDir(), "migration-backups", new Date().toISOString().replace(/[:.]/g, "-"));
  await fs.mkdir(dir, { recursive: true });
  for (const file of files) {
    try {
      await fs.copyFile(file, path.join(dir, path.basename(file)));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
      await fs.writeFile(path.join(dir, path.basename(file) + ".missing"), "source file was not present\n");
    }
  }
  return dir;
}

export async function migratePortalJson(): Promise<MigrationReport> {
  const root = dataDir();
  const studentsPath = path.join(root, "students.json");
  const applicationsPath = path.join(root, "applications.json");
  const casesPath = path.join(root, "consultancy-cases.json");
  const backupDir = await backup([studentsPath, applicationsPath, casesPath]);

  const students = await readArray<StudentRecord>(studentsPath);
  const applications = await readArray<StudentApplication>(applicationsPath);
  const cases = await readArray<ConsultancyCase>(casesPath);

  const report: MigrationReport = {
    backupDir,
    studentsImported: 0,
    applicationsImported: 0,
    consultancyCasesImported: 0,
    shortlistItemsImported: 0,
    documentsImported: 0,
    orphanRecords: 0,
    duplicateRecordsSkipped: 0,
    manualReviewRequired: 0,
    notes: [
      "Source JSON files were copied and left in place.",
      "Orphan rows were stored in unresolved_records and were not attached to a new student.",
    ],
  };

  await ensureSchema();
  const db = sql();
  await db.begin(async (tx) => {
    const existing = await tx<{ id: string }[]>`SELECT id FROM students`;
    const studentIds = new Set(existing.map((row) => row.id));

    for (const student of students) {
      if (!validStudent(student)) {
        const inserted = await tx<{ id: string }[]>`
          INSERT INTO unresolved_records (id, source, record_id, reason, raw)
          VALUES (
            ${crypto.randomUUID()},
            ${"students.json"},
            ${typeof student?.id === "string" ? student.id : "missing-id"},
            ${"Student record is missing id, email, or password hash. No fields were invented."},
            ${db.json(student)}
          )
          ON CONFLICT (source, record_id) DO NOTHING
          RETURNING id
        `;
        if (inserted.length) {
          report.orphanRecords += 1;
          report.manualReviewRequired += 1;
        } else report.duplicateRecordsSkipped += 1;
        continue;
      }
      const emailTaken = await tx<{ id: string }[]>`
        SELECT id FROM students WHERE lower(email) = lower(${student.email}) AND id <> ${student.id}
      `;
      if (emailTaken.length) {
        const held = await tx<{ id: string }[]>`
          INSERT INTO unresolved_records (id, source, record_id, reason, raw)
          VALUES (
            ${crypto.randomUUID()},
            ${"students.json"},
            ${student.id},
            ${"Email is already used by a different student id. This row was not merged and was not given a new identity."},
            ${db.json({ id: student.id, email: student.email })}
          )
          ON CONFLICT (source, record_id) DO NOTHING
          RETURNING id
        `;
        if (held.length) report.manualReviewRequired += 1;
        else report.duplicateRecordsSkipped += 1;
        continue;
      }
      const inserted = await tx<{ id: string }[]>`
        INSERT INTO students (
          id, email, password_hash, name, surname, date_of_birth, place_of_birth,
          passport_or_cnic, phone, current_city, address, profile, consent, created_at, updated_at
        ) VALUES (
          ${student.id},
          ${student.email.trim().toLowerCase()},
          ${student.passwordHash},
          ${student.name ?? ""},
          ${student.surname ?? ""},
          ${student.dateOfBirth ?? ""},
          ${student.placeOfBirth ?? ""},
          ${student.passportOrCnic ?? ""},
          ${student.phone ?? ""},
          ${student.currentCity ?? ""},
          ${student.address ?? ""},
          ${db.json(student.profile ?? {})},
          ${student.consent ? db.json(student.consent) : null},
          ${student.createdAt || new Date().toISOString()},
          ${student.createdAt || new Date().toISOString()}
        )
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `;
      if (!inserted.length) {
        report.duplicateRecordsSkipped += 1;
        studentIds.add(student.id);
        continue;
      }
      report.studentsImported += 1;
      studentIds.add(student.id);
      const seen = new Set<string>();
      for (const item of (student.shortlist ?? []) as ShortlistEntry[]) {
        if (!item || typeof item.slug !== "string" || typeof item.savedAt !== "string") continue;
        if (seen.has(item.slug)) {
          report.duplicateRecordsSkipped += 1;
          continue;
        }
        seen.add(item.slug);
        await tx`
          INSERT INTO shortlist_items (id, student_id, programme_slug, saved_at)
          VALUES (${crypto.randomUUID()}, ${student.id}, ${item.slug}, ${item.savedAt})
          ON CONFLICT (student_id, programme_slug) DO NOTHING
        `;
        report.shortlistItemsImported += 1;
      }
      for (const doc of (student.documents ?? []) as StudentDocument[]) {
        if (!doc?.id || !doc.storedName) continue;
        const docInserted = await tx<{ id: string }[]>`
          INSERT INTO student_documents (id, student_id, kind, original_name, stored_name, uploaded_at)
          VALUES (
            ${doc.id},
            ${student.id},
            ${doc.kind},
            ${doc.originalName || "document"},
            ${doc.storedName},
            ${doc.uploadedAt || student.createdAt}
          )
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `;
        if (docInserted.length) report.documentsImported += 1;
        else report.duplicateRecordsSkipped += 1;
      }
    }

    for (const row of cases) {
      const recordId = typeof row?.id === "string" ? row.id : "missing-id";
      if (!row?.id || !row.studentId || !studentIds.has(row.studentId)) {
        const inserted = await tx<{ id: string }[]>`
          INSERT INTO unresolved_records (id, source, record_id, reason, raw)
          VALUES (
            ${crypto.randomUUID()},
            ${"consultancy-cases.json"},
            ${recordId},
            ${"Consultancy case student id is not in students.json or the students table. The raw case was kept and was not linked to a guessed student."},
            ${db.json(row)}
          )
          ON CONFLICT (source, record_id) DO NOTHING
          RETURNING id
        `;
        if (inserted.length) {
          report.orphanRecords += 1;
          report.manualReviewRequired += 1;
        } else report.duplicateRecordsSkipped += 1;
        continue;
      }
      const inserted = await tx<{ id: string }[]>`
        INSERT INTO consultancy_cases (id, student_id, type, topic, message, status, created_at)
        VALUES (
          ${row.id},
          ${row.studentId},
          ${row.type},
          ${row.topic},
          ${row.message},
          ${row.status},
          ${row.createdAt}
        )
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `;
      if (!inserted.length) {
        report.duplicateRecordsSkipped += 1;
        continue;
      }
      report.consultancyCasesImported += 1;
      for (const reply of row.replies ?? []) {
        await tx`
          INSERT INTO consultancy_replies (id, case_id, at, from_role, body)
          VALUES (${crypto.randomUUID()}, ${row.id}, ${reply.at}, ${reply.from}, ${reply.body})
        `;
      }
    }

    const groups = new Map<string, string[]>();
    for (const row of applications) {
      const key = [row?.studentId, row?.universityId, row?.programName, row?.consultancyCaseId].join("|");
      const list = groups.get(key) ?? [];
      if (row?.id) list.push(row.id);
      groups.set(key, list);
    }

    for (const row of applications) {
      const recordId = typeof row?.id === "string" ? row.id : "missing-id";
      const key = [row?.studentId, row?.universityId, row?.programName, row?.consultancyCaseId].join("|");
      const siblings = groups.get(key) ?? [];
      const nearDuplicate = siblings.length > 1;
      if (!row?.id || !row.studentId || !studentIds.has(row.studentId)) {
        const reason = nearDuplicate
          ? "Application student id is missing from students. A second application has the same student, university, programme, and consultancy case. Both raw rows were kept for manual review."
          : "Application student id is not in students.json or the students table. The raw application was kept and was not linked to a guessed student.";
        const inserted = await tx<{ id: string }[]>`
          INSERT INTO unresolved_records (id, source, record_id, reason, raw)
          VALUES (
            ${crypto.randomUUID()},
            ${"applications.json"},
            ${recordId},
            ${reason},
            ${db.json(row)}
          )
          ON CONFLICT (source, record_id) DO NOTHING
          RETURNING id
        `;
        if (inserted.length) {
          report.orphanRecords += 1;
          report.manualReviewRequired += 1;
        } else report.duplicateRecordsSkipped += 1;
        continue;
      }
      if (row.consultancyCaseId) {
        const linked = await tx<{ id: string }[]>`
          SELECT id FROM consultancy_cases WHERE id = ${row.consultancyCaseId}
        `;
        if (!linked.length) {
          const held = await tx<{ id: string }[]>`
            INSERT INTO unresolved_records (id, source, record_id, reason, raw)
            VALUES (
              ${crypto.randomUUID()},
              ${"applications.json"},
              ${recordId},
              ${"Application references a consultancy case that is not stored for this student. The raw application was kept."},
              ${db.json(row)}
            )
            ON CONFLICT (source, record_id) DO NOTHING
            RETURNING id
          `;
          if (held.length) {
            report.orphanRecords += 1;
            report.manualReviewRequired += 1;
          } else report.duplicateRecordsSkipped += 1;
          continue;
        }
      }
      const inserted = await tx<{ id: string }[]>`
        INSERT INTO applications (
          id, student_id, university_id, university_name, program_name, programme_slug,
          level, portal_url, consultancy_case_id, status, staff_note, created_at, updated_at
        ) VALUES (
          ${row.id},
          ${row.studentId},
          ${row.universityId},
          ${row.universityName},
          ${row.programName},
          ${null},
          ${row.level || ""},
          ${row.portalUrl || ""},
          ${row.consultancyCaseId},
          ${row.status},
          ${row.staffNote || ""},
          ${row.createdAt},
          ${row.updatedAt}
        )
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `;
      if (!inserted.length) {
        report.duplicateRecordsSkipped += 1;
        continue;
      }
      report.applicationsImported += 1;
      if (nearDuplicate) {
        report.manualReviewRequired += 1;
        report.notes.push(`Application ${row.id} matches another request for the same student and programme.`);
      }
      for (const event of row.history ?? []) {
        await tx`
          INSERT INTO application_events (id, application_id, at, status, by_role, note)
          VALUES (
            ${crypto.randomUUID()},
            ${row.id},
            ${event.at},
            ${event.status},
            ${event.by},
            ${event.note ?? null}
          )
        `;
      }
    }
  });

  await fs.writeFile(path.join(backupDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}
