import { promises as fs } from "fs";
import path from "path";
import type { ErasmusGuide, TranslationGuide, CompanyProfile } from "./content-types";

export type { ErasmusGuide, TranslationGuide, CompanyProfile } from "./content-types";

const DATA = path.join(process.cwd(), "src/data");

export async function getErasmusGuide(): Promise<ErasmusGuide> {
  const raw = await fs.readFile(path.join(DATA, "erasmus.json"), "utf8");
  return JSON.parse(raw) as ErasmusGuide;
}

export async function getTranslationGuide(): Promise<TranslationGuide> {
  const raw = await fs.readFile(path.join(DATA, "translation-companies.json"), "utf8");
  return JSON.parse(raw) as TranslationGuide;
}

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const raw = await fs.readFile(path.join(DATA, "company.json"), "utf8");
  return JSON.parse(raw) as CompanyProfile;
}
