import { ensureSchema, sql } from "@/lib/portal-store/db";
import type { JobStatus, ResearchResult, ReviewStatus } from "@/lib/research/research-schema";
import { RESEARCH_RECENT_DAYS } from "@/lib/research/research-schema";

export type ResearchJob = {
  id: string;
  programmeSlug: string;
  university: string;
  status: JobStatus;
  provider: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string;
  reviewStatus: ReviewStatus | null;
};

function iso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

type JobRow = {
  id: string;
  programme_slug: string;
  university: string;
  status: JobStatus;
  provider: string;
  created_at: Date | string;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  error: string;
  review_status: ReviewStatus | null;
};

function mapJob(row: JobRow): ResearchJob {
  return {
    id: row.id,
    programmeSlug: row.programme_slug,
    university: row.university,
    status: row.status,
    provider: row.provider,
    createdAt: iso(row.created_at) ?? "",
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    error: row.error,
    reviewStatus: row.review_status,
  };
}

async function withReview(rows: Array<Omit<JobRow, "review_status">>) {
  if (!rows.length) return [] as ResearchJob[];
  const db = sql();
  const reviews = await db<{ job_id: string; review_status: ReviewStatus }[]>`
    SELECT DISTINCT ON (job_id) job_id, review_status
    FROM research_results
    WHERE job_id IN ${db(rows.map((row) => row.id))}
    ORDER BY job_id, created_at DESC
  `;
  const status = new Map(reviews.map((row) => [row.job_id, row.review_status]));
  return rows.map((row) => mapJob({ ...row, review_status: status.get(row.id) ?? null }));
}

export async function listResearchJobs() {
  await ensureSchema();
  const rows = await sql()<Omit<JobRow, "review_status">[]>`
    SELECT id, programme_slug, university, status, provider, created_at, started_at, completed_at, error
    FROM research_jobs
    ORDER BY created_at DESC
    LIMIT 200
  `;
  return withReview(rows);
}

export async function latestResearchJob(slug: string) {
  await ensureSchema();
  const rows = await sql()<Omit<JobRow, "review_status">[]>`
    SELECT id, programme_slug, university, status, provider, created_at, started_at, completed_at, error
    FROM research_jobs
    WHERE programme_slug = ${slug}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const jobs = await withReview(rows);
  return jobs[0] ?? null;
}

export function runningResearchBlock(job: ResearchJob | null) {
  if (job && (job.status === "queued" || job.status === "researching")) {
    return "A research job is already running for this programme.";
  }
  return null;
}

export function recentResearchWarning(job: ResearchJob | null, now = Date.now()) {
  if (!job?.completedAt) return null;
  if (job.status !== "completed") return null;
  const age = now - Date.parse(job.completedAt);
  if (!Number.isFinite(age) || age > RESEARCH_RECENT_DAYS * 24 * 60 * 60 * 1000) return null;
  return `Last researched ${job.completedAt.slice(0, 10)}. Research again?`;
}

export async function insertResearchJob(input: { slug: string; university: string; provider: string }) {
  await ensureSchema();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await sql()`
    INSERT INTO research_jobs (id, programme_slug, university, status, provider, created_at, error)
    VALUES (${id}, ${input.slug}, ${input.university}, ${"queued"}, ${input.provider}, ${createdAt}, ${""})
  `;
  return id;
}

export async function markResearching(id: string) {
  await ensureSchema();
  await sql()`UPDATE research_jobs SET status = ${"researching"}, started_at = ${new Date().toISOString()} WHERE id = ${id}`;
}

export async function completeResearchJob(id: string, slug: string, result: ResearchResult, reviewStatus: ReviewStatus = "pending_review") {
  await ensureSchema();
  const db = sql();
  const now = new Date().toISOString();
  await db.begin(async (tx) => {
    await tx`UPDATE research_jobs SET status = ${"completed"}, completed_at = ${now}, error = ${""} WHERE id = ${id}`;
    await tx`
      INSERT INTO research_results (id, job_id, programme_slug, structured_result, created_at, review_status)
      VALUES (${crypto.randomUUID()}, ${id}, ${slug}, ${db.json(result)}, ${now}, ${reviewStatus})
    `;
  });
}

export async function markResearchRateLimited(id: string, error: string) {
  await ensureSchema();
  await sql()`
    UPDATE research_jobs
    SET status = ${"rate_limited"}, completed_at = ${new Date().toISOString()}, error = ${error.slice(0, 300)}
    WHERE id = ${id}
  `;
}

export async function failResearchJob(id: string, error: string) {
  await ensureSchema();
  await sql()`
    UPDATE research_jobs
    SET status = ${"failed"}, completed_at = ${new Date().toISOString()}, error = ${error.slice(0, 300)}
    WHERE id = ${id}
  `;
}

export async function cancelResearchJob(id: string) {
  await ensureSchema();
  const rows = await sql()<{ id: string }[]>`
    UPDATE research_jobs SET status = ${"cancelled"}, completed_at = ${new Date().toISOString()}
    WHERE id = ${id} AND status = ${"queued"}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function readResearchResult(jobId: string) {
  await ensureSchema();
  const rows = await sql()<{ structured_result: ResearchResult; review_status: ReviewStatus }[]>`
    SELECT structured_result, review_status
    FROM research_results
    WHERE job_id = ${jobId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function setCatalogueDecision(jobId: string, decision: "keep" | "edit_manually" | "inactive_requested" | "investigate_later") {
  await ensureSchema();
  const saved = await readResearchResult(jobId);
  if (!saved || saved.review_status !== "catalogue_review_required") return false;
  const next = { ...saved.structured_result, catalogueDecision: decision };
  const db = sql();
  await db`UPDATE research_results SET structured_result = ${db.json(next)} WHERE job_id = ${jobId}`;
  return true;
}

export async function setReviewStatus(jobId: string, status: ReviewStatus) {
  await ensureSchema();
  await sql()`UPDATE research_results SET review_status = ${status} WHERE job_id = ${jobId}`;
}

export async function deleteResearchJob(id: string) {
  await ensureSchema();
  await sql()`DELETE FROM research_jobs WHERE id = ${id}`;
}
