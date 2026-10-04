import type { Metadata } from "next";
import { AdminCommunications } from "@/components/admin-communications";

export const metadata: Metadata = { title: "Communications", robots: { index: false, follow: false } };

export default function CommunicationsPage() {
  return <AdminCommunications />;
}
