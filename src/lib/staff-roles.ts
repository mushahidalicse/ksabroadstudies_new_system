export const STAFF_ROLES = ["owner", "case_officer", "document_reviewer", "finance"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export type StaffArea = "staff" | "crm" | "documents" | "payments" | "services" | "communications" | "audit" | "templates";

export type MessageChannel = "general" | "document" | "payment";

export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

export function roleAllows(role: StaffRole, area: StaffArea) {
  if (role === "owner") return true;
  if (area === "crm") return role === "case_officer";
  if (area === "services") return role === "case_officer";
  if (area === "documents") return role === "document_reviewer" || role === "case_officer";
  if (area === "payments") return role === "finance";
  if (area === "communications") return role === "case_officer";
  return false;
}

export function canSendMessage(role: StaffRole, channel: MessageChannel) {
  if (role === "owner") return true;
  if (channel === "general") return role === "case_officer";
  if (channel === "document") return role === "case_officer" || role === "document_reviewer";
  if (channel === "payment") return role === "finance";
  return false;
}

export function canReviewDocument(role: StaffRole, kind: string) {
  if (kind === "payment-proof") return roleAllows(role, "payments");
  return roleAllows(role, "documents");
}
