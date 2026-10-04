import { ensureSchema, sql } from "@/lib/portal-store/db";

export type NotificationPreferences = {
  portalEnabled: boolean;
  emailEnabled: false;
  whatsappEnabled: false;
};

export async function getNotificationPreferences(studentId: string): Promise<NotificationPreferences> {
  await ensureSchema();
  const rows = await sql()<{ portal_enabled: boolean }[]>`
    SELECT portal_enabled FROM notification_preferences WHERE student_id = ${studentId}
  `;
  return {
    portalEnabled: rows[0]?.portal_enabled ?? true,
    emailEnabled: false,
    whatsappEnabled: false,
  };
}

export async function setPortalPreference(studentId: string, portalEnabled: boolean) {
  await ensureSchema();
  const now = new Date().toISOString();
  await sql()`
    INSERT INTO notification_preferences (student_id, portal_enabled, email_enabled, whatsapp_enabled, updated_at)
    VALUES (${studentId}, ${portalEnabled}, ${false}, ${false}, ${now})
    ON CONFLICT (student_id) DO UPDATE SET
      portal_enabled = EXCLUDED.portal_enabled,
      email_enabled = false,
      whatsapp_enabled = false,
      updated_at = EXCLUDED.updated_at
  `;
}

export async function portalRemindersEnabled(studentId: string) {
  const prefs = await getNotificationPreferences(studentId);
  return prefs.portalEnabled;
}
