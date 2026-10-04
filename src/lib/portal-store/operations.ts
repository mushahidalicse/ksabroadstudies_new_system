import { ensureSchema, sql } from "@/lib/portal-store/db";

export const REVIEW_STATUSES = ["pending", "accepted", "needs_replacement", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export type DocumentQueueItem = {
  id: string;
  studentId: string;
  studentName: string;
  email: string;
  kind: string;
  originalName: string;
  uploadedAt: string;
  status: ReviewStatus;
  note: string;
};

const DEFAULT_SERVICES = [
  { id: "one-to-one", kicker: "Counselling", title: "1-to-1 Profile Evaluation & Shortlist Discussion", detail: "A private session to settle the shortlist, scholarship window, and English proof.", consultancyType: "one-to-one", sortOrder: 1 },
  { id: "cimea", kicker: "Documents", title: "Document Verification & CIMEA Review", detail: "We check the vault and the CIMEA statement path before filing.", consultancyType: "private-case", sortOrder: 2 },
  { id: "admission", kicker: "Admission", title: "Complete Assisted Admission & Universitaly Pre-enrolment", detail: "University filing and the Universitaly pre-enrolment step.", consultancyType: "private-case", sortOrder: 3 },
  { id: "visa-desk", kicker: "Visa", title: "Embassy Visa File Preparation (FBR Tax, Health Insurance, Flight, Hotel)", detail: "FBR tax returns, health insurance, hotel booking, and the flight ticket for the embassy file.", consultancyType: "private-case", sortOrder: 4 },
] as const;

export type CatalogService = {
  id: string;
  kicker: string;
  title: string;
  detail: string;
  consultancyType: "one-to-one" | "private-case";
  active: boolean;
  sortOrder: number;
};

function status(value: string): ReviewStatus {
  return (REVIEW_STATUSES as readonly string[]).includes(value) ? value as ReviewStatus : "pending";
}

export async function listDocumentQueue(kind?: string) {
  await ensureSchema();
  const rows = await sql()<{
    id: string;
    student_id: string;
    student_name: string;
    email: string;
    kind: string;
    original_name: string;
    uploaded_at: Date | string;
    status: string | null;
    note: string | null;
  }[]>`
    SELECT d.id, d.student_id, trim(s.name || ' ' || s.surname) AS student_name, s.email,
      d.kind, d.original_name, d.uploaded_at, r.status, r.note
    FROM student_documents d
    JOIN students s ON s.id = d.student_id
    LEFT JOIN document_reviews r ON r.document_id = d.id
    WHERE ${kind ? sql()`d.kind = ${kind}` : sql()`TRUE`}
    ORDER BY d.uploaded_at DESC
    LIMIT 200
  `;
  return rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    email: row.email,
    kind: row.kind,
    originalName: row.original_name,
    uploadedAt: row.uploaded_at instanceof Date ? row.uploaded_at.toISOString() : new Date(row.uploaded_at).toISOString(),
    status: status(row.status ?? "pending"),
    note: row.note ?? "",
  }));
}

export async function reviewDocument(input: { documentId: string; status: ReviewStatus; note: string; reviewer: string }) {
  await ensureSchema();
  const found = await sql()<{ id: string; kind: string }[]>`SELECT id, kind FROM student_documents WHERE id = ${input.documentId}`;
  if (!found[0]) return null;
  await sql()`
    INSERT INTO document_reviews (document_id, status, note, reviewer, updated_at)
    VALUES (${input.documentId}, ${input.status}, ${input.note}, ${input.reviewer}, ${new Date().toISOString()})
    ON CONFLICT (document_id) DO UPDATE SET
      status = EXCLUDED.status,
      note = EXCLUDED.note,
      reviewer = EXCLUDED.reviewer,
      updated_at = EXCLUDED.updated_at
  `;
  return found[0];
}

export async function currentReviewStatus(documentId: string) {
  await ensureSchema();
  const rows = await sql()<{ status: string }[]>`SELECT status FROM document_reviews WHERE document_id = ${documentId}`;
  return rows[0]?.status ?? "pending";
}

export async function documentFile(id: string) {
  await ensureSchema();
  const rows = await sql()<{
    id: string;
    student_id: string;
    kind: string;
    original_name: string;
    stored_name: string;
  }[]>`
    SELECT id, student_id, kind, original_name, stored_name
    FROM student_documents WHERE id = ${id}
  `;
  return rows[0] ?? null;
}

export async function reviewsForStudent(studentId: string) {
  await ensureSchema();
  const rows = await sql()<{ document_id: string; status: string; note: string }[]>`
    SELECT r.document_id, r.status, r.note
    FROM document_reviews r
    JOIN student_documents d ON d.id = r.document_id
    WHERE d.student_id = ${studentId}
  `;
  return rows.map((row) => ({ documentId: row.document_id, status: status(row.status), note: row.note }));
}

export async function ensureServiceCatalog() {
  await ensureSchema();
  const existing = await sql()<{ count: string }[]>`SELECT count(*)::text AS count FROM service_catalog`;
  if (Number(existing[0]?.count ?? 0) > 0) return;
  for (const service of DEFAULT_SERVICES) {
    await sql()`
      INSERT INTO service_catalog (id, kicker, title, detail, consultancy_type, active, sort_order)
      VALUES (${service.id}, ${service.kicker}, ${service.title}, ${service.detail}, ${service.consultancyType}, ${true}, ${service.sortOrder})
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

export async function listServices(activeOnly = false): Promise<CatalogService[]> {
  await ensureServiceCatalog();
  const rows = await sql()<{
    id: string;
    kicker: string;
    title: string;
    detail: string;
    consultancy_type: string;
    active: boolean;
    sort_order: number;
  }[]>`
    SELECT id, kicker, title, detail, consultancy_type, active, sort_order
    FROM service_catalog
    WHERE ${activeOnly ? sql()`active = true` : sql()`TRUE`}
    ORDER BY sort_order ASC
  `;
  return rows.map((row) => ({
    id: row.id,
    kicker: row.kicker,
    title: row.title,
    detail: row.detail,
    consultancyType: row.consultancy_type === "one-to-one" ? "one-to-one" : "private-case",
    active: row.active,
    sortOrder: row.sort_order,
  }));
}

export async function updateService(input: { id: string; kicker: string; title: string; detail: string; active: boolean }) {
  await ensureServiceCatalog();
  const rows = await sql()<{ id: string }[]>`
    UPDATE service_catalog
    SET kicker = ${input.kicker}, title = ${input.title}, detail = ${input.detail}, active = ${input.active}
    WHERE id = ${input.id}
    RETURNING id
  `;
  return rows.length > 0;
}
