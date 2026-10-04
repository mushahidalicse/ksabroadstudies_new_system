import { NextRequest, NextResponse } from "next/server";
import { getDatasetFresh } from "@/lib/data";
import { getPhdDataset } from "@/lib/phd";
import { readEnrichment, writeEnrichment } from "@/lib/enrichment-store";
import { saveGuards, saveRecord } from "@/lib/programme-enrichment";
import { buildDegreeCatalogue, buildPhdCatalogue, type CatalogueCard } from "@/lib/programme-catalogue";
import { proposalToEnrichment, reviewRows } from "@/lib/research/approve-research";
import { identityQualityCounts } from "@/lib/research/discovery";
import { getResearchProvider } from "@/lib/research/provider";
import { APPROVABLE_FIELDS, RESEARCH_BATCH_LIMIT, type ApprovableField, type ResearchSubject } from "@/lib/research/research-schema";
import { runResearchJob } from "@/lib/research/run-research";
import {
  cancelResearchJob,
  insertResearchJob,
  latestResearchJob,
  listResearchJobs,
  readResearchResult,
  recentResearchWarning,
  runningResearchBlock,
  setCatalogueDecision,
  setReviewStatus,
} from "@/lib/portal-store/research";
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

function clean(value: unknown, max: number) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

async function catalogue() {
  const [dataset, phd] = await Promise.all([getDatasetFresh(), getPhdDataset()]);
  return [
    ...buildDegreeCatalogue(dataset),
    ...buildPhdCatalogue(phd.universities, { lastUpdated: phd.lastUpdated, academicYear: phd.academicYear }),
  ];
}

function currentCard(cards: CatalogueCard[], slug: string) {
  const match = cards.find((item) => item.slug === slug);
  if (!match) return undefined;
  if (match.listing === "historical" && match.canonicalSlug) {
    return cards.find((item) => item.slug === match.canonicalSlug) ?? match;
  }
  return match;
}

function subject(card: CatalogueCard): ResearchSubject {
  const verifiedTitles = [
    ...(card.historicalTitles ?? []),
    ...(card.renames ?? []).flatMap((item) => [item.italianTitle ?? ""]),
  ].map((item) => item.trim()).filter((item) => item.length > 3);
  return {
    slug: card.slug,
    name: card.name,
    universityName: card.universityName,
    level: card.level,
    city: card.city,
    region: card.region,
    language: card.language,
    englishRequirement: card.englishRequirement,
    universityWebsite: card.universityWebsite,
    admissionPortal: card.admissionPortal,
    verifiedTitles: [...new Set(verifiedTitles)],
    degreeClass: card.degreeClass ?? null,
    italianTitle: card.italianTitle ?? null,
    discoveryHints: [
      ...(card.programmeUrl ? [{ url: card.programmeUrl, kind: "programme_url" as const }] : []),
      ...(card.applyUrl ? [{ url: card.applyUrl, kind: "apply_url" as const }] : []),
    ],
  };
}

async function startOne(card: CatalogueCard, confirmAgain: boolean) {
  const latest = await latestResearchJob(card.slug);
  const running = runningResearchBlock(latest);
  if (running) return { ok: false as const, status: 409, error: running };
  const warning = recentResearchWarning(latest);
  if (warning && !confirmAgain) return { ok: false as const, status: 409, error: warning };
  const provider = getResearchProvider();
  const id = await insertResearchJob({ slug: card.slug, university: card.universityName, provider: provider.id });
  const result = await runResearchJob(id, subject(card), provider);
  return { ok: true as const, status: 200, id, pending: Boolean(result), failed: !result };
}

