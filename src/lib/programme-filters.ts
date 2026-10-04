import type { CatalogueCard, CatalogueLevel } from "@/lib/programme-catalogue";
import { englishBand } from "@/lib/english-band";

export type FeeBand = "any" | "free" | "20" | "30" | "50";
export type EnglishChoice = "any" | "ielts" | "toefl" | "moi" | "other" | "undecided";
export type SortKey = "deadline" | "fee" | "university" | "name" | "updated";

export type FinderQuery = {
  q: string;
  level: "" | CatalogueLevel;
  field: string[];
  region: string[];
  city: string[];
  english: EnglishChoice;
  fee: FeeBand;
  status: "" | "open" | "closing" | "upcoming" | "all";
  sort: SortKey;
  centS: boolean;
  gre: boolean;
  test: boolean;
};

export const EMPTY_FINDER: FinderQuery = {
  q: "",
  level: "",
  field: [],
  region: [],
  city: [],
  english: "any",
  fee: "any",
  status: "",
  sort: "name",
  centS: false,
  gre: false,
  test: false,
};

function list(value: string) {
  return value
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function finderQueryFromRecord(record: Record<string, string | undefined>): FinderQuery {
  const english = record.english || "any";
  const fee = record.fee || "any";
  const sort = record.sort || "name";
  const level = record.level || "";
  const status = record.status || "";
  return {
    q: record.q || "",
    level: level === "bachelor" || level === "master" || level === "single-cycle" || level === "phd" ? level : "",
    field: list(record.field || ""),
    region: list(record.region || ""),
    city: list(record.city || ""),
    english:
      english === "ielts" || english === "toefl" || english === "moi" || english === "other" || english === "undecided"
        ? english
        : "any",
    fee: fee === "free" || fee === "20" || fee === "30" || fee === "50" ? fee : "any",
    status: status === "open" || status === "closing" || status === "upcoming" || status === "all" ? status : "",
    sort: sort === "deadline" || sort === "fee" || sort === "university" || sort === "updated" ? sort : "name",
    centS: record.cent === "1",
    gre: record.gre === "1",
    test: record.test === "1",
  };
}

export function finderQueryToParams(query: FinderQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.level) params.set("level", query.level);
  if (query.field.length) params.set("field", query.field.join("|"));
  if (query.region.length) params.set("region", query.region.join("|"));
  if (query.city.length) params.set("city", query.city.join("|"));
  if (query.english !== "any") params.set("english", query.english);
  if (query.fee !== "any") params.set("fee", query.fee);
  if (query.status && query.status !== "all") params.set("status", query.status);
  if (query.sort !== "name") params.set("sort", query.sort);
  if (query.centS) params.set("cent", "1");
  if (query.gre) params.set("gre", "1");
  if (query.test) params.set("test", "1");
  return params;
}

function feeMatches(fee: number | null, band: FeeBand) {
  if (band === "any") return true;
  if (fee === null) return false;
  if (band === "free") return fee === 0;
  return fee < Number(band);
}

function fieldMatches(program: CatalogueCard, fields: string[]) {
  if (!fields.length) return true;
  const hay = `${program.field} ${program.name}`.toLowerCase();
  return fields.some((field) => hay.includes(field.toLowerCase()));
}

function englishMatches(program: CatalogueCard, choice: EnglishChoice) {
  if (choice === "any" || choice === "undecided") return true;
  const note = program.englishRequirement.toLowerCase();
  const band = englishBand(program.englishRequirement);
  if (choice === "moi") return band === "moi";
  if (choice === "ielts") return /ielts/.test(note);
  if (choice === "toefl") return /toefl/.test(note);
  return Boolean(note) && band === "unknown";
}

export function filterProgrammes(programmes: CatalogueCard[], query: FinderQuery) {
  const q = query.q.trim().toLowerCase();
  return programmes.filter((program) => {
    if (query.level && program.level !== query.level) return false;
    if (!fieldMatches(program, query.field)) return false;
    if (query.region.length && !query.region.includes(program.region)) return false;
    if (query.city.length && !query.city.includes(program.city)) return false;
    if (!englishMatches(program, query.english)) return false;
    if (!feeMatches(program.applicationFeeEuro, query.fee)) return false;
    if (query.status && query.status !== "all" && program.finderStatus !== query.status) return false;
    if (query.centS && !program.centS) return false;
    if (query.gre && !program.greGmat) return false;
    if (query.test && !program.admissionTest) return false;
    if (!q) return true;
    const history = [
      ...(program.historicalTitles ?? []),
      ...(program.renames ?? []).flatMap((item) => [item.title, item.italianTitle ?? ""]),
      program.italianTitle ?? "",
    ];
    return [program.name, program.universityName, program.city, program.field, program.admissionTest, ...history]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
}

export function sortProgrammes(programmes: CatalogueCard[], sort: SortKey) {
  const rows = [...programmes];
  rows.sort((a, b) => {
    if (sort === "university") return a.universityName.localeCompare(b.universityName) || a.name.localeCompare(b.name);
    if (sort === "fee") {
      const left = a.applicationFeeEuro ?? Number.POSITIVE_INFINITY;
      const right = b.applicationFeeEuro ?? Number.POSITIVE_INFINITY;
      return left - right || a.name.localeCompare(b.name);
    }
    if (sort === "updated") return b.catalogueChecked.localeCompare(a.catalogueChecked) || a.name.localeCompare(b.name);
    if (sort === "deadline") {
      const left = a.countdown ? 0 : 1;
      const right = b.countdown ? 0 : 1;
      if (left !== right) return left - right;
      return (a.deadline || "9999").localeCompare(b.deadline || "9999") || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name) || a.universityName.localeCompare(b.universityName);
  });
  return rows;
}

export function levelLabel(level: CatalogueLevel) {
  switch (level) {
    case "bachelor":
      return "Bachelor's";
    case "master":
      return "Master's";
    case "single-cycle":
      return "Medicine / single-cycle";
    default:
      return "PhD";
  }
}
