export type PortalDelivery = {
  studentId: string;
  title: string;
  message: string;
};

export interface NotificationProvider {
  readonly id: "portal" | "email" | "whatsapp";
  readonly enabled: boolean;
  deliver(input: PortalDelivery): Promise<{ ok: boolean; error?: string }>;
}

export const portalNotificationProvider: NotificationProvider = {
  id: "portal",
  enabled: true,
  async deliver() {
    return { ok: true };
  },
};

export const emailNotificationProvider: NotificationProvider = {
  id: "email",
  enabled: false,
  async deliver() {
    return { ok: false, error: "Email is not connected." };
  },
};

export const whatsappNotificationProvider: NotificationProvider = {
  id: "whatsapp",
  enabled: false,
  async deliver() {
    return { ok: false, error: "WhatsApp is not connected." };
  },
};

export async function deliverPortal(input: PortalDelivery) {
  if (!portalNotificationProvider.enabled) return { ok: false, error: "Portal notifications are off." };
  return portalNotificationProvider.deliver(input);
}