export async function GET(req: NextRequest) {
  if (!rateLimit(`admin-research-get:${clientIp(req)}`, 30)) return rateLimitedResponse();
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const jobId = req.nextUrl.searchParams.get("job") || "";
  if (!jobId) {
    const jobs = await listResearchJobs();
    const params = req.nextUrl.searchParams;
    const query = (params.get("q") || "").toLowerCase();
    const rows = jobs.filter((job) => {
      if (query && !`${job.programmeSlug} ${job.university}`.toLowerCase().includes(query)) return false;
      if (params.get("status") && job.status !== params.get("status")) return false;
      if (params.get("review") && job.reviewStatus !== params.get("review")) return false;
      return true;
    });
    const quality = identityQualityCounts(jobs);
    return NextResponse.json({
      rows,
      counts: {
        ...quality,
        pending: jobs.filter((job) => job.reviewStatus === "pending_review").length,
        approved: jobs.filter((job) => job.reviewStatus === "approved" || job.reviewStatus === "edited_and_approved").length,
        rejected: jobs.filter((job) => job.reviewStatus === "rejected").length,
        failed: jobs.filter((job) => job.status === "failed").length,
      },
    });
  }
  const saved = await readResearchResult(jobId);
  if (!saved) return NextResponse.json({ error: "Research result not found." }, { status: 404 });
  const cards = await catalogue();
  const card = cards.find((item) => item.slug === saved.structured_result.programmeSlug);
  const store = await readEnrichment();
  const enrichment = store.records.find((record) => record.slug === saved.structured_result.programmeSlug) ?? null;
  return NextResponse.json({
    result: saved.structured_result,
    reviewStatus: saved.review_status,
    rows: card ? reviewRows(saved.structured_result, card.requirements, enrichment) : [],
    mock: saved.structured_result.provider === "mock",
  });
}

