import { buildDiscoveryQueries, searchTitleVariants, splitCatalogueTitle } from "@/lib/research/discovery";
import { officialDomains, researchBudget } from "@/lib/research/research-budget";
import type { ResearchSubject } from "@/lib/research/research-schema";

export function trackSearchPhrases(value: string | null) {
  if (!value) return [];
  return value
    .split(/\s*(?:\band\b|\be\b|&)\s*/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 2);
}

export function italianDegreePhrase(level: string) {
  if (level === "master") return "Laurea Magistrale";
  if (level === "bachelor") return "Laurea";
  if (level === "single-cycle") return "Laurea Magistrale a Ciclo Unico";
  if (level === "phd") return "Dottorato";
  return level;
}

function quoteTerm(value: string) {
  return `"${value.replace(/"/g, "")}"`;
}

function englishLevelWord(level: string) {
  if (level === "master" || level === "bachelor" || level === "phd" || level === "single-cycle") return level;
  return level;
}

export function buildUrlDiscoveryQuery(
  subject: Pick<ResearchSubject, "name" | "level" | "universityName" | "universityWebsite" | "admissionPortal"> & Partial<Pick<ResearchSubject, "language" | "italianTitle">>,
  pass: 1 | 2,
) {
  const domain = officialDomains(subject)[0] ?? "";
  const parts = splitCatalogueTitle(subject.name);
  const track = trackSearchPhrases(parts.curriculumOrTrack);
  if (pass === 1) {
    return [`site:${domain}`, quoteTerm(parts.programmeName), ...track.map(quoteTerm), englishLevelWord(subject.level), quoteTerm(subject.universityName)].join(" ");
  }
  const variant = searchTitleVariants({ name: subject.name, language: subject.language ?? "", italianTitle: subject.italianTitle ?? null })[0];
  if (!track.length && variant) return [`site:${domain}`, quoteTerm(italianDegreePhrase(subject.level)), quoteTerm(variant)].join(" ");
  const distinctive = track.length ? track : trackSearchPhrases(parts.programmeName);
  const phrases = distinctive.length ? distinctive : [parts.programmeName];
  return [`site:${domain}`, quoteTerm(italianDegreePhrase(subject.level)), ...phrases.map(quoteTerm)].join(" ");
}

export function buildResearchPrompt(subject: ResearchSubject) {
  const budget = researchBudget();
  const queries = buildDiscoveryQueries(subject);
  return [
    "Stage A: find official source candidates. Identity is confirmed only after a page is read.",
    `Use at most ${budget.maxToolCalls} web searches. Stop early when an official programme page is found. Do not use extra searches once that page is open.`,
    "Search official information in English AND in Italian. A missing English page is not a failure when the Italian official page confirms the programme.",
    ...queries.map((query) => `Query: ${query}`),
    "Also use the Italian concepts bando di ammissione, requisiti di accesso, requisiti curriculari, candidati extra-UE, studenti internazionali, residenti all'estero, lingua inglese, scadenze, tasse universitarie, domanda di ammissione, test di ammissione.",
    "A different-language title may be a candidate. Do not treat it as the same programme until the page shows the university, degree level, and an official name or degree class.",
    "Reject a page when the degree level differs from the catalogue row. Bachelor is not Laurea Magistrale. Master is not a bachelor's Laurea. Single-cycle Medicine is not a generic medical master's. Dottorato is PhD.",
    "Prefer programme, course, and admission-call pages. Do not prefer news or event articles.",
    "If you open an official programme index, follow at most 3 programme links from it.",
    "Return compact JSON only. Never mark anything verified. reviewStatus must be pending_review.",
    "",
    `Programme slug: ${subject.slug}`,
    `Programme: ${subject.name}`,
    `Catalogue degree level: ${subject.level}`,
    `University: ${subject.universityName}`,
    `City: ${subject.city}`,
    `Region: ${subject.region}`,
    `University website: ${subject.universityWebsite || "unknown"}`,
    `Application portal: ${subject.admissionPortal || "unknown"}`,
    "",
    "JSON shape: {\"searchesAttempted\":[],\"identity\":{\"officialProgrammeName\":null,\"university\":null,\"degreeLevel\":null,\"language\":null,\"englishTaught\":null},\"sources\":[{\"url\":\"\",\"title\":\"\",\"sourceType\":\"official_programme_page\",\"language\":\"it\",\"academicYear\":null,\"scope\":\"programme\"}],\"unknownFields\":[],\"reviewStatus\":\"pending_review\"}",
  ].join("\n");
}

