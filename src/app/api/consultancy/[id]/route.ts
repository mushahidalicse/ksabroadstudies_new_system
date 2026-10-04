import { NextRequest, NextResponse } from "next/server";
import { studentIdFromRequest } from "@/lib/auth";
import { getCaseById } from "@/lib/consultancy";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const studentId = studentIdFromRequest(req);
  if (!studentId) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  const { id } = await params;
  const row = await getCaseById(id);
  if (!row || row.studentId !== studentId) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, case: row });
}
