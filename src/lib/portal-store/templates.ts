import { ensureSchema, sql } from "@/lib/portal-store/db";

const DEFAULT_TEMPLATES = [
  ["Document replacement request", "document", "Document needs replacement", "Please replace {{student_name}}'s document and check the review note."],
  ["Application submitted", "application", "Application update", "Your application for {{programme_name}} at {{university_name}} has been submitted."],
  ["Admission received", "application", "Admission update", "There is an admission update for {{programme_name}} at {{university_name}}."],
  ["Pre-enrolment pending", "application", "Pre-enrolment", "Pre-enrolment for {{programme_name}} is still pending. The deadline on file is {{deadline}}."],
  ["Visa document request", "document", "Visa document", "Please upload the visa document we discussed for {{programme_name}}."],
  ["Payment proof accepted", "payment", "Payment proof accepted", "Your payment proof has been accepted."],
  ["Payment proof rejected", "payment", "Payment proof needs attention", "Your payment proof was not accepted. Please upload a new screenshot."],
  ["Consultation follow-up", "consultancy", "Consultancy follow-up", "This is a follow-up from {{case_officer}} about your consultancy case."],
] as const;

export type MessageTemplate = {
  id: string;
  name: string;
  category: string;
  title: string;
  body: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function ensureTemplates() {
  await ensureSchema();
  const existing = await sql()<{ count: string }[]>`SELECT count(*)::text AS count FROM message_templates`;
  if (Number(existing[0]?.count ?? 0) > 0) return;
  const now = new Date().toISOString();
  for (const [name, category, title, body] of DEFAULT_TEMPLATES) {
    await sql()`
      INSERT INTO message_templates (id, name, category, title, body, active, created_at, updated_at)
      VALUES (${crypto.randomUUID()}, ${name}, ${category}, ${title}, ${body}, ${true}, ${now}, ${now})
    `;
  }
}

export async function listTemplates(activeOnly = false): Promise<MessageTemplate[]> {
  await ensureTemplates();
  const rows = await sql()<{
    id: string;
    name: string;
    category: string;
    title: string;
    body: string;
    active: boolean;
    created_at: Date | string;
    updated_at: Date | string;
  }[]>`
    SELECT id, name, category, title, body, active, created_at, updated_at
    FROM message_templates
    WHERE ${activeOnly ? sql()`active = true` : sql()`TRUE`}
    ORDER BY name ASC
  `;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    title: row.title,
    body: row.body,
    active: row.active,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }));
}

export async function saveTemplate(input: { id?: string; name: string; category: string; title: string; body: string; active: boolean }) {
  await ensureTemplates();
  const now = new Date().toISOString();
  if (input.id) {
    const rows = await sql()<{ id: string }[]>`
      UPDATE message_templates
      SET name = ${input.name}, category = ${input.category}, title = ${input.title}, body = ${input.body},
        active = ${input.active}, updated_at = ${now}
      WHERE id = ${input.id}
      RETURNING id
    `;
    return rows[0]?.id ?? null;
  }
  const id = crypto.randomUUID();
  await sql()`
    INSERT INTO message_templates (id, name, category, title, body, active, created_at, updated_at)
    VALUES (${id}, ${input.name}, ${input.category}, ${input.title}, ${input.body}, ${input.active}, ${now}, ${now})
  `;
  return id;
}
