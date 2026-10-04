import type { ApplicationStatus, ApplicationStatusEvent, StudentApplication } from "@/lib/application-types";
import { ensureSchema, sql } from "@/lib/portal-store/db";

type ApplicationRow = {
  id: string;
  student_id: string;
  university_id: string;
  university_name: string;
  program_name: string;
  programme_slug: string | null;
  level: StudentApplication["level"];
  portal_url: string;
  consultancy_case_id: string | null;
  status: ApplicationStatus;
  staff_note: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type EventRow = {
  id: string;
  application_id: string;
  at: Date | string;
  status: ApplicationStatus;
  by_role: ApplicationStatusEvent["by"];
  note: string | null;
};

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapApplication(row: ApplicationRow, events: EventRow[]): StudentApplication {
  return {
    id: row.id,
    studentId: row.student_id,
    universityId: row.university_id,
    universityName: row.university_name,
    programName: row.program_name,
    level: row.level || "",
    portalUrl: row.portal_url,
    consultancyCaseId: row.consultancy_case_id,
    status: row.status,
    staffNote: row.staff_note ?? "",
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    history: events
      .filter((event) => event.application_id === row.id)
      .map((event) => ({
        at: iso(event.at),
        status: event.status,
        by: event.by_role,
        note: event.note || undefined,
      })),
  };
}

async function eventsFor(ids: string[]) {
  if (!ids.length) return [] as EventRow[];
  const db = sql();
  return db<EventRow[]>`
    SELECT id, application_id, at, status, by_role, note
    FROM application_events
    WHERE application_id IN ${db(ids)}
    ORDER BY at ASC
  `;
}

export async function listApplications(): Promise<StudentApplication[]> {
  await ensureSchema();
  const rows = await sql()<ApplicationRow[]>`
    SELECT *
    FROM applications
    ORDER BY updated_at DESC
  `;
  const events = await eventsFor(rows.map((row) => row.id));
  return rows.map((row) => mapApplication(row, events));
}

export async function listApplicationsForStudent(studentId: string) {
  await ensureSchema();
  const rows = await sql()<ApplicationRow[]>`
    SELECT *
    FROM applications
    WHERE student_id = ${studentId}
    ORDER BY updated_at DESC
  `;
  const events = await eventsFor(rows.map((row) => row.id));
  return rows.map((row) => mapApplication(row, events));
}

export async function findApplication(id: string) {
  await ensureSchema();
  const rows = await sql()<ApplicationRow[]>`
    SELECT * FROM applications WHERE id = ${id}
  `;
  const row = rows[0];
  if (!row) return null;
  const events = await eventsFor([row.id]);
  return mapApplication(row, events);
}

export async function insertApplication(application: StudentApplication) {
  await ensureSchema();
  const db = sql();
  await db.begin(async (tx) => {
    await tx`
      INSERT INTO applications (
        id, student_id, university_id, university_name, program_name, programme_slug,
        level, portal_url, consultancy_case_id, status, staff_note, created_at, updated_at
      ) VALUES (
        ${application.id},
        ${application.studentId},
        ${application.universityId},
        ${application.universityName},
        ${application.programName},
        ${null},
        ${application.level || ""},
        ${application.portalUrl},
        ${application.consultancyCaseId},
        ${application.status},
        ${application.staffNote},
        ${application.createdAt},
        ${application.updatedAt}
      )
    `;
    for (const event of application.history) {
      await tx`
        INSERT INTO application_events (id, application_id, at, status, by_role, note)
        VALUES (
          ${crypto.randomUUID()},
          ${application.id},
          ${event.at},
          ${event.status},
          ${event.by},
          ${event.note ?? null}
        )
      `;
    }
  });
  return findApplication(application.id);
}

export async function patchApplicationStatus(input: {
  id: string;
  status: ApplicationStatus;
  staffNote?: string;
}) {
  await ensureSchema();
  const now = new Date().toISOString();
  const note = input.staffNote?.trim() || null;
  const updated = await sql().begin(async (tx) => {
    const rows =
      input.staffNote !== undefined
        ? await tx<{ id: string }[]>`
            UPDATE applications
            SET status = ${input.status}, staff_note = ${input.staffNote}, updated_at = ${now}
            WHERE id = ${input.id}
            RETURNING id
          `
        : await tx<{ id: string }[]>`
            UPDATE applications
            SET status = ${input.status}, updated_at = ${now}
            WHERE id = ${input.id}
            RETURNING id
          `;
    if (!rows.length) return false;
    await tx`
      INSERT INTO application_events (id, application_id, at, status, by_role, note)
      VALUES (${crypto.randomUUID()}, ${input.id}, ${now}, ${input.status}, ${"staff"}, ${note})
    `;
    return true;
  });
  if (!updated) return null;
  return findApplication(input.id);
}
