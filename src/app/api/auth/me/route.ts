import { NextRequest, NextResponse } from "next/server";
import { sessionIdFromRequest } from "@/lib/auth";
import { getStudentById, toPublic } from "@/lib/students";

export async function GET(req: NextRequest) {
  const id = sessionIdFromRequest(req);
  if (!id) {
    return NextResponse.json({ student: null }, { status: 200 });
  }
  const student = await getStudentById(id);
  if (!student) {
    return NextResponse.json({ student: null }, { status: 200 });
  }
  return NextResponse.json({ student: toPublic(student) });
}
