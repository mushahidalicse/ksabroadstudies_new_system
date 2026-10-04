import { hashPassword, verifyPassword } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/portal-store/db";
import { isStaffRole, type StaffRole } from "@/lib/staff-roles";

export type StaffAccount = {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  active: boolean;
  createdAt: string;
};

type Row = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  active: boolean;
  created_at: Date | string;
};

function map(row: Row): StaffAccount {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: isStaffRole(row.role) ? row.role : "document_reviewer",
    active: row.active,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
  };
}

export async function listStaff() {
  await ensureSchema();
  const rows = await sql()<Row[]>`SELECT id, email, name, password_hash, role, active, created_at FROM staff_accounts ORDER BY created_at ASC`;
  return rows.map(map);
}

export async function findStaffByEmail(email: string) {
  await ensureSchema();
  const rows = await sql()<Row[]>`
    SELECT id, email, name, password_hash, role, active, created_at
    FROM staff_accounts WHERE lower(email) = lower(${email.trim()})
  `;
  return rows[0] ?? null;
}

export async function findStaffById(id: string) {
  await ensureSchema();
  const rows = await sql()<Row[]>`
    SELECT id, email, name, password_hash, role, active, created_at
    FROM staff_accounts WHERE id = ${id}
  `;
  return rows[0] ?? null;
}

export async function createStaff(input: { email: string; name: string; password: string; role: StaffRole }) {
  await ensureSchema();
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(input.password);
  await sql()`
    INSERT INTO staff_accounts (id, email, name, password_hash, role, active, created_at)
    VALUES (${id}, ${input.email.trim().toLowerCase()}, ${input.name}, ${passwordHash}, ${input.role}, ${true}, ${new Date().toISOString()})
  `;
  const row = await findStaffById(id);
  return row ? map(row) : null;
}

export async function setStaffActive(id: string, active: boolean) {
  await ensureSchema();
  await sql()`UPDATE staff_accounts SET active = ${active} WHERE id = ${id}`;
}

export async function setStaffRole(id: string, role: StaffRole) {
  await ensureSchema();
  await sql()`UPDATE staff_accounts SET role = ${role} WHERE id = ${id}`;
}

export async function deleteStaff(id: string) {
  await ensureSchema();
  await sql()`DELETE FROM staff_accounts WHERE id = ${id}`;
}

export async function authenticateStaff(email: string, password: string) {
  const row = await findStaffByEmail(email);
  if (!row || !row.active) return null;
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok || !isStaffRole(row.role)) return null;
  return map(row);
}
