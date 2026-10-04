import { promises as fs } from "fs";
import path from "path";
import { cachedJsonReader, CACHE_TAGS } from "@/lib/cache";
import type { PhdDataset, PhdUniversity } from "@/lib/phd-types";

const DATA_PATH = path.join(process.cwd(), "src/data/phd.json");

async function readFromDisk(): Promise<PhdDataset> {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  return JSON.parse(raw) as PhdDataset;
}

export async function getPhdDataset(): Promise<PhdDataset> {
  return cachedJsonReader(CACHE_TAGS.phd, "phd-dataset", readFromDisk);
}

export async function getPhdUniversities(): Promise<PhdUniversity[]> {
  const data = await getPhdDataset();
  return [...data.universities].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.name.localeCompare(b.name);
  });
}

export async function getPhdUniversity(id: string): Promise<PhdUniversity | undefined> {
  const universities = await getPhdUniversities();
  return universities.find((u) => u.id === id);
}
