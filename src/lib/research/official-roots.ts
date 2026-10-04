import fs from "node:fs";
import path from "node:path";

export const HEALTHY_ROOT_MS = 7 * 24 * 60 * 60 * 1000;
export const TLS_RETRY_MS = 24 * 60 * 60 * 1000;

export type RootRole = "main" | "orientation" | "international" | "school" | "department" | "catalogue" | "other";
export type RootHealth = "healthy" | "tls_unavailable";
/** How a same-family host earned trust as a discovery root. Never identity evidence. */
export type RootVia = "catalogue_hint" | "official_navigation";

export type OfficialRootRecord = {
  origin: string;
  domain: string;
  role: RootRole;
  state: RootHealth;
  lastChecked: string;
  via?: RootVia;
};

export type OfficialRootCache = {
  read(domain: string): OfficialRootRecord[];
  write(record: OfficialRootRecord): void;
};

export function rootRole(origin: string): RootRole {
  let host = "";
  try {
    host = new URL(origin).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "other";
  }
  const label = host.split(".")[0] ?? "";
  if (!label || host.split(".").length <= 2) return "main";
  if (/^orienta|^orientation|^orientamento/.test(label)) return "orientation";
  if (/^international|^internazionale/.test(label)) return "international";
  if (/^scuola|^school|^facolta|^faculty/.test(label)) return "school";
  if (/^informatica|^ingegneria|^dipartimento|^department/.test(label)) return "department";
  if (/^corsi|^didattica|^catalogue|^catalogo/.test(label)) return "catalogue";
  return "other";
}

export function memoryOfficialRootCache(initial: OfficialRootRecord[] = []): OfficialRootCache {
  const rows = initial.map((row) => ({ ...row }));
  return {
    read(domain) {
      return rows.filter((row) => row.domain === domain).map((row) => ({ ...row }));
    },
    write(record) {
      const index = rows.findIndex((row) => row.origin === record.origin);
      if (index >= 0) rows[index] = { ...record };
      else rows.push({ ...record });
    },
  };
}

function cacheFile() {
  return path.join(process.cwd(), "data", "official-root-cache.json");
}

export function fileOfficialRootCache(): OfficialRootCache {
  const readRows = (): OfficialRootRecord[] => {
    try {
      const parsed = JSON.parse(fs.readFileSync(cacheFile(), "utf8")) as { roots?: OfficialRootRecord[] };
      return Array.isArray(parsed.roots) ? parsed.roots : [];
    } catch {
      return [];
    }
  };
  return {
    read(domain) {
      return readRows().filter((row) => row.domain === domain);
    },
    write(record) {
      const rows = readRows().filter((row) => row.origin !== record.origin);
      rows.push(record);
      const file = cacheFile();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ roots: rows.slice(-200) }, null, 2));
    },
  };
}

export function recordRootHealth(
  cache: OfficialRootCache,
  domain: string,
  url: string,
  state: RootHealth,
  now: number,
  learned: { role?: RootRole; via?: RootVia } = {},
) {
  let origin = "";
  try {
    origin = new URL(url).origin;
  } catch {
    return;
  }
  const previous = cache.read(domain).find((row) => row.origin === origin);
  const via = learned.via ?? previous?.via;
  const role = learned.role ?? (previous?.via ? previous.role : rootRole(origin));
  cache.write({ origin, domain, role, state, lastChecked: new Date(now).toISOString(), ...(via ? { via } : {}) });
}

/** Healthy same-family hosts learned from catalogue hints or official navigation. */
export function learnedDiscoveryRoots(cache: OfficialRootCache, domain: string, now: number) {
  return cache.read(domain).filter((row) => row.via && row.state === "healthy" && ageMs(row, now) < HEALTHY_ROOT_MS);
}

export function ageMs(record: OfficialRootRecord, now: number) {
  const checked = Date.parse(record.lastChecked);
  return Number.isFinite(checked) ? now - checked : Number.POSITIVE_INFINITY;
}

export function officialHostCooling(cache: OfficialRootCache, domain: string, url: string, now: number) {
  let origin = "";
  try {
    origin = new URL(url).origin;
  } catch {
    return false;
  }
  const row = cache.read(domain).find((item) => item.origin === origin);
  return Boolean(row && row.state === "tls_unavailable" && ageMs(row, now) < TLS_RETRY_MS);
}
