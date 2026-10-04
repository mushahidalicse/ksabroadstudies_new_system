import { catalogLevel, splitCatalogueTitle, type CatalogLevel } from "@/lib/research/discovery";
import { datedEvents, isApplyByDate, type DatePageContext, type DatedEvent } from "@/lib/research/extract-facts";
import type { ConfirmedProgrammeIdentity, ResearchSubject } from "@/lib/research/research-schema";

export type AdmissionSourceScope =
  | "programme_specific"
  | "department_specific"
  | "university_wide"
  | "national"
  | "unrelated_programme"
  | "unknown";

export type AdmissionPage = { url: string; title: string; text?: string };

const INTERNATIONAL_DEADLINE: Set<DatedEvent["dateType"]> = new Set([
  "non_eu_application_deadline",
  "non_eu_abroad_deadline",
  "non_eu_deadline",
  "visa_applicant_deadline",
]);

function blobOf(page: AdmissionPage) {
  return `${page.url} ${page.title} ${page.text ?? ""}`.toLowerCase();
}

function sameUrl(left: string, right: string) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return a.origin === b.origin && a.pathname.replace(/\/$/, "") === b.pathname.replace(/\/$/, "");
  } catch {
    return left === right;
  }
}

export function isConfirmedProgrammeUrl(url: string, identity?: ConfirmedProgrammeIdentity | null) {
  return Boolean(identity?.programmeUrl && sameUrl(url, identity.programmeUrl));
}

function mentionsFingerprint(page: AdmissionPage, identity?: ConfirmedProgrammeIdentity | null) {
  if (!identity) return false;
  const phrases = [...identity.officialTitles, ...identity.aliases, identity.trackOrCurriculum ?? ""]
    .map((item) => item.toLowerCase().trim())
    .filter((item) => item.length > 3);
  const blob = blobOf(page);
  return phrases.some((phrase) => blob.includes(phrase));
}

function mentionsTarget(page: AdmissionPage, subject: Pick<ResearchSubject, "name"> & { verifiedTitles?: readonly string[] | null }) {
  const parts = splitCatalogueTitle(subject.name);
  const phrases = [subject.name, parts.programmeName, parts.curriculumOrTrack ?? "", ...(subject.verifiedTitles ?? [])]
    .map((item) => item.toLowerCase().trim())
    .filter((item) => item.length > 3);
  const blob = blobOf(page);
  return phrases.some((phrase) => blob.includes(phrase));
}

function courseRecordPath(url: string) {
  return /\/courses\/course\/[a-z0-9]+-[a-z0-9-]+/i.test(url);
}

function programmeStructure(page: AdmissionPage) {
  const text = `${page.title}\n${page.text ?? ""}`;
  const title = page.title.trim();
  const signals = [
    title.length > 2 && !/^(courses|course catalogue|programmes|programs|offerta formativa)$/i.test(title),
    /\bmaster(?:'s|s)?\b|\bbachelor(?:'s|s)?\b|\blaurea magistrale\b|\blaurea triennale\b|\bsingle-cycle\b|\bciclo unico\b/i.test(text),
    /\b(?:LM|L)-\d{1,3}\b/.test(text),
    /\bdepartment\b|\bdipartimento\b/i.test(text),
    /\bcurricul|\btrack\b|\bpercorso\b/i.test(text),
  ].filter(Boolean).length;
  return signals >= 3;
}

function courseShaped(page: AdmissionPage) {
  const heading = `${page.url} ${page.title}`.toLowerCase();
  if (/laurea|corso-di-laurea|degree-programme|\/corsi\/|\bbachelor\b|\bmaster\b/.test(heading) || /\blaurea\b/.test(page.title.toLowerCase())) return true;
  return courseRecordPath(page.url) && programmeStructure(page);
}

