import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { sessionIdFromRequest } from "@/lib/auth";
import {
  assertTrustedOrigin,
  clientIp,
  forbiddenOrigin,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/security";
import { DOCUMENT_KINDS, type DocumentKind } from "@/lib/student-types";
import { getStudentById, toPublic, upsertStudent } from "@/lib/students";
import { uploadDir } from "@/lib/portal-store/uploads";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const KINDS = new Set(DOCUMENT_KINDS.map((k) => k.id));

function extFor(type: string, name: string) {
  if (type === "application/pdf") return ".pdf";
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "image/jpeg") return ".jpg";
  const fromName = path.extname(name).toLowerCase();
  return [".pdf", ".jpg", ".jpeg", ".png", ".webp"].includes(fromName) ? fromName : "";
}

function safeStoredName(name: string) {
  return Boolean(name) && !name.includes("..") && !/[\\/]/.test(name);
}

export async function POST(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`docs-post:${clientIp(req)}`, 15)) return rateLimitedResponse();

  const id = sessionIdFromRequest(req);
  if (!id) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const student = await getStudentById(id);
  if (!student) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const form = await req.formData();
  const kind = String(form.get("kind") || "other");
  if (!KINDS.has(kind as DocumentKind)) {
    return NextResponse.json({ error: "Choose a document type." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be 8 MB or smaller." }, { status: 400 });
  }
  if (file.type && !ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Upload a PDF, JPG, PNG, or WebP file." },
      { status: 400 },
    );
  }

  const ext = extFor(file.type, file.name);
  if (!ext) {
    return NextResponse.json({ error: "Upload a PDF, JPG, PNG, or WebP file." }, { status: 400 });
  }

  const docId = crypto.randomUUID();
  const storedName = `${docId}${ext}`;
  const folder = path.join(uploadDir(), student.id);
  await fs.mkdir(folder, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(/* turbopackIgnore: true */ folder, storedName), bytes);

  student.documents = student.documents ?? [];
  student.documents.push({
    id: docId,
    kind: kind as DocumentKind,
    originalName: file.name.slice(0, 180),
    storedName,
    uploadedAt: new Date().toISOString(),
  });
  await upsertStudent(student);
  return NextResponse.json({ ok: true, student: toPublic(student) });
}

export async function DELETE(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`docs-del:${clientIp(req)}`, 20)) return rateLimitedResponse();

  const id = sessionIdFromRequest(req);
  if (!id) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const student = await getStudentById(id);
  if (!student) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  let body: { id?: string };
  try {
    body = (await req.json()) as { id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const doc = student.documents.find((d) => d.id === body.id);
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  if (!safeStoredName(doc.storedName)) {
    return NextResponse.json({ error: "Invalid document." }, { status: 400 });
  }

  student.documents = student.documents.filter((d) => d.id !== doc.id);
  await upsertStudent(student);
  try {
    await fs.unlink(path.join(uploadDir(), student.id, doc.storedName));
  } catch {
    /* already gone */
  }
  return NextResponse.json({ ok: true, student: toPublic(student) });
}