export function buildUrlDiscoveryPrompt(subject: ResearchSubject, pass: 1 | 2) {
  const domain = officialDomains(subject)[0] ?? "";
  const label = pass === 1 ? "Pass 1, English catalogue title." : "Pass 2, Italian degree structure. Do not invent a translated programme title.";
  return [
    "Official URL discovery only. One web search, restricted to the university domain.",
    label,
    "Return up to 3 official programme, course-catalogue, or orientation URLs. Prefer different official subdomains when more than one official host appears.",
    "Prefer an HTML programme page. Rank course and orientation HTML above department and admission pages, and rank PDF regulations, news, events, and announcements below them.",
    "Do not extract IELTS, TOEFL, MOI, tuition, deadlines, fees, tests, or CFU.",
    `Query: ${buildUrlDiscoveryQuery(subject, pass)}`,
    `Programme: ${subject.name}`,
    `Degree level: ${subject.level}`,
    `University: ${subject.universityName}`,
    `Official domain: ${domain}`,
    "JSON: {\"sources\":[{\"url\":\"\",\"title\":\"\",\"sourceType\":\"official_programme_page\",\"language\":\"it\",\"scope\":\"programme\"}]}",
  ].join("\n");
}

export function buildAdmissionQuery(subject: Pick<ResearchSubject, "name" | "universityWebsite" | "admissionPortal">, pass: 1 | 2) {
  const domain = officialDomains(subject)[0] ?? "";
  const parts = splitCatalogueTitle(subject.name);
  const track = trackSearchPhrases(parts.curriculumOrTrack);
  if (pass === 1) {
    const name = track.length ? track.map(quoteTerm).join(" ") : quoteTerm(parts.programmeName);
    return `site:${domain} ${name} "ammissione"`;
  }
  return `site:${domain} "studenti extra-UE residenti all'estero" "ammissione"`;
}

export function buildUniversitalyQuery(subject: Pick<ResearchSubject, "name" | "universityWebsite" | "admissionPortal">) {
  const domain = officialDomains(subject)[0] ?? "";
  const parts = splitCatalogueTitle(subject.name);
  const track = trackSearchPhrases(parts.curriculumOrTrack);
  const token = track[0] ? quoteTerm(track[0]) : quoteTerm(parts.programmeName);
  return `site:${domain} Universitaly "pre-iscrizione" ${token}`;
}

function admissionNames(subject: ResearchSubject, aliases: string[]) {
  return [subject.name, ...aliases].filter((name, index, all) => name && all.indexOf(name) === index).slice(0, 4).join(" | ");
}

export function buildAdmissionPrompt(subject: ResearchSubject, aliases: string[], pass: 1 | 2) {
  const focus = pass === 1
    ? "Admission search 1. Find the official programme application or admission page."
    : "Admission search 2. Find the official page for international students, non-EU students residing abroad, visa applicants, or foreign qualifications.";
  return [
    "The programme identity is already confirmed. Official URL discovery only. One web search, restricted to the university domain.",
    focus,
    "Return up to 3 official admission URLs. Do not extract IELTS, TOEFL, MOI, tuition, fees, CFU, or dates.",
    "Immatricolazione and enrolment dates are not the application deadline. Universitaly pre-enrolment stays separate.",
    "An international applicant is not the same as a non-EU student residing abroad.",
    `Query: ${buildAdmissionQuery(subject, pass)}`,
    `Programme: ${admissionNames(subject, aliases)}`,
    `Catalogue degree level: ${subject.level}`,
    `University: ${subject.universityName}`,
    "JSON: {\"sources\":[{\"url\":\"\",\"title\":\"\",\"sourceType\":\"official_admission_call\",\"language\":\"it\",\"scope\":\"programme\"}]}",
  ].join("\n");
}

export function buildUniversitalyPrompt(subject: ResearchSubject, aliases: string[]) {
  return [
    "The programme identity is already confirmed. Universitaly search. One web search, restricted to the university domain.",
    "Find an official Universitaly or pre-enrolment instruction. Do not extract application or enrolment deadlines.",
    "Do not extract IELTS, TOEFL, MOI, tuition, fees, or CFU.",
    `Query: ${buildUniversitalyQuery(subject)}`,
    `Programme: ${admissionNames(subject, aliases)}`,
    `University: ${subject.universityName}`,
    "JSON: {\"sources\":[{\"url\":\"\",\"title\":\"\",\"sourceType\":\"official_admission_call\",\"language\":\"it\",\"scope\":\"programme\"}]}",
  ].join("\n");
}

export function buildExtractionPrompt(subject: ResearchSubject, sources: Array<{ url: string; title: string; text: string }>) {
  const packed = sources.map((source, index) => `SOURCE ${index + 1}\nURL: ${source.url}\nTITLE: ${source.title}\nTEXT:\n${source.text.slice(0, 3500)}`).join("\n\n");
  return [
    "Stage B: extract compact JSON only from the source text below. Do not search again.",
    "Use null when the text does not state the fact. Do not add fees, tuition, IELTS, MOI, CFU, or dates from memory.",
    "Teaching language is true only for an explicit phrase such as Lingua di erogazione: Inglese or Taught in English.",
    "Enrolment and immatricolazione dates are not application deadlines. A Non-EU or visa application deadline must be explicit. Universitaly pre-enrolment stays separate.",
    "Keep English and Italian source URLs. Output in English.",
    `Catalogue degree level: ${subject.level}. Programme: ${subject.name}. University: ${subject.universityName}.`,
    packed,
  ].join("\n");
}

export function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}
