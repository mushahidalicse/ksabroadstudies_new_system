import { DOCUMENT_KINDS } from "@/lib/student-types";
import type { ReviewStatus } from "@/lib/portal-store/operations";

export type NoticeDraft = {
  type: string;
  title: string;
  message: string;
  link: string;
  category: "documents" | "applications" | "consultancy" | "payment" | "reminders" | "messages";
};

export function documentLabel(kind: string) {
  return DOCUMENT_KINDS.find((item) => item.id === kind)?.label ?? "document";
}

export function reviewNotice(input: { kind: string; status: ReviewStatus; note: string }): NoticeDraft | null {
  const label = documentLabel(input.kind);
  const note = input.note.trim();
  if (input.kind === "payment-proof") {
    if (input.status === "accepted") {
      return {
        type: "payment_accepted",
        title: "Payment proof accepted",
        message: "Your payment proof has been accepted.",
        link: "/portal",
        category: "payment",
      };
    }
    if (input.status === "rejected" || input.status === "needs_replacement") {
      return {
        type: "payment_rejected",
        title: "Payment proof needs attention",
        message: note
          ? `Your payment proof was not accepted. ${note}`
          : "Your payment proof was not accepted. Please upload a new screenshot.",
        link: "/portal",
        category: "payment",
      };
    }
    return null;
  }
  if (input.status === "accepted") {
    return {
      type: "document_accepted",
      title: `${label} accepted`,
      message: `Your ${label.toLowerCase()} has been reviewed and accepted.`,
      link: "/portal",
      category: "documents",
    };
  }
  if (input.status === "needs_replacement") {
    return {
      type: "document_replacement",
      title: `${label} needs replacement`,
      message: note
        ? `Your ${label.toLowerCase()} needs to be replaced. ${note}`
        : `Your ${label.toLowerCase()} needs to be replaced. Please check the review note.`,
      link: "/portal",
      category: "documents",
    };
  }
  if (input.status === "rejected") {
    return {
      type: "document_rejected",
      title: `${label} needs attention`,
      message: note
        ? `Your ${label.toLowerCase()} was not accepted. ${note}`
        : `Your ${label.toLowerCase()} was not accepted. Please check the review note.`,
      link: "/portal",
      category: "documents",
    };
  }
  return null;
}

export function applicationNotice(studentLabel: string): NoticeDraft {
  return {
    type: "application_update",
    title: "Application update",
    message: `Your application status was updated to ${studentLabel}.`,
    link: "/portal",
    category: "applications",
  };
}

export function consultancyNotice(): NoticeDraft {
  return {
    type: "consultancy_update",
    title: "Consultancy update",
    message: "There is a new reply on your consultancy case.",
    link: "/portal",
    category: "consultancy",
  };
}

export function categoryFor(type: string): NoticeDraft["category"] {
  if (type.startsWith("payment_")) return "payment";
  if (type.startsWith("document_")) return "documents";
  if (type === "application_update") return "applications";
  if (type === "consultancy_update") return "consultancy";
  if (type === "staff_message") return "messages";
  return "reminders";
}

export function categoryLabel(category: NoticeDraft["category"]) {
  if (category === "documents") return "Documents";
  if (category === "applications") return "Applications";
  if (category === "consultancy") return "Consultancy";
  if (category === "payment") return "Payment";
  if (category === "messages") return "Message";
  return "Reminder";
}
