import fs from "node:fs";
import path from "node:path";

export type UniversityIdentity = {
  catalogueName: string;
  officialNames: string[];
  officialAliases: string[];
  registeredDomain: string;
  confirmedOfficialRoots: string[];
};

export type UniversityFingerprintCache = {
  read(domain: string): UniversityIdentity | null;
  write(identity: UniversityIdentity): void;
};

export type UniversityMatch = "confirmed_by_official_domain" | "confirmed_by_official_name" | "confirmed_by_catalogue_text";

const INSTITUTION = /universit[aà]|university|politecnic|ateneo/i;

function cleanName(value: string) {
  const text = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 8 || text.length > 140 || !INSTITUTION.test(text)) return null;
  return text;
}

function addName(target: string[], value: string | null) {
  if (!value) return;
  if (!target.some((item) => item.localeCompare(value, undefined, { sensitivity: "accent" }) === 0)) target.push(value);
}

function namesFromJsonLd(html: string, officialNames: string[], officialAliases: string[]) {
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]) as unknown;
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const record = row as { "@type"?: string | string[]; name?: unknown; alternateName?: unknown };
        const type = Array.isArray(record["@type"]) ? record["@type"].join(" ") : String(record["@type"] ?? "");
        if (!/organization|college|university|educational/i.test(type)) continue;
        addName(officialNames, cleanName(String(record.name ?? "")));
        const alternates = Array.isArray(record.alternateName) ? record.alternateName : [record.alternateName];
        for (const alternate of alternates) addName(officialAliases, cleanName(String(alternate ?? "")));
      }
    } catch {
      continue;
    }
  }
}

function namesFromRegion(html: string, pattern: RegExp, officialAliases: string[]) {
  const region = html.match(pattern)?.[0] ?? "";
  const text = region.replace(/<[^>]+>/g, "\n");
  for (const line of text.split(/\n+/)) addName(officialAliases, cleanName(line));
}

export function extractOfficialUniversityNames(html: string) {
  const officialNames: string[] = [];
  const officialAliases: string[] = [];
  addName(officialNames, cleanName(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""));
  for (const match of html.matchAll(/<meta[^>]*(?:property|name)=["'](?:og:site_name|application-name)["'][^>]*content=["']([^"']+)["'][^>]*>/gi)) {
    addName(officialNames, cleanName(match[1]));
  }
  for (const match of html.matchAll(/<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:site_name|application-name)["'][^>]*>/gi)) {
    addName(officialNames, cleanName(match[1]));
  }
  namesFromJsonLd(html, officialNames, officialAliases);
  namesFromRegion(html, /<header\b[\s\S]{0,4000}?<\/header>/i, officialAliases);
  namesFromRegion(html, /<footer\b[\s\S]{0,4000}?<\/footer>/i, officialAliases);
  return {
    officialNames: officialNames.slice(0, 8),
    officialAliases: officialAliases.filter((alias) => !officialNames.some((name) => name.localeCompare(alias, undefined, { sensitivity: "accent" }) === 0)).slice(0, 8),
  };
}

export function hostOnRegisteredDomain(url: string, domain: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    const registered = domain.replace(/^www\./, "").toLowerCase();
    return host === registered || host.endsWith(`.${registered}`);
  } catch {
    return false;
  }
}

export function memoryUniversityFingerprintCache(initial: UniversityIdentity[] = []): UniversityFingerprintCache {
  const rows = initial.map((row) => ({ ...row, officialNames: [...row.officialNames], officialAliases: [...row.officialAliases], confirmedOfficialRoots: [...row.confirmedOfficialRoots] }));
  return {
    read(domain) {
      const found = rows.find((row) => row.registeredDomain === domain);
      return found ? { ...found, officialNames: [...found.officialNames], officialAliases: [...found.officialAliases], confirmedOfficialRoots: [...found.confirmedOfficialRoots] } : null;
    },
    write(identity) {
      const index = rows.findIndex((row) => row.registeredDomain === identity.registeredDomain);
      if (index >= 0) rows[index] = identity;
      else rows.push(identity);
    },
  };
}

function fingerprintFile() {
  return path.join(process.cwd(), "data", "university-fingerprints.json");
}

export function fileUniversityFingerprintCache(): UniversityFingerprintCache {
  const readRows = (): UniversityIdentity[] => {
    try {
      const parsed = JSON.parse(fs.readFileSync(fingerprintFile(), "utf8")) as { fingerprints?: UniversityIdentity[] };
      return Array.isArray(parsed.fingerprints) ? parsed.fingerprints : [];
    } catch {
      return [];
    }
  };
  return {
    read(domain) {
      return readRows().find((row) => row.registeredDomain === domain) ?? null;
    },
    write(identity) {
      const rows = readRows().filter((row) => row.registeredDomain !== identity.registeredDomain);
      rows.push(identity);
      const file = fingerprintFile();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ fingerprints: rows.slice(-80) }, null, 2));
    },
  };
}

function mergeUnique(current: string[], next: string[], limit: number) {
  const merged = [...current];
  for (const item of next) addName(merged, item);
  return merged.slice(0, limit);
}

export function rememberUniversityFingerprint(
  cache: UniversityFingerprintCache,
  input: { catalogueName: string; registeredDomain: string; pageUrl: string; html: string },
) {
  if (!input.registeredDomain || !hostOnRegisteredDomain(input.pageUrl, input.registeredDomain)) return cache.read(input.registeredDomain);
  const extracted = extractOfficialUniversityNames(input.html);
  const current = cache.read(input.registeredDomain);
  let origin = "";
  try {
    origin = new URL(input.pageUrl).origin;
  } catch {
    origin = "";
  }
  const identity: UniversityIdentity = {
    catalogueName: input.catalogueName || current?.catalogueName || "",
    officialNames: mergeUnique(current?.officialNames ?? [], extracted.officialNames, 8),
    officialAliases: mergeUnique(current?.officialAliases ?? [], extracted.officialAliases, 8),
    registeredDomain: input.registeredDomain,
    confirmedOfficialRoots: mergeUnique(current?.confirmedOfficialRoots ?? [], origin ? [origin] : [], 12),
  };
  cache.write(identity);
  return identity;
}
