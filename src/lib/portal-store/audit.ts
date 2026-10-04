import { ensureSchema, sql } from "@/lib/portal-store/db";

const BLOCKED = /password|cookie|secret|token|api[-_]?key|authorization|session/i;

export type AuditInput = {
  staffId: string | null;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export function sanitizeAuditMetadata(metadata: Record<string, unknown> | undefined) {
  const clean: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (BLOCKED.test(key)) continue;
    if (typeof value === "string") clean[key] = value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 240);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) clean[key] = value;
  }
  return clean;
}

export async function recordAudit(input: AuditInput) {
  await ensureSchema();
  const metadata = sanitizeAuditMetadata(input.metadata);
  await sql()`
    INSERT INTO staff_audit_log (id, staff_id, actor_label, action, entity_type, entity_id, metadata, created_at)
    VALUES (
      ${crypto.randomUUID()},
      ${input.staffId},
      ${input.actorLabel.slice(0, 120)},
      ${input.action.slice(0, 80)},
      ${input.entityType.slice(0, 80)},
      ${input.entityId.slice(0, 120)},
      ${sql().json(metadata)},
      ${new Date().toISOString()}
    )
  `;
}

export async function listAudit(filters: { staff?: string; action?: string; entity?: string; q?: string; from?: string; to?: string }) {
  await ensureSchema();
  const rows = await sql()<{
    id: string;
    staff_id: string | null;
    actor_label: string;
    action: string;
    entity_type: string;
    entity_id: string;
    metadata: Record<string, unknown>;
    created_at: Date | string;
  }[]>`
    SELECT id, staff_id, actor_label, action, entity_type, entity_id, metadata, created_at
    FROM staff_audit_log
    ORDER BY created_at DESC
    LIMIT 300
  `;
  return rows
    .map((row) => ({
      id: row.id,
      staffId: row.staff_id,
      actor: row.actor_label,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: sanitizeAuditMetadata(row.metadata),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    }))
    .filter((row) => {
      if (filters.staff && row.actor.toLowerCase() !== filters.staff.toLowerCase() && row.staffId !== filters.staff) return false;
      if (filters.action && row.action !== filters.action) return false;
      if (filters.entity && row.entityType !== filters.entity) return false;
      if (filters.from && row.createdAt.slice(0, 10) < filters.from) return false;
      if (filters.to && row.createdAt.slice(0, 10) > filters.to) return false;
      if (filters.q) {
        const haystack = `${row.action} ${row.entityType} ${row.entityId} ${row.actor}`.toLowerCase();
        if (!haystack.includes(filters.q.toLowerCase())) return false;
      }
      return true;
    });
}
