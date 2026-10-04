import { officialTargetBlock } from "@/lib/research/fetch-safety";
import type { LinkedDocument, LinkedDocumentPurpose } from "@/lib/research/research-schema";

export type PageLink = {
  href: string;
  anchorText: string;
  rel: string | null;
  sourceUrl: string;
};

export type AdmissionLinkKind =
  | "international"
  | "programme_admission"
  | "foreign_qualification"
  | "visa_pre_enrolment"
  | "universitaly"
  | "generic_admission";

const RANK: Record<AdmissionLinkKind, number> = {
  international: 1,
  programme_admission: 2,
  foreign_qualification: 3,
  visa_pre_enrolment: 4,
  universitaly: 5,
  generic_admission: 6,
};

const NOISE = /\/news\/|\/notizie\/|\/eventi\/|facebook|instagram|linkedin|twitter|youtube|\/login|\/logout|privacy|cookie/i;

function decodeText(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAdmissionUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  url.hostname = url.hostname.replace(/^www\./, "").toLowerCase();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/, "");
  url.pathname = url.pathname.replace(/^\/en(?=\/)/i, "") || "/";
  return `${url.hostname}${url.pathname}${url.search}`;
}

export function pageLinksFromHtml(html: string, sourceUrl: string, domains: string[], limit = 2000): PageLink[] {
  const found: PageLink[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const raw = match[2];
    if (raw.startsWith("#") || /^mailto:|^javascript:/i.test(raw)) continue;
    let href = "";
    try {
      href = new URL(raw, sourceUrl).toString();
    } catch {
      continue;
    }
    if (officialTargetBlock(href, domains)) continue;
    let key = href;
    try {
      key = normalizeAdmissionUrl(href);
    } catch {
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const rel = /rel=["']([^"']+)["']/i.exec(`${match[1]} ${match[3]}`)?.[1] ?? null;
    found.push({
      href,
      anchorText: decodeText(match[4].replace(/<[^>]+>/g, " ")).slice(0, 180),
      rel,
      sourceUrl,
    });
    if (found.length >= limit) break;
  }
  return found;
}

export function admissionLinkKind(link: Pick<PageLink, "href" | "anchorText">): AdmissionLinkKind | null {
  const blob = `${link.href} ${link.anchorText}`;
  if (NOISE.test(blob)) return null;
  if (/studenti[\s-]internazionali|international students|international admissions|extra-?\s*ue|non-eu|non-ue/i.test(blob)) return "international";
  if (/titolo[\s-]estero|foreign qualification|candidati con titolo estero/i.test(blob)) return "foreign_qualification";
  if (/universitaly/i.test(blob)) return "universitaly";
  if (/\bvisa\b|pre-?enrol|pre-?iscrizion|preiscrizione/i.test(blob)) return "visa_pre_enrolment";
  if (/avviso di ammissione|call for admission|\bbando\b/i.test(blob)) return "programme_admission";
  if (/ammission|admission|\bapplication\b|candidatur/i.test(blob)) return "generic_admission";
  return null;
}

export type HubTarget = {
  labels: string[];
  degreeClass?: string | null;
  englishVariant: boolean;
};

const ENGLISH_VARIANT_KEY = /\bin english\b|\bin lingua inglese\b|\benglish taught\b|\btaught in english\b/;
const ITALIAN_VARIANT_KEY = /\bin lingua italiana\b|\btaught in italian\b|\bitalian taught\b/;

function linkKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function linkBlob(link: Pick<PageLink, "href" | "anchorText">) {
  let path = link.href;
  try {
    path = decodeURIComponent(new URL(link.href).pathname);
  } catch {
    path = link.href;
  }
  return linkKey(`${link.anchorText} ${path}`);
}

/** Links on an admission hub that name the confirmed programme, strongest first. Links without a full programme label never qualify. */
export function rankHubTargetLinks(links: PageLink[], target: HubTarget) {
  const labels = [...new Set(target.labels.map(linkKey).filter((item) => item.length > 3))];
  const degreeClass = target.degreeClass ? linkKey(target.degreeClass) : "";
  const scored = links.flatMap((link, index) => {
    if (NOISE.test(`${link.href} ${link.anchorText}`)) return [];
    const key = linkBlob(link);
    if (!labels.some((label) => key.includes(label))) return [];
    const english = ENGLISH_VARIANT_KEY.test(key);
    if (target.englishVariant ? !english || ITALIAN_VARIANT_KEY.test(key) : english) return [];
    let score = 6;
    if (english) score += 3;
    if (degreeClass && key.includes(degreeClass)) score += 2;
    if (/\b20\d\d (?:20)?\d\d\b/.test(key)) score += 1;
    if (/ammission|admission|\bbando\b|\bbandi\b|\bimat\b|\btest\b|\bcall\b/.test(key)) score += 1;
    return [{ link, score, index }];
  });
  scored.sort((left, right) => right.score - left.score || left.index - right.index);
  const seen = new Set<string>();
  const ranked: PageLink[] = [];
  for (const item of scored) {
    let key = item.link.href;
    try {
      key = normalizeAdmissionUrl(item.link.href);
    } catch {
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    ranked.push(item.link);
  }
  return ranked;
}

export function selectAdmissionLinks(links: PageLink[], options: { kinds?: AdmissionLinkKind[]; limit?: number } = {}) {
  const kinds = new Set(options.kinds ?? (Object.keys(RANK) as AdmissionLinkKind[]));
  const ranked = links.flatMap((link, index) => {
    const kind = admissionLinkKind(link);
    if (!kind || !kinds.has(kind)) return [];
    return [{ ...link, kind, rank: RANK[kind], index }];
  });
  ranked.sort((left, right) => left.rank - right.rank || left.index - right.index);
  const seen = new Set<string>();
  const selected: PageLink[] = [];
  for (const link of ranked) {
    let key = link.href;
    try {
      key = normalizeAdmissionUrl(link.href);
    } catch {
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push({ href: link.href, anchorText: link.anchorText, rel: link.rel, sourceUrl: link.sourceUrl });
    if (selected.length >= (options.limit ?? 3)) break;
  }
  return selected;
}

const PDF_RELEVANT = /ammission|bando|call|imat|prova|anagraf|distribution|general.?inform|informazioni|venue|sede|emanazione|decreto/i;

export function classifyAdmissionPdf(label: string): LinkedDocumentPurpose | null {
  const hay = label.toLowerCase();
  if (!PDF_RELEVANT.test(hay)) return null;
  if (/venue|sede della prova|sede del test|luogo della prova/.test(hay)) return "venue_notice_pdf";
  if (/general.?inform|informazioni generali/.test(hay)) return "general_information_pdf";
  if (/bando|call for applic|call_for|decreto|emanazione/.test(hay)) return "admission_call_pdf";
  return "other_admission_pdf";
}

export function admissionPdfInventory(links: PageLink[], limit = 8): LinkedDocument[] {
  const found: LinkedDocument[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    if (!/\.pdf($|\?)/i.test(link.href)) continue;
    let filename = link.href.split("/").pop()?.split("?")[0] ?? "";
    try {
      filename = decodeURIComponent(filename);
    } catch {
      filename = filename;
    }
    const purpose = classifyAdmissionPdf(`${link.anchorText} ${filename}`);
    if (!purpose || seen.has(link.href)) continue;
    seen.add(link.href);
    found.push({ url: link.href.slice(0, 400), label: (link.anchorText || filename).slice(0, 180), purpose });
    if (found.length >= limit) break;
  }
  return found;
}
