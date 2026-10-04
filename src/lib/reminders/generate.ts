import { promises as fs } from "fs";
import path from "path";
import { checklistForLevel, slotReady } from "@/lib/document-vault";
import { getDatasetFresh } from "@/lib/data";
import { documentLabel } from "@/lib/notifications/copy";
import { buildDegreeCatalogue, buildPhdCatalogue, type CatalogueCard } from "@/lib/programme-catalogue";
import { notifyStudent } from "@/lib/portal-store/notifications";
import { portalRemindersEnabled } from "@/lib/portal-store/preferences";
import { sql } from "@/lib/portal-store/db";
import type { PhdDataset } from "@/lib/phd-types";
import type { PublicStudent } from "@/lib/student-types";

export type ReminderProgramme = {
  slug: string;
  name: string;
  universityName: string;
  deadline: string | null;
  estimatedDeadline: boolean;
  finderStatus: string;
  aliasSlugs?: string[];
};

function localIso(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function daysUntil(iso: string, now: Date) {
  const [year, month, day] = iso.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

export function deadlineThreshold(days: number) {
  if (days < 0 || days > 14) return null;
  if (days >= 8) return 14;
  if (days >= 4) return 7;
  if (days >= 2) return 3;
  return 1;
}

export function deadlineReminderMessage(input: { name: string; universityName: string; days: number; dateType?: string }) {
  if (input.dateType && (/_open$/.test(input.dateType) || /^(enrolment_|immatriculation_)/.test(input.dateType))) return null;
  const when = input.days === 0 ? "closes today" : input.days === 1 ? "closes tomorrow" : `closes in ${input.days} days`;
  return `Your shortlisted programme ${input.name} at ${input.universityName} ${when}.`;
}

function programmeFromCard(card: CatalogueCard): ReminderProgramme {
  return {
    slug: card.slug,
    name: card.name,
    universityName: card.universityName,
    deadline: card.deadline,
    estimatedDeadline: card.estimatedDeadline,
    finderStatus: card.finderStatus,
    aliasSlugs: card.aliasSlugs ?? [],
  };
}

export async function loadLiveProgrammes(): Promise<ReminderProgramme[]> {
  const dataset = await getDatasetFresh();
  const phd = JSON.parse(await fs.readFile(path.join(process.cwd(), "src/data/phd.json"), "utf8")) as PhdDataset;
  const cards = [
    ...buildDegreeCatalogue(dataset),
    ...buildPhdCatalogue(phd.universities, { lastUpdated: phd.lastUpdated, academicYear: phd.academicYear }),
  ];
  return cards.filter((card) => card.listing !== "historical").map(programmeFromCard);
}

export async function generateReminders(input?: { now?: Date; programmes?: ReminderProgramme[]; onlyStudentIds?: string[] }) {
  const now = input?.now ?? new Date();
  const today = localIso(now);
  const programmes = input?.programmes ?? (await loadLiveProgrammes());
  const bySlug = new Map<string, ReminderProgramme>();
  for (const item of programmes) {
    bySlug.set(item.slug, item);
    for (const alias of item.aliasSlugs ?? []) bySlug.set(alias, item);
  }
  const reminded = new Set<string>();
  const allowed = input?.onlyStudentIds ? new Set(input.onlyStudentIds) : null;
  let created = 0;

  const shortlist = await sql()<{ student_id: string; programme_slug: string }[]>`
    SELECT student_id, programme_slug FROM shortlist_items
  `;
  for (const row of shortlist) {
    if (allowed && !allowed.has(row.student_id)) continue;
    const programme = bySlug.get(row.programme_slug);
    if (!programme) continue;
    const once = `${row.student_id}:${programme.slug}`;
    if (reminded.has(once)) continue;
    reminded.add(once);
    if (programme.estimatedDeadline) continue;
    if (programme.finderStatus !== "open" && programme.finderStatus !== "closing") continue;
    const iso = String(programme.deadline ?? "").match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    if (!iso) continue;
    const days = daysUntil(iso, now);
    const threshold = deadlineThreshold(days);
    if (!threshold) continue;
    if (!(await portalRemindersEnabled(row.student_id))) continue;
    const message = deadlineReminderMessage({ name: programme.name, universityName: programme.universityName, days });
    if (!message) continue;
    const result = await notifyStudent({
      studentId: row.student_id,
      type: "deadline_reminder",
      title: "Shortlist deadline",
      message,
      link: `/programs/p/${programme.slug}`,
      dedupeKey: `deadline:${row.programme_slug}:${threshold}`,
    });
    if (result.created) created += 1;
  }

  const replacements = await sql()<{ student_id: string; id: string; kind: string }[]>`
    SELECT d.student_id, d.id, d.kind
    FROM student_documents d
    JOIN document_reviews r ON r.document_id = d.id
    WHERE r.status = 'needs_replacement' AND d.kind <> 'payment-proof'
  `;
  for (const row of replacements) {
    if (allowed && !allowed.has(row.student_id)) continue;
    if (!(await portalRemindersEnabled(row.student_id))) continue;
    const label = documentLabel(row.kind).toLowerCase();
    const result = await notifyStudent({
      studentId: row.student_id,
      type: "document_replacement",
      title: `${documentLabel(row.kind)} needs replacement`,
      message: `Your ${label} needs to be replaced. Please check the review note.`,
      link: "/portal",
      dedupeKey: `review:${row.id}:needs_replacement`,
    });
    if (result.created) created += 1;
  }

  const students = await sql()<{ id: string; profile: { studyLevel?: string } }[]>`SELECT id, profile FROM students`;
  const documents = await sql()<{ student_id: string; kind: string }[]>`SELECT student_id, kind FROM student_documents`;
  const docsByStudent = new Map<string, { kind: string }[]>();
  for (const doc of documents) {
    const list = docsByStudent.get(doc.student_id) ?? [];
    list.push({ kind: doc.kind });
    docsByStudent.set(doc.student_id, list);
  }
  for (const student of students) {
    if (allowed && !allowed.has(student.id)) continue;
    const level = student.profile?.studyLevel ?? "";
    const slots = checklistForLevel(level as never).filter((slot) => slot.required);
    if (!slots.length) continue;
    const pretend = { documents: (docsByStudent.get(student.id) ?? []).map((doc) => ({ kind: doc.kind })) } as PublicStudent;
    const missing = slots.filter((slot) => !slotReady(pretend, slot));
    if (!missing.length) continue;
    if (!(await portalRemindersEnabled(student.id))) continue;
    const result = await notifyStudent({
      studentId: student.id,
      type: "missing_documents",
      title: "Documents still needed",
      message: `Some required documents are still missing: ${missing.map((slot) => slot.label).join(", ")}.`,
      link: "/portal",
      dedupeKey: `missing-docs:${student.id}`,
    });
    if (result.created) created += 1;
  }

  return { created, today };
}

export async function staffReminderCounts(now = new Date()) {
  const today = localIso(now);
  const programmes = await loadLiveProgrammes();
  const bySlug = new Map(programmes.map((item) => [item.slug, item]));
  const shortlist = await sql()<{ programme_slug: string }[]>`SELECT DISTINCT programme_slug FROM shortlist_items`;
  const closing = new Set<string>();
  for (const row of shortlist) {
    const programme = bySlug.get(row.programme_slug);
    if (!programme || programme.estimatedDeadline) continue;
    if (programme.finderStatus !== "open" && programme.finderStatus !== "closing") continue;
    const iso = String(programme.deadline ?? "").match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    if (!iso) continue;
    const days = daysUntil(iso, now);
    if (days >= 0 && days <= 7) closing.add(programme.slug);
  }
  const overdue = await sql()<{ count: string }[]>`
    SELECT count(*)::text AS count FROM crm_tasks
    WHERE status = 'open' AND due_date IS NOT NULL AND to_char(due_date, 'YYYY-MM-DD') < ${today}
  `;
  const dueToday = await sql()<{ count: string }[]>`
    SELECT count(*)::text AS count FROM (
      SELECT id FROM crm_tasks WHERE status = 'open' AND to_char(due_date, 'YYYY-MM-DD') = ${today}
      UNION ALL
      SELECT student_id FROM crm_cases WHERE next_action <> '' AND to_char(next_action_due, 'YYYY-MM-DD') = ${today}
    ) items
  `;
  const documents = await sql()<{ count: string }[]>`
    SELECT count(*)::text AS count
    FROM student_documents d
    LEFT JOIN document_reviews r ON r.document_id = d.id
    WHERE d.kind <> 'payment-proof' AND (r.status IS NULL OR r.status = 'pending')
  `;
  const payments = await sql()<{ count: string }[]>`
    SELECT count(*)::text AS count
    FROM student_documents d
    LEFT JOIN document_reviews r ON r.document_id = d.id
    WHERE d.kind = 'payment-proof' AND (r.status IS NULL OR r.status = 'pending')
  `;
  const unread = await sql()<{ count: string }[]>`
    SELECT count(*)::text AS count FROM student_notifications WHERE is_read = false
  `;
  return {
    overdueTasks: Number(overdue[0]?.count ?? 0),
    followUpsDueToday: Number(dueToday[0]?.count ?? 0),
    documentsNeedingReview: Number(documents[0]?.count ?? 0),
    paymentReviewsPending: Number(payments[0]?.count ?? 0),
    programmesClosingWithin7Days: closing.size,
    unreadNotifications: Number(unread[0]?.count ?? 0),
  };
}
