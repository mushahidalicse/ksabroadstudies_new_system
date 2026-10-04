import { getCasesForStudent } from "@/lib/consultancy";
import { categoryFor, categoryLabel } from "@/lib/notifications/copy";
import { listNotifications } from "@/lib/portal-store/notifications";
import { sql } from "@/lib/portal-store/db";

export async function communicationHistory(studentId: string) {
  const [notifications, cases, reviews] = await Promise.all([
    listNotifications(studentId),
    getCasesForStudent(studentId),
    sql()<{ kind: string; status: string; note: string; updated_at: Date | string; original_name: string }[]>`
      SELECT d.kind, r.status, r.note, r.updated_at, d.original_name
      FROM document_reviews r
      JOIN student_documents d ON d.id = r.document_id
      WHERE d.student_id = ${studentId} AND r.status <> 'pending'
    `,
  ]);
  const items = [
    ...notifications
      .filter((item) => item.type !== "consultancy_update")
      .map((item) => ({
        at: item.createdAt,
        audience: "student" as const,
        category: categoryLabel(categoryFor(item.type)),
        title: item.title,
        message: item.message,
      })),
    ...cases.flatMap((item) =>
      item.replies
        .filter((reply) => reply.from === "staff")
        .map((reply) => ({
          at: reply.at,
          audience: "student" as const,
          category: "Consultancy",
          title: item.topic,
          message: reply.body,
        })),
    ),
    ...reviews.map((review) => ({
      at: review.updated_at instanceof Date ? review.updated_at.toISOString() : new Date(review.updated_at).toISOString(),
      audience: "student" as const,
      category: review.kind === "payment-proof" ? "Payment" : "Documents",
      title: review.original_name,
      message: review.note || `Review marked ${review.status.replaceAll("_", " ")}.`,
    })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
}