export async function POST(req: NextRequest) {
  if (!assertTrustedOrigin(req)) return forbiddenOrigin();
  if (!rateLimit(`admin-research-post:${clientIp(req)}`, 10)) return rateLimitedResponse();
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = clean(body.action, 40);
  const cards = await catalogue();
  if (action === "start") {
    const card = currentCard(cards, clean(body.slug, 120));
    if (!card) return NextResponse.json({ error: "Unknown programme." }, { status: 404 });
    const started = await startOne(card, body.confirmAgain === true);
    if (!started.ok) return NextResponse.json({ error: started.error }, { status: started.status });
    return NextResponse.json({ ok: true, jobId: started.id, failed: started.failed });
  }
  if (action === "batch" || action === "next") {
    let chosen: CatalogueCard[] = [];
    if (action === "batch") {
      const slugs = Array.isArray(body.slugs) ? body.slugs.map((item) => clean(item, 120)).filter(Boolean) : [];
      if (slugs.length > RESEARCH_BATCH_LIMIT) {
        return NextResponse.json({ error: `Research up to ${RESEARCH_BATCH_LIMIT} programmes at a time.` }, { status: 400 });
      }
      chosen = [...new Map(slugs.flatMap((slug) => {
        const card = currentCard(cards, slug);
        return card ? [[card.slug, card] as const] : [];
      })).values()];
    } else {
      const jobs = await listResearchJobs();
      const latestBySlug = new Map<string, (typeof jobs)[number]>();
      for (const job of jobs) if (!latestBySlug.has(job.programmeSlug)) latestBySlug.set(job.programmeSlug, job);
      const recent = new Set<string>();
      for (const [slug, latest] of latestBySlug) {
        if (recentResearchWarning(latest) || latest.status === "queued" || latest.status === "researching") recent.add(slug);
      }
      const pool = cards.filter((card) => card.listing !== "historical" && !recent.has(card.slug));
      const preferred = pool.filter((card) => card.region === "lazio" || card.region === "south");
      const levels = new Set<string>();
      for (const card of [...preferred, ...pool]) {
        if (chosen.length >= RESEARCH_BATCH_LIMIT) break;
        if (levels.has(card.level) && chosen.length < 3) continue;
        levels.add(card.level);
        chosen.push(card);
      }
    }
    if (!body.confirmAgain) {
      const warnings: string[] = [];
      for (const card of chosen) {
        const warning = recentResearchWarning(await latestResearchJob(card.slug));
        if (warning) warnings.push(`${card.name}: ${warning}`);
      }
      if (warnings.length) return NextResponse.json({ error: warnings.join(" ") }, { status: 409 });
    }
    const ids: string[] = [];
    for (const card of chosen.slice(0, RESEARCH_BATCH_LIMIT)) {
      const started = await startOne(card, true);
      if (started.ok) ids.push(started.id);
    }
    return NextResponse.json({ ok: true, started: ids.length });
  }
  if (action === "cancel") {
    const cancelled = await cancelResearchJob(clean(body.jobId, 80));
    if (!cancelled) return NextResponse.json({ error: "Only a queued job can be cancelled." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (action === "catalogue-decision") {
    const decision = clean(body.decision, 40);
    if (decision !== "keep" && decision !== "edit_manually" && decision !== "inactive_requested" && decision !== "investigate_later") {
      return NextResponse.json({ error: "Choose a catalogue review action." }, { status: 400 });
    }
    const saved = await setCatalogueDecision(clean(body.jobId, 80), decision);
    if (!saved) return NextResponse.json({ error: "Only a catalogue-review result can record this decision. The catalogue was not changed." }, { status: 400 });
    return NextResponse.json({ ok: true, catalogueChanged: false });
  }
  if (action === "reject") {
    await setReviewStatus(clean(body.jobId, 80), "rejected");
    const actor = await actorFromRequest(req);
    if (actor) {
      await recordAudit({
        staffId: actor.staffId,
        actorLabel: actor.label,
        action: "research_rejected",
        entityType: "research_job",
        entityId: clean(body.jobId, 80),
      });
    }
    return NextResponse.json({ ok: true });
  }
  if (action === "approve") {
    const jobId = clean(body.jobId, 80);
    const saved = await readResearchResult(jobId);
    if (!saved) return NextResponse.json({ error: "Research result not found." }, { status: 404 });
    if (saved.review_status !== "pending_review" || saved.structured_result.researchOutcome === "research_incomplete_identity" || saved.structured_result.researchOutcome === "needs_research_agent_fix" || saved.structured_result.researchOutcome === "catalogue_review_required") {
      return NextResponse.json({ error: "This research result is not publishable. It stays off the catalogue until a corrected research run is reviewed." }, { status: 400 });
    }
    if (saved.structured_result.provider === "mock" && body.confirmMock !== true) {
      return NextResponse.json({ error: "This is mock research. Confirm before it can be saved." }, { status: 400 });
    }
    const approved = Array.isArray(body.fields)
      ? body.fields.filter((field): field is ApprovableField => (APPROVABLE_FIELDS as readonly string[]).includes(String(field)))
      : [];
    if (!approved.length) return NextResponse.json({ error: "Choose at least one field to approve." }, { status: 400 });
    const edits = body.edits && typeof body.edits === "object" ? body.edits as Partial<Record<ApprovableField, string>> : {};
    const slug = saved.structured_result.programmeSlug;
    const store = await readEnrichment();
    const current = store.records.find((record) => record.slug === slug) ?? null;
    const today = new Date().toISOString().slice(0, 10);
    const normalized = proposalToEnrichment(slug, current, saved.structured_result, approved, edits, today);
    if (!normalized.record) return NextResponse.json({ error: normalized.errors.join(" ") }, { status: 400 });
    const guards = saveGuards(current, normalized.record, { confirmSource: true, confirmClear: body.confirmClear === true });
    if (guards.length) return NextResponse.json({ error: guards.join(" ") }, { status: 400 });
    await writeEnrichment(saveRecord(store, normalized.record, new Date().toISOString()));
    const edited = Object.values(edits).some((value) => String(value ?? "").trim());
    await setReviewStatus(jobId, edited ? "edited_and_approved" : "approved");
    const actor = await actorFromRequest(req);
    if (actor) {
      await recordAudit({
        staffId: actor.staffId,
        actorLabel: actor.label,
        action: "research_approved",
        entityType: "research_job",
        entityId: jobId,
        metadata: { slug, status: edited ? "edited_and_approved" : "approved" },
      });
    }
    return NextResponse.json({ ok: true, verificationStatus: normalized.record.verificationStatus });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
