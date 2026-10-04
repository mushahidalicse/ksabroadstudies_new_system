import type { AdmissionStatus } from "@/lib/types";
import { formatAdmissionDate } from "@/lib/utils";

export type FinderStatus = "open" | "closing" | "upcoming" | "closed" | "unannounced";

const CLOSING_WINDOW_DAYS = 21;

export function catalogueIso(value: string | null | undefined) {
  const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function todayIso(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function daysUntil(iso: string, now = new Date()) {
  const [year, month, day] = iso.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

export function describeDeadline(
  input: { status: AdmissionStatus; deadline: string | null },
  now = new Date(),
): {
  finderStatus: FinderStatus;
  deadlineLabel: string;
  countdown: string | null;
  estimated: boolean;
} {
  const iso = catalogueIso(input.deadline);
  const raw = (input.deadline || "").trim();
  const estimated = !iso && (/estimated/i.test(raw) || raw.length > 0);
  const today = todayIso(now);

  if (input.status === "closed" || (iso && iso < today)) {
    return {
      finderStatus: "closed",
      deadlineLabel: iso ? "Deadline passed" : formatAdmissionDate(input.deadline, { status: "closed" }),
      countdown: null,
      estimated: estimated && !iso,
    };
  }

  if (input.status === "open" && iso && iso >= today) {
    const days = daysUntil(iso, now);
    const closing = days <= CLOSING_WINDOW_DAYS;
    const countdown =
      days <= 0 ? "Closes today" : days <= 4 ? `Closes in ${days} day${days === 1 ? "" : "s"}` : `${days} days left`;
    return {
      finderStatus: closing ? "closing" : "open",
      deadlineLabel: formatAdmissionDate(iso),
      countdown,
      estimated: false,
    };
  }

  if (input.status === "soon") {
    return {
      finderStatus: "upcoming",
      deadlineLabel: raw ? formatAdmissionDate(raw) : "Upcoming — date not announced",
      countdown: null,
      estimated,
    };
  }

  return {
    finderStatus: "unannounced",
    deadlineLabel: raw ? formatAdmissionDate(raw) : "Deadline not announced",
    countdown: null,
    estimated,
  };
}

export function finderStatusLabel(status: FinderStatus) {
  switch (status) {
    case "open":
      return "Open";
    case "closing":
      return "Closing soon";
    case "upcoming":
      return "Upcoming";
    case "closed":
      return "Closed";
    default:
      return "Not announced";
  }
}
