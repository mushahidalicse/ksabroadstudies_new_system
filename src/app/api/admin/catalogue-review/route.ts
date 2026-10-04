import { NextRequest, NextResponse } from "next/server";
import { getDatasetFresh } from "@/lib/data";
import { getPhdDataset } from "@/lib/phd";
import {
  backupEnrichment,
  importRecords,
  readEnrichment,
  writeEnrichment,
} from "@/lib/enrichment-store";
import { applyEnrichment, emptyRecord, normalizeRecord, removeRecord, saveGuards, saveRecord } from "@/lib/programme-enrichment";
import { buildDegreeCatalogue, buildPhdCatalogue, type CatalogueCard } from "@/lib/programme-catalogue";
import { sql } from "@/lib/portal-store/db";
import { recordAudit } from "@/lib/portal-store/audit";
import { actorFromRequest } from "@/lib/staff-access";
import {
  assertTrustedOrigin,
  clientIp,
  forbiddenOrigin,
  rateLimit,
  rateLimitedResponse,
  safeEqualString,
} from "@/lib/security";

function authorized(req: NextRequest) {
  const password = req.headers.get("x-admin-password") || "";
  const expected = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "ksabroad2027");
  if (!expected || !password) return false;
  return safeEqualString(password, expected);
}

async function rawCatalogue(): Promise<CatalogueCard[]> {
  const [dataset, phd] = await Promise.all([getDatasetFresh(), getPhdDataset()]);
  return [
    ...buildDegreeCatalogue(dataset),
    ...buildPhdCatalogue(phd.universities, { lastUpdated: phd.lastUpdated, academicYear: phd.academicYear }),
  ];
}

async function shortlistCounts() {
  try {
    const rows = await sql()<{ programme_slug: string; count: string }[]>`
      select programme_slug, count(*)::text as count from shortlist_items group by programme_slug
    `;
    return new Map(rows.map((row) => [row.programme_slug, Number(row.count)]));
  } catch {
    return new Map<string, number>();
  }
}

function queueScore(card: CatalogueCard, saves: number) {
  let score = 0;
  if (card.finderStatus === "open" || card.finderStatus === "closing") score += 100;
  if (!card.enrichmentStatus || card.enrichmentStatus === "needs_review" || !card.enrichmentSourceUrl) score += 40;
  if (card.region === "lazio" || card.region === "south") score += 10;
  score += Math.min(saves, 20);
  return score;
}

