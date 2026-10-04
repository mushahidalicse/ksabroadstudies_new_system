export const CRM_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type CrmPriority = (typeof CRM_PRIORITIES)[number];

const STAFF_APPLICATION = new Set(["requested", "reviewing", "submitting", "on_hold"]);

export type AttentionInput = {
  priority: string;
  nextAction: string;
  nextActionDue: string | null;
  openTaskOverdue: boolean;
  openConsultancy: boolean;
  applicationNeedsStaff: boolean;
  today: string;
};

export function attentionReasons(input: AttentionInput) {
  const reasons: string[] = [];
  if (input.priority === "high" || input.priority === "urgent") reasons.push("High priority");
  if (input.nextAction.trim() && input.nextActionDue && input.nextActionDue <= input.today) {
    reasons.push("Next action is due");
  }
  if (input.openTaskOverdue) reasons.push("A task is overdue");
  if (input.openConsultancy) reasons.push("Consultancy case is still active");
  if (input.applicationNeedsStaff) reasons.push("An application is waiting on staff");
  return reasons;
}

export function applicationNeedsStaff(status: string) {
  return STAFF_APPLICATION.has(status);
}

export function isCrmPriority(value: string): value is CrmPriority {
  return (CRM_PRIORITIES as readonly string[]).includes(value);
}
