import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { documentFile } from "@/lib/portal-store/operations";
import { uploadDir } from "@/lib/portal-store/uploads";
import { clientIp, rateLimit, rateLimitedResponse } from "@/lib/security";
import { requireStaff } from "@/lib/staff-access";
import { canReviewDocument } from "@/lib/staff-roles";

export async function GET(req: NextRequest) {
  if (!rateLimit(`ops-file:${clientIp(req)}`, 40)) return rateLimitedResponse();
  const id = req.nextUrl.searchParams.get("id") || "";
  const file = await documentFile(id);
  if (!file) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const area = file.kind === "payment-proof" ? "payments" : "documents";
  const actor = await requireStaff(req, area);
  if (!actor || !canReviewDocument(actor.role, file.kind)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!file.stored_name || file.stored_name.includes("..") || /[\\/]/.test(file.stored_name)) {
    return NextResponse.json({ error: "Invalid document." }, { status: 400 });
  }
  try {
    const bytes = await fs.readFile(path.join(uploadDir(), file.student_id, file.stored_name));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${file.original_name.replace(/"/g, "")}"`,
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    return NextResponse.json({ error: "File is not on disk." }, { status: 404 });
  }
}
