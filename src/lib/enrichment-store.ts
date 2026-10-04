import { promises as fs } from "fs";
import path from "path";
import type { CatalogueCard } from "@/lib/programme-catalogue";
import {
  applyEnrichment,
  type EnrichmentRecord,
  type EnrichmentStore,
  normalizeRecord,
  removeRecord,
  saveRecord,
} from "@/lib/programme-enrichment";

const FILE = path.join(process.cwd(), "src/data/programme-enrichment.json");
const BACKUP_DIR = path.join(process.cwd(), "data/enrichment-backups");

const EMPTY: EnrichmentStore = { records: [], history: [] };

export async function readEnrichment(): Promise<EnrichmentStore> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as EnrichmentStore;
    return {
      records: Array.isArray(parsed.records) ? parsed.records : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return { ...EMPTY, records: [], history: [] };
  }
}

export async function writeEnrichment(store: EnrichmentStore) {
  await fs.writeFile(FILE, JSON.stringify(store, null, 2) + "\n", "utf8");
}

export async function backupEnrichment() {
  const raw = await fs.readFile(FILE, "utf8").catch(() => JSON.stringify(EMPTY));
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `programme-enrichment-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await fs.writeFile(file, raw, "utf8");
  return file;
}

export function applyEnrichmentStore(cards: CatalogueCard[], store: EnrichmentStore) {
  const bySlug = new Map(store.records.map((record) => [record.slug, record]));
  return cards.map((card) => applyEnrichment(card, bySlug.get(card.slug) ?? null));
}

export async function withEnrichment(cards: CatalogueCard[]) {
  return applyEnrichmentStore(cards, await readEnrichment());
}

export function importRecords(store: EnrichmentStore, rows: unknown[], knownSlugs: Set<string>, at: string) {
  if (!Array.isArray(rows)) return { store, errors: ["Import must be a JSON array."] };
  const errors: string[] = [];
  const accepted: EnrichmentRecord[] = [];
  rows.forEach((row, index) => {
    const slug = row && typeof row === "object" ? String((row as { slug?: unknown }).slug ?? "") : "";
    if (!slug || !knownSlugs.has(slug)) {
      errors.push(`Row ${index + 1} has an unknown programme slug.`);
      return;
    }
    const normalized = normalizeRecord(row, slug);
    if (!normalized.record) errors.push(...normalized.errors.map((error) => `Row ${index + 1}: ${error}`));
    else accepted.push(normalized.record);
  });
  if (errors.length) return { store, errors };
  let next = store;
  for (const record of accepted) next = saveRecord(next, record, at);
  return { store: next, errors: [] };
}

export { normalizeRecord, removeRecord, saveRecord };
