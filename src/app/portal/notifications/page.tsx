import type { Metadata } from "next";
import { PortalNotifications } from "@/components/portal-notifications";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export default function NotificationsPage() {
  return (
    <div className="site-shell py-12">
      <PortalNotifications />
    </div>
  );
}
