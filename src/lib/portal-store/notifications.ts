import { ensureSchema, sql } from "@/lib/portal-store/db";
import { deliverPortal } from "@/lib/notifications/provider";

export type StudentNotification = {
  id: string;
  studentId: string;
  type: string;
  title: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  createdByStaffId: string | null;
};

type Row = {
  id: string;
  student_id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: Date | string;
  read_at: Date | string | null;
  created_by_staff_id: string | null;
};

function iso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function map(row: Row): StudentNotification {
  return {
    id: row.id,
    studentId: row.student_id,
    type: row.type,
    title: row.title,
    message: row.message,
    link: row.link,
    isRead: row.is_read,
    createdAt: iso(row.created_at) ?? "",
    readAt: iso(row.read_at),
    createdByStaffId: row.created_by_staff_id,
  };
}

function uniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

export async function notifyStudent(input: {
  studentId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  staffId?: string | null;
  dedupeKey?: string;
}) {
  await ensureSchema();
  const key = (input.dedupeKey ?? "").slice(0, 180);
  if (key) {
    const existing = await sql()<Row[]>`
      SELECT id, student_id, type, title, message, link, is_read, created_at, read_at, created_by_staff_id
      FROM student_notifications
      WHERE student_id = ${input.studentId} AND dedupe_key = ${key}
    `;
    if (existing[0]) return { created: false, notification: map(existing[0]) };
  }
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  try {
    await sql()`
      INSERT INTO student_notifications (
        id, student_id, type, title, message, link, is_read, created_at, read_at, created_by_staff_id, dedupe_key
      ) VALUES (
        ${id}, ${input.studentId}, ${input.type}, ${input.title}, ${input.message}, ${input.link ?? ""},
        ${false}, ${createdAt}, ${null}, ${input.staffId ?? null}, ${key}
      )
    `;
  } catch (error) {
    if (key && uniqueViolation(error)) return { created: false, notification: null };
    throw error;
  }
  await deliverPortal({ studentId: input.studentId, title: input.title, message: input.message });
  return {
    created: true,
    notification: {
      id,
      studentId: input.studentId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? "",
      isRead: false,
      createdAt,
      readAt: null,
      createdByStaffId: input.staffId ?? null,
    } satisfies StudentNotification,
  };
}

export async function listNotifications(studentId: string) {
  await ensureSchema();
  const rows = await sql()<Row[]>`
    SELECT id, student_id, type, title, message, link, is_read, created_at, read_at, created_by_staff_id
    FROM student_notifications
    WHERE student_id = ${studentId}
    ORDER BY created_at DESC
    LIMIT 100
  `;
  return rows.map(map);
}

export async function unreadCount(studentId: string) {
  await ensureSchema();
  const rows = await sql()<{ count: string }[]>`
    SELECT count(*)::text AS count FROM student_notifications
    WHERE student_id = ${studentId} AND is_read = false
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function markRead(studentId: string, id: string) {
  await ensureSchema();
  const rows = await sql()<{ id: string }[]>`
    UPDATE student_notifications
    SET is_read = true, read_at = ${new Date().toISOString()}
    WHERE id = ${id} AND student_id = ${studentId}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function markAllRead(studentId: string) {
  await ensureSchema();
  await sql()`
    UPDATE student_notifications
    SET is_read = true, read_at = ${new Date().toISOString()}
    WHERE student_id = ${studentId} AND is_read = false
  `;
}

export async function recentNotifications(limit = 30) {
  await ensureSchema();
  const rows = await sql()<{
    id: string;
    student_id: string;
    student_name: string;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: Date | string;
    actor: string | null;
  }[]>`
    SELECT n.id, n.student_id, trim(s.name || ' ' || s.surname) AS student_name, n.type, n.title, n.message,
      n.is_read, n.created_at, COALESCE(st.name, st.email) AS actor
    FROM student_notifications n
    JOIN students s ON s.id = n.student_id
    LEFT JOIN staff_accounts st ON st.id = n.created_by_staff_id
    ORDER BY n.created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: row.is_read,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    actor: row.actor ?? "",
  }));
}
