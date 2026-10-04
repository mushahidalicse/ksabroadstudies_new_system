function isoDateOnly(value: string | null | undefined) {
  const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function todayIso(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Badge status from the stored label plus real dates.
 * A passed ISO deadline cannot stay Open. A call that has started and not ended is Open.
 */
export function effectiveAdmissionStatus(
  uni: {
    status: string;
    deadline?: string | null;
    estimatedOpenDate?: string | null;
  },
  now = new Date(),
): "open" | "soon" | "closed" | "tba" {
  const today = todayIso(now);
  const deadline = isoDateOnly(uni.deadline);
  const opens = isoDateOnly(uni.estimatedOpenDate);
  const stored =
    uni.status === "open" ||
    uni.status === "soon" ||
    uni.status === "closed" ||
    uni.status === "tba"
      ? uni.status
      : "tba";

  if (stored === "open" && deadline && deadline < today) return "closed";
  if (
    (stored === "soon" || stored === "tba") &&
    opens &&
    opens <= today &&
    (!deadline || deadline >= today)
  ) {
    return "open";
  }
  return stored;
}
