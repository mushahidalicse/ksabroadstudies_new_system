import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFee(fee: number | null): string {
  if (fee === null) return "Check portal";
  if (fee === 0) return "No fee";
  return `€${fee}`;
}

export function statusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Open";
    case "soon":
      return "Opening soon";
    case "closed":
      return "Closed";
    case "tba":
      return "Check portal";
    default:
      return "Check portal";
  }
}

/** Formats ISO dates (2026-11-30) or keeps human estimates readable. */
export function formatAdmissionDate(
  value: string | null | undefined,
  options?: { status?: string; emptyLabel?: string },
): string {
  if (!value) {
    if (options?.emptyLabel) return options.emptyLabel;
    if (options?.status === "open") return "Now open";
    return "Check portal";
  }
  // Normalize fancy dashes so SSR/client text never diverges on encoding
  const normalized = value.replace(/[\u2013\u2014\u2212]/g, "-").trim();
  const iso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const day = Number(iso[3]);
    const month = months[Number(iso[2]) - 1];
    return `${day} ${month} ${iso[1]}`;
  }
  if (normalized.toLowerCase().startsWith("estimated ")) {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
  return normalized;
}

export function regionLabel(region: string): string {
  switch (region) {
    case "lazio":
      return "Lazio";
    case "south":
      return "South";
    case "centre":
      return "Centre";
    case "north":
      return "North";
    default:
      return region;
  }
}
