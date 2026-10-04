import { getCatalogue, getProgrammeBySlug } from "@/lib/data";
import { resolveCatalogueSlug, type CatalogueCard } from "@/lib/programme-catalogue";
import {
  addShortlistItem,
  listShortlist,
  mergeShortlistItems,
  removeShortlistItem,
  SHORTLIST_LIMIT,
} from "@/lib/portal-store/shortlist";
import type { ShortlistEntry } from "@/lib/student-types";

export { SHORTLIST_LIMIT };

export type ShortlistItem = ShortlistEntry & {
  programme: CatalogueCard | null;
};

function cardFor(catalogue: CatalogueCard[], slug: string) {
  const resolved = resolveCatalogueSlug(catalogue, slug);
  return catalogue.find((item) => item.slug === resolved) ?? null;
}

export async function hydrateShortlist(entries: ShortlistEntry[]): Promise<ShortlistItem[]> {
  const catalogue = await getCatalogue();
  const seen = new Set<string>();
  const items: ShortlistItem[] = [];
  for (const entry of entries) {
    const programme = cardFor(catalogue, entry.slug);
    const slug = programme?.slug ?? entry.slug;
    if (seen.has(slug)) continue;
    seen.add(slug);
    items.push({ slug, savedAt: entry.savedAt, programme });
  }
  return items;
}

export async function accountShortlist(studentId: string) {
  const entries = await listShortlist(studentId);
  if (!entries) return null;
  return hydrateShortlist(entries);
}

export async function addAccountShortlist(
  studentId: string,
  slug: string,
): Promise<{ items: ShortlistItem[]; duplicate: boolean } | { error: "shortlist-full" } | null> {
  const programme = await getProgrammeBySlug(slug);
  const canonical = programme?.slug ?? slug;
  const existing = await listShortlist(studentId);
  if (!existing) return null;
  const catalogue = await getCatalogue();
  if (existing.some((entry) => resolveCatalogueSlug(catalogue, entry.slug) === canonical)) {
    return { items: await hydrateShortlist(existing), duplicate: true };
  }
  const result = await addShortlistItem(studentId, canonical);
  if (!result) return null;
  if ("error" in result) return { error: result.error };
  return { items: await hydrateShortlist(result.entries), duplicate: result.duplicate };
}

export async function removeAccountShortlist(studentId: string, slug: string) {
  const catalogue = await getCatalogue();
  const canonical = resolveCatalogueSlug(catalogue, slug);
  const card = catalogue.find((item) => item.slug === canonical);
  const slugs = card ? [card.slug, ...(card.aliasSlugs ?? [])] : [slug];
  let entries: ShortlistEntry[] | null = null;
  for (const item of slugs) {
    entries = await removeShortlistItem(studentId, item);
    if (!entries) return null;
  }
  return hydrateShortlist(entries ?? []);
}

export async function mergeAccountShortlist(studentId: string, slugs: string[]) {
  const catalogue = await getCatalogue();
  const existing = await listShortlist(studentId);
  if (!existing) return null;
  const saved = new Set(existing.map((entry) => resolveCatalogueSlug(catalogue, entry.slug)));
  const fresh = slugs
    .map((slug) => resolveCatalogueSlug(catalogue, slug))
    .filter((slug) => !saved.has(slug));
  const entries = await mergeShortlistItems(studentId, fresh);
  if (!entries) return null;
  return hydrateShortlist(entries);
}
