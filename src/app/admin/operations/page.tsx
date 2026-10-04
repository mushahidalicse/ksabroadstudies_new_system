import type { Metadata } from "next";
import { AdminOperations } from "@/components/admin-operations";

export const metadata: Metadata = { title: "Staff desk", robots: { index: false, follow: false } };

export default function OperationsPage() {
  return <AdminOperations />;
}
