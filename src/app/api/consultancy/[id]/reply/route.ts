import { NextRequest, NextResponse } from "next/server";
import { clean, studentIdFromRequest } from "@/lib/auth";
import { addStudentReply } from "@/lib/consultancy";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const studentId = studentIdFromRequest(req);
  if (!studentId) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = clean(body.body, 2000);
  if (!text) {
    return NextResponse.json({ error: "body is required." }, { status: 400 });
  }

  const { id } = await params;
  const row = await addStudentReply(id, studentId, text);
  if (!row) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, case: row });
}