function nationalIdentity(page: AdmissionPage) {
  let host = "";
  try {
    host = new URL(page.url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    host = "";
  }
  if (host === "universitaly.it" || host.endsWith(".universitaly.it") || host.endsWith("mur.gov.it") || host.endsWith("governo.it") || host.endsWith("istruzione.it")) return true;
  const title = page.title.toLowerCase();
  const titleIsNational = /\buniversitaly\b|\bministero dell|\bministry of university\b|\bnational admission portal\b/.test(title);
  return titleIsNational && !courseShaped(page);
}

const HUB_HEADING = /\bammission[ei]\s+(?:ai\s+)?corsi\b|\badmissions?\s+(?:to\s+)?(?:(?:degree|study)\s+)?(?:programmes|programs|courses)\b|\bbandi\s+(?:di\s+)?ammissione\b|\bavvisi\s+(?:di\s+)?ammissione\b|\badmission\s+(?:calls|notices)\b|\bcalls\s+for\s+admission\b|\bcorsi\s+ad\s+accesso\s+(?:programmato|limitato)\b|\baccesso\s+programmato\b|\brestricted[- ]access\s+(?:programmes|programs|courses)\b/i;
const HUB_PATH = /ammission|admission|bandi|accesso-programmato|numero-programmato/i;

function childLinkCount(page: AdmissionPage & { links?: ReadonlyArray<{ href: string }> }) {
  if (!page.links?.length) return 0;
  let base: URL;
  try {
    base = new URL(page.url);
  } catch {
    return 0;
  }
  const prefix = `${base.pathname.replace(/\/$/, "")}/`;
  const children = new Set<string>();
  for (const link of page.links) {
    try {
      const url = new URL(link.href);
      if (url.hostname === base.hostname && url.pathname.startsWith(prefix) && url.pathname.length > prefix.length) children.add(url.pathname.replace(/\/$/, ""));
    } catch {
      continue;
    }
  }
  return children.size;
}

/** A multi-programme admission index. It is navigation, never identity or programme-level evidence. */
export function isAdmissionHub(
  page: AdmissionPage & { links?: ReadonlyArray<{ href: string }> },
  subject: Pick<ResearchSubject, "name"> & { verifiedTitles?: readonly string[] | null },
  identity?: ConfirmedProgrammeIdentity | null,
) {
  if (isConfirmedProgrammeUrl(page.url, identity)) return false;
  const titleOnly = { url: "", title: page.title, text: "" };
  if (mentionsFingerprint(titleOnly, identity) || mentionsTarget(titleOnly, subject)) return false;
  if (HUB_HEADING.test(page.title)) return true;
  return HUB_PATH.test(`${page.url} ${page.title}`) && childLinkCount(page) >= 4;
}

export function admissionSourceScope(page: AdmissionPage, subject: Pick<ResearchSubject, "name"> & { verifiedTitles?: readonly string[] | null }, identity?: ConfirmedProgrammeIdentity | null): AdmissionSourceScope {
  const blob = blobOf(page);
  if (isConfirmedProgrammeUrl(page.url, identity)) return "programme_specific";
  if (nationalIdentity(page)) return "national";
  if (isAdmissionHub(page, subject, identity)) return "university_wide";
  if (mentionsFingerprint(page, identity) || mentionsTarget(page, subject)) return "programme_specific";
  if (courseShaped(page)) return "unrelated_programme";
  if (/dipartimento|department/.test(blob)) return "department_specific";
  if (/ammission|accesso|bando|candidatur|international|extra-?\s*ue|non-eu|studenti internazionali/.test(blob)) return "university_wide";
  return "unknown";
}

const SECTION_HEADING = /corsi di laurea e di laurea magistrale a ciclo unico|bachelor and single-cycle|lauree magistrali|master'?s degree programmes|second-cycle degree programmes|lauree triennali|first-cycle degree programmes|(?<![(\w])laurea magistrale a ciclo unico|(?<![(\w])single-cycle programmes/gi;

function sectionLevels(heading: string): CatalogLevel[] | null {
  const value = heading.toLowerCase();
  if (/ciclo unico|single-cycle/.test(value)) return /bachelor|triennal|\blaurea e\b/.test(value) ? ["bachelor", "single-cycle"] : ["single-cycle"];
  if (/triennal|bachelor|first-cycle/.test(value)) return ["bachelor"];
  if (/lauree magistrali|master'?s degree|second-cycle/.test(value)) return ["master"];
  return null;
}

export function admissionSections(text: string) {
  const marks = [...text.matchAll(SECTION_HEADING)].flatMap((match) => {
    if (match.index == null) return [];
    const levels = sectionLevels(match[0]);
    return levels ? [{ index: match.index, levels }] : [];
  });
  if (!marks.length) return [{ levels: null as CatalogLevel[] | null, text }];
  const sections: Array<{ levels: CatalogLevel[] | null; text: string }> = [];
  if (marks[0].index > 0) sections.push({ levels: null, text: text.slice(0, marks[0].index) });
  marks.forEach((mark, index) => {
    sections.push({ levels: mark.levels, text: text.slice(mark.index, marks[index + 1]?.index ?? text.length) });
  });
  return sections;
}

export function scopedDatedEvents(text: string, scope: AdmissionSourceScope, targetLevel: string | null, page?: DatePageContext) {
  if (scope === "programme_specific" || scope === "unknown" || scope === "unrelated_programme") return datedEvents(text, page);
  const expected = targetLevel ? catalogLevel(targetLevel) : null;
  const sections = admissionSections(text);
  if (!expected || (sections.length === 1 && sections[0].levels == null)) return datedEvents(text, page);
  const found: DatedEvent[] = [];
  for (const section of sections) {
    if (section.levels && !section.levels.includes(expected)) continue;
    for (const event of datedEvents(section.text, page)) {
      if (found.some((item) => item.date === event.date && item.dateType === event.dateType && item.applicantCategory === event.applicantCategory)) continue;
      found.push(event);
    }
  }
  return found;
}

export function acceptedAdmissionEvents(pages: AdmissionPage[], subject: Pick<ResearchSubject, "name">, identity?: ConfirmedProgrammeIdentity | null) {
  const accepted: DatedEvent[] = [];
  for (const page of pages) {
    const scope = admissionSourceScope(page, subject, identity);
    if (scope === "unrelated_programme" || scope === "unknown" || isAdmissionHub(page, subject, identity)) continue;
    for (const event of scopedDatedEvents(page.text ?? "", scope, identity?.degreeLevel ?? null, page)) {
      if (event.historical || event.dateType === "legal_reference_date") continue;
      accepted.push(event);
    }
  }
  return accepted;
}

export function hasGeneralAdmissionDeadline(events: DatedEvent[]) {
  return events.some((event) => isApplyByDate(event.dateType) && event.applicantCategory === "all_applicants");
}

export function hasInternationalDeadline(events: DatedEvent[]) {
  return events.some((event) => INTERNATIONAL_DEADLINE.has(event.dateType));
}

export function hasUniversitalyDeadline(events: DatedEvent[]) {
  return events.some((event) => event.dateType === "universitaly_deadline" || event.dateType === "pre_enrolment_deadline");
}

export function admissionCandidateRank(page: AdmissionPage, subject: Pick<ResearchSubject, "name">, identity?: ConfirmedProgrammeIdentity | null) {
  const scope = admissionSourceScope(page, subject, identity);
  const blob = `${page.url} ${page.title}`.toLowerCase();
  if (scope === "unrelated_programme") return 5;
  if (scope === "programme_specific" && /ammission|bando|accesso|candidatur/.test(blob)) return 1;
  if (/extra-?\s*ue|non-eu|studenti-internazionali|international|visa|titolo-estero/.test(blob)) return 2;
  if (scope === "department_specific") return 3;
  if (scope === "university_wide" || scope === "national" || scope === "programme_specific") return 4;
  return 4;
}