export async function GET(req: NextRequest) {
  if (!rateLimit(`catalogue-review-get:${clientIp(req)}`, 30)) return rateLimitedResponse();
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = req.nextUrl.searchParams;
  const store = await readEnrichment();
  const bySlug = new Map(store.records.map((record) => [record.slug, record]));
  const cards = (await rawCatalogue()).map((card) => applyEnrichment(card, bySlug.get(card.slug) ?? null));
  const slug = params.get("slug");
  if (slug) {
    const card = cards.find((item) => item.slug === slug);
    if (!card) return NextResponse.json({ error: "Unknown programme." }, { status: 404 });
    const raw = (await rawCatalogue()).find((item) => item.slug === slug);
    return NextResponse.json({
      card,
      parsed: raw?.requirements ?? null,
      originalEnglish: raw?.englishRequirement ?? "",
      enrichment: bySlug.get(slug) ?? emptyRecord(slug),
      history: store.history.filter((entry) => entry.slug === slug).slice(0, 20),
    });
  }
  if (params.get("export") === "json") return NextResponse.json(store);
  if (params.get("export") === "csv") {
    const header = "slug,status,sourceUrl,sourceType,lastChecked,academicYear,ieltsMin,toeflMin,moi,testRequired,tuitionMode,tuitionAmount,tuitionMin,tuitionMax,minimumCgpa,minimumPercentage";
    const lines = store.records.map((record) =>
      [
        record.slug,
        record.verificationStatus,
        record.sourceUrl,
        record.sourceType,
        record.lastChecked,
        record.academicYear,
        record.english.ieltsMin ?? "",
        record.english.toeflMin ?? "",
        record.english.moi ?? "",
        record.test.required ?? "",
        record.tuition.mode ?? "",
        record.tuition.amount ?? "",
        record.tuition.min ?? "",
        record.tuition.max ?? "",
        record.academic.minimumCgpa ?? "",
        record.academic.minimumPercentage ?? "",
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
    );
    return new NextResponse([header, ...lines].join("\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    });
  }
  const saves = await shortlistCounts();
  const query = (params.get("q") || "").toLowerCase();
  const rows = cards
    .map((card) => ({ card, saves: saves.get(card.slug) ?? 0, score: queueScore(card, saves.get(card.slug) ?? 0) }))
    .filter(({ card }) => {
      if (query && !`${card.name} ${card.universityName} ${card.slug}`.toLowerCase().includes(query)) return false;
      if (params.get("university") && card.universityId !== params.get("university")) return false;
      if (params.get("level") && card.level !== params.get("level")) return false;
      if (params.get("region") && card.region !== params.get("region")) return false;
      if (params.get("status") && card.enrichmentStatus !== params.get("status")) return false;
      if (params.get("missingSource") === "1" && card.enrichmentSourceUrl) return false;
      if (params.get("missingIelts") === "1" && card.requirements.english.ieltsMin != null) return false;
      if (params.get("moiUnknown") === "1" && card.requirements.english.moiAccepted != null) return false;
      if (params.get("missingTuition") === "1" && card.requirements.tuition) return false;
      if (params.get("missingAcademic") === "1" && (card.requirements.academic.minimumCgpa != null || card.requirements.academic.minimumPercentage != null)) return false;
      if (params.get("needsReview") === "1" && card.enrichmentStatus && card.enrichmentStatus !== "needs_review") return false;
      const checkedBefore = params.get("checkedBefore");
      if (checkedBefore && (!card.enrichmentLastChecked || card.enrichmentLastChecked > checkedBefore)) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score || a.card.name.localeCompare(b.card.name));
  const offset = Math.max(Number(params.get("offset")) || 0, 0);
  const quality = {
    total: cards.length,
    programmeSource: cards.filter((card) => card.enrichmentSourceUrl).length,
    programmeChecked: cards.filter((card) => card.enrichmentLastChecked).length,
    verified: cards.filter((card) => card.enrichmentStatus === "verified").length,
    partial: cards.filter((card) => card.enrichmentStatus === "partially_verified").length,
    needsReview: cards.filter((card) => !card.enrichmentStatus || card.enrichmentStatus === "needs_review").length,
    outdated: cards.filter((card) => card.enrichmentStatus === "outdated").length,
    missingSource: cards.filter((card) => !card.enrichmentSourceUrl).length,
    ielts: cards.filter((card) => card.requirements.english.ieltsMin != null).length,
    toefl: cards.filter((card) => card.requirements.english.toeflMin != null).length,
    moiAccepted: cards.filter((card) => card.requirements.english.moiAccepted === true).length,
    moiRejected: cards.filter((card) => card.requirements.english.moiAccepted === false).length,
    test: cards.filter((card) => card.requirements.test.required === true).length,
    tuition: cards.filter((card) => card.requirements.tuition != null).length,
    academic: cards.filter((card) => card.requirements.academic.minimumCgpa != null || card.requirements.academic.minimumPercentage != null).length,
    background: cards.filter((card) => card.requirements.academic.requiredBackground.length > 0).length,
  };
  return NextResponse.json({
    total: rows.length,
    quality,
    rows: rows.slice(offset, offset + 40).map(({ card, saves, score }) => ({
      slug: card.slug,
      name: card.name,
      universityName: card.universityName,
      level: card.level,
      region: card.region,
      city: card.city,
      finderStatus: card.finderStatus,
      enrichmentStatus: card.enrichmentStatus,
      lastChecked: card.enrichmentLastChecked,
      requirementOrigin: card.requirementOrigin,
      saves,
      score,
    })),
  });
}

export async function PUT(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`catalogue-review-put:${clientIp(req)}`, 20)) return rateLimitedResponse();
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const slug = String(body.slug ?? "");
  const known = new Set((await rawCatalogue()).map((card) => card.slug));
  if (!known.has(slug)) return NextResponse.json({ error: "Unknown programme." }, { status: 404 });
  const normalized = normalizeRecord(body, slug);
  if (!normalized.record) return NextResponse.json({ error: normalized.errors.join(" ") }, { status: 400 });
  const store = await readEnrichment();
  const previous = store.records.find((record) => record.slug === slug) ?? null;
  const guards = saveGuards(previous, normalized.record, {
    confirmSource: body.confirmSource === true,
    confirmClear: body.confirmClear === true,
  });
  if (guards.length) return NextResponse.json({ error: guards.join(" ") }, { status: 400 });
  await writeEnrichment(saveRecord(store, normalized.record, new Date().toISOString()));
  const actor = await actorFromRequest(req);
  if (actor) {
    await recordAudit({
      staffId: actor.staffId,
      actorLabel: actor.label,
      action: "enrichment_saved",
      entityType: "programme",
      entityId: slug,
      metadata: { status: normalized.record.verificationStatus },
    });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`catalogue-review-delete:${clientIp(req)}`, 10)) return rateLimitedResponse();
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { slug?: string; confirm?: string };
  try {
    body = (await req.json()) as { slug?: string; confirm?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.confirm !== "delete") return NextResponse.json({ error: "Type delete to confirm removal." }, { status: 400 });
  await backupEnrichment();
  const store = await readEnrichment();
  await writeEnrichment(removeRecord(store, String(body.slug ?? ""), new Date().toISOString()));
  const actor = await actorFromRequest(req);
  if (actor) {
    await recordAudit({
      staffId: actor.staffId,
      actorLabel: actor.label,
      action: "enrichment_removed",
      entityType: "programme",
      entityId: String(body.slug ?? ""),
    });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`catalogue-review-import:${clientIp(req)}`, 5)) return rateLimitedResponse();
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { records?: unknown };
  try {
    body = (await req.json()) as { records?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const known = new Set((await rawCatalogue()).map((card) => card.slug));
  const imported = importRecords(await readEnrichment(), body.records as unknown[], known, new Date().toISOString());
  if (imported.errors.length) return NextResponse.json({ error: imported.errors.slice(0, 8).join(" ") }, { status: 400 });
  await backupEnrichment();
  await writeEnrichment(imported.store);
  return NextResponse.json({ ok: true, imported: Array.isArray(body.records) ? body.records.length : 0 });
}
