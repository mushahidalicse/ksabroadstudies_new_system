import { statusLabel } from "@/lib/utils";
import type { AdmissionStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: AdmissionStatus }) {
  return (
    <span className={`status-pill status-${status}`}>{statusLabel(status)}</span>
  );
}
