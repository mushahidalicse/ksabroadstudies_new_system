import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    name: "KS Abroad Studies API",
    version: "1.0.0",
    stages: [1, 2, 3, 4, 5],
  });
}
