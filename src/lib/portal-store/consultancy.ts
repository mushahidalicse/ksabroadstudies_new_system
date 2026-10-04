import type { ConsultancyCase, ConsultancyReply, ConsultancyStatus, ConsultancyType } from "@/lib/consultancy-types";
import { ensureSchema, sql } from "@/lib/portal-store/db";

type CaseRow = {
  id: string;
  student_id: string;
  type: ConsultancyType;
  topic: string;
  message: string;
  status: ConsultancyStatus;
  created_at: Date | string;
};

type ReplyRow = {
  case_id: string;
  at: Date | string;
  from_role: ConsultancyReply["from"];
  body: string;
};

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapCase(row: CaseRow, replies: ReplyRow[]): ConsultancyCase {
  return {
    id: row.id,
    studentId: row.student_id,
    type: row.type,
    topic: row.topic,
    message: row.message,
    status: row.status,
    createdAt: iso(row.created_at),
    replies: replies
      .filter((reply) => reply.case_id === row.id)
      .map((reply) => ({
        at: iso(reply.at),
        from: reply.from_role,
        body: reply.body,
      })),
  };
}

async function repliesFor(ids: string[]) {
  if (!ids.length) return [] as ReplyRow[];
  const db = sql();
  return db<ReplyRow[]>`
    SELECT case_id, at, from_role, body
    FROM consultancy_replies
    WHERE case_id IN ${db(ids)}
    ORDER BY at ASC
  `;
}

export async function listCases(): Promise<ConsultancyCase[]> {
  await ensureSchema();
  const rows = await sql()<CaseRow[]>`
    SELECT * FROM consultancy_cases ORDER BY created_at DESC
  `;
  const replies = await repliesFor(rows.map((row) => row.id));
  return rows.map((row) => mapCase(row, replies));
}

export async function listCasesForStudent(studentId: string) {
  await ensureSchema();
  const rows = await sql()<CaseRow[]>`
    SELECT * FROM consultancy_cases
    WHERE student_id = ${studentId}
    ORDER BY created_at DESC
  `;
  const replies = await repliesFor(rows.map((row) => row.id));
  return rows.map((row) => mapCase(row, replies));
}

export async function findCase(id: string) {
  await ensureSchema();
  const rows = await sql()<CaseRow[]>`SELECT * FROM consultancy_cases WHERE id = ${id}`;
  const row = rows[0];
  if (!row) return undefined;
  const replies = await repliesFor([row.id]);
  return mapCase(row, replies);
}

export async function insertCase(input: {
  studentId: string;
  type: ConsultancyType;
  topic: string;
  message: string;
}) {
  await ensureSchema();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await sql()`
    INSERT INTO consultancy_cases (id, student_id, type, topic, message, status, created_at)
    VALUES (
      ${id},
      ${input.studentId},
      ${input.type},
      ${input.topic},
      ${input.message},
      ${"open"},
      ${createdAt}
    )
  `;
  return findCase(id);
}

export async function insertReply(caseId: string, studentId: string | null, body: string, from: ConsultancyReply["from"]) {
  await ensureSchema();
  const db = sql();
  const saved = await db.begin(async (tx) => {
    const rows = await tx<CaseRow[]>`
      SELECT * FROM consultancy_cases WHERE id = ${caseId} FOR UPDATE
    `;
    const row = rows[0];
    if (!row) return false;
    if (studentId && row.student_id !== studentId) return false;
    await tx`
      INSERT INTO consultancy_replies (id, case_id, at, from_role, body)
      VALUES (${crypto.randomUUID()}, ${caseId}, ${new Date().toISOString()}, ${from}, ${body})
    `;
    if (from === "student" && row.status === "closed") {
      await tx`UPDATE consultancy_cases SET status = ${"open"} WHERE id = ${caseId}`;
    }
    if (from === "staff" && row.status === "open") {
      await tx`UPDATE consultancy_cases SET status = ${"in_progress"} WHERE id = ${caseId}`;
    }
    return true;
  });
  if (!saved) return null;
  return findCase(caseId);
}

export async function setCaseStatus(caseId: string, status: ConsultancyStatus) {
  await ensureSchema();
  const rows = await sql()<{ id: string }[]>`
    UPDATE consultancy_cases SET status = ${status} WHERE id = ${caseId} RETURNING id
  `;
  if (!rows.length) return null;
  return findCase(caseId);
}
