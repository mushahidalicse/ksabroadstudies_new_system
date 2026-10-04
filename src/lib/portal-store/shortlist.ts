import type { TransactionSql } from "postgres";
import type { ShortlistEntry } from "@/lib/student-types";
import { ensureSchema, sql } from "@/lib/portal-store/db";

export const SHORTLIST_LIMIT = 40;

type Row = { programme_slug: string; saved_at: Date | string };

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRows(rows: Row[]): ShortlistEntry[] {
  return rows.map((row) => ({ slug: row.programme_slug, savedAt: iso(row.saved_at) }));
}

async function listIn(tx: TransactionSql, studentId: string) {
  const rows = await tx<Row[]>`
    SELECT programme_slug, saved_at
    FROM shortlist_items
    WHERE student_id = ${studentId}
    ORDER BY saved_at ASC
  `;
  return mapRows(rows);
}

export async function listShortlist(studentId: string): Promise<ShortlistEntry[] | null> {
  await ensureSchema();
  const db = sql();
  const student = await db<{ id: string }[]>`SELECT id FROM students WHERE id = ${studentId}`;
  if (!student.length) return null;
  const rows = await db<Row[]>`
    SELECT programme_slug, saved_at
    FROM shortlist_items
    WHERE student_id = ${studentId}
    ORDER BY saved_at ASC
  `;
  return mapRows(rows);
}

type AddResult =
  | { entries: ShortlistEntry[]; duplicate: boolean }
  | { error: "shortlist-full" }
  | null;

export async function addShortlistItem(studentId: string, slug: string): Promise<AddResult> {
  await ensureSchema();
  return sql().begin(async (tx) => {
    const locked = await tx<{ id: string }[]>`
      SELECT id FROM students WHERE id = ${studentId} FOR UPDATE
    `;
    if (!locked.length) return null;
    const current = await listIn(tx, studentId);
    if (current.some((entry) => entry.slug === slug)) {
      return { entries: current, duplicate: true as const };
    }
    if (current.length >= SHORTLIST_LIMIT) {
      return { error: "shortlist-full" as const };
    }
    const savedAt = new Date().toISOString();
    await tx`
      INSERT INTO shortlist_items (id, student_id, programme_slug, saved_at)
      VALUES (${crypto.randomUUID()}, ${studentId}, ${slug}, ${savedAt})
    `;
    return {
      entries: [...current, { slug, savedAt }],
      duplicate: false as const,
    };
  });
}

export async function removeShortlistItem(studentId: string, slug: string) {
  await ensureSchema();
  return sql().begin(async (tx) => {
    const locked = await tx<{ id: string }[]>`
      SELECT id FROM students WHERE id = ${studentId} FOR UPDATE
    `;
    if (!locked.length) return null;
    await tx`
      DELETE FROM shortlist_items
      WHERE student_id = ${studentId} AND programme_slug = ${slug}
    `;
    return listIn(tx, studentId);
  });
}

export async function mergeShortlistItems(studentId: string, slugs: string[]) {
  await ensureSchema();
  return sql().begin(async (tx) => {
    const locked = await tx<{ id: string }[]>`
      SELECT id FROM students WHERE id = ${studentId} FOR UPDATE
    `;
    if (!locked.length) return null;
    const current = await listIn(tx, studentId);
    const seen = new Set(current.map((entry) => entry.slug));
    const next = [...current];
    const now = new Date().toISOString();
    for (const slug of slugs) {
      if (seen.has(slug) || next.length >= SHORTLIST_LIMIT) continue;
      seen.add(slug);
      await tx`
        INSERT INTO shortlist_items (id, student_id, programme_slug, saved_at)
        VALUES (${crypto.randomUUID()}, ${studentId}, ${slug}, ${now})
        ON CONFLICT (student_id, programme_slug) DO NOTHING
      `;
      next.push({ slug, savedAt: now });
    }
    return next;
  });
}
