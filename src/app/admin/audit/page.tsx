import type { Metadata } from "next";
import { AdminAudit } from "@/components/admin-audit";

export const metadata: Metadata = { title: "Audit log", robots: { index: false, follow: false } };

export default function AuditPage() {
  return <AdminAudit />;
}
