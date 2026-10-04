import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/portal-store/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();
    await sql()`SELECT 1 AS ok`;
    return NextResponse.json({ ok: true, database: "up" });
  } catch {
    return NextResponse.json({ ok: false, database: "down" }, { status: 503 });
  }
}
