import { NextRequest, NextResponse } from "next/server";
import { getDatasetFresh, saveDataset } from "@/lib/data";
import {
  assertTrustedOrigin,
  clientIp,
  forbiddenOrigin,
  rateLimit,
  rateLimitedResponse,
  safeEqualString,
} from "@/lib/security";
import type { AdmissionStatus, University } from "@/lib/types";

function authorized(req: NextRequest) {
  const password = req.headers.get("x-admin-password") || "";
  const expected =
    process.env.ADMIN_PASSWORD ||
    (process.env.NODE_ENV === "production" ? "" : "ksabroad2027");
  if (!expected || !password) return false;
  return safeEqualString(password, expected);
}

export async function GET(req: NextRequest) {
  if (!rateLimit(`admin-get:${clientIp(req)}`, 10)) return rateLimitedResponse();
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dataset = await getDatasetFresh();
  return NextResponse.json(dataset);
}

export async function PUT(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`admin-put:${clientIp(req)}`, 10)) return rateLimitedResponse();
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    id?: string;
    status?: AdmissionStatus;
    estimatedOpenDate?: string | null;
    deadline?: string | null;
    applicationFeeEuro?: number | null;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "Missing university id" }, { status: 400 });
  }

  const dataset = await getDatasetFresh();
  const index = dataset.universities.findIndex((u) => u.id === body.id);
  if (index === -1) {
    return NextResponse.json({ error: "University not found" }, { status: 404 });
  }

  const current: University = dataset.universities[index];
  const nextNotes =
    typeof body.notes === "string" ? body.notes.slice(0, 4000) : current.notes;

  dataset.universities[index] = {
    ...current,
    status: body.status ?? current.status,
    estimatedOpenDate:
      body.estimatedOpenDate !== undefined
        ? body.estimatedOpenDate
        : current.estimatedOpenDate,
    deadline: body.deadline !== undefined ? body.deadline : current.deadline,
    applicationFeeEuro:
      body.applicationFeeEuro !== undefined
        ? body.applicationFeeEuro
        : current.applicationFeeEuro,
    notes: nextNotes,
  };
  dataset.lastUpdated = new Date().toISOString().slice(0, 10);

  await saveDataset(dataset);
  return NextResponse.json({ ok: true, university: dataset.universities[index] });
}
