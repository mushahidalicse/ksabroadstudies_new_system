import type { ApplicantCategory, DateType } from "@/lib/research/research-schema";

const MONTHS: Record<string, string> = {
  gennaio: "01", febbraio: "02", marzo: "03", aprile: "04", maggio: "05", giugno: "06",
  luglio: "07", agosto: "08", settembre: "09", ottobre: "10", novembre: "11", dicembre: "12",
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

export type ProgrammeTeachingLanguage = "english" | "italian" | "mixed" | "other" | "unknown";

export type CurriculumTeachingLanguage = {
  curriculum: string;
  language: ProgrammeTeachingLanguage;
  evidenceScope: "curriculum";
};

const MIXED_PROGRAMME = [
  /lingua\s*(?:di\s+erogazione)?\s*:?\s*italiano\s+e\s+inglese/i,
  /erogato\s+in\s+italiano\s+e\s+(?:in\s+)?inglese/i,
  /taught\s+in\s+italian\s+and\s+english/i,
  /italian\s+and\s+english/i,
];

const ENGLISH_PROGRAMME = [
  /lingua\s+di\s+erogazione\s*:?\s*inglese\b/i,
  /lingua\s*:\s*inglese\b/i,
  /corso\s+erogato\s+in\s+lingua\s+inglese/i,
  /language\s+of\s+instruction\s*:\s*english/i,
  /language\s*:\s*english\b/i,
];

const ITALIAN_PROGRAMME = [
  /lingua\s+di\s+erogazione\s*:?\s*italiano\b/i,
  /lingua\s*:\s*italiano\b(?!\s+e\s+inglese)/i,
  /corso\s+erogato\s+in\s+lingua\s+italiana/i,
  /language\s+of\s+instruction\s*:\s*italian/i,
  /language\s*:\s*italian\b/i,
];

function programmeScopeText(text: string) {
  return text
    .replace(/curriculum\s+["“][^"”]+["”][^.]{0,120}/gi, " ")
    .replace(/(?:programmes?|courses?)\s+taught\s+in\s+(?:italian|english)[\s\S]{0,420}/gi, " ")
    .replace(/corsi\s+in\s+lingua\s+(?:italiana|inglese)[\s\S]{0,420}/gi, " ");
}

export function detectProgrammeTeachingLanguage(text: string): ProgrammeTeachingLanguage | null {
  if (MIXED_PROGRAMME.some((pattern) => pattern.test(text))) return "mixed";
  const scoped = programmeScopeText(text);
  if (ENGLISH_PROGRAMME.some((pattern) => pattern.test(scoped))) return "english";
  if (ITALIAN_PROGRAMME.some((pattern) => pattern.test(scoped))) return "italian";
  return null;
}

const HEADING_MIXED = /\bin\s+italiano\s+e\s+(?:in\s+)?inglese\b|\b(?:taught\s+)?in\s+italian\s+and\s+english\b|\bin\s+lingua\s+italiana\s+e\s+inglese\b/i;
const HEADING_ENGLISH = /\bin\s+english(?:\s+language)?\b|\benglish[- ]taught\b|\btaught\s+in\s+english\b|\b(?:erogato\s+)?in\s+lingua\s+inglese\b/i;
const HEADING_ITALIAN = /\bin\s+lingua\s+italiana\b|\btaught\s+in\s+italian\b|\bitalian[- ]taught\b/i;

function headingKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Language stated next to the programme's own name in a title or heading. Module and navigation text is never read. */
export function headingTeachingLanguage(headings: string[], labels: string[]): ProgrammeTeachingLanguage | null {
  const names = [...new Set(labels.map(headingKey).filter((item) => item.length > 3))];
  if (!names.length) return null;
  for (const heading of headings) {
    const key = headingKey(heading);
    for (const name of names) {
      let index = key.indexOf(name);
      while (index >= 0) {
        const window = key.slice(Math.max(0, index - 40), index + name.length + 60);
        if (HEADING_MIXED.test(window)) return "mixed";
        if (HEADING_ENGLISH.test(window)) return "english";
        if (HEADING_ITALIAN.test(window)) return "italian";
        index = key.indexOf(name, index + name.length);
      }
    }
  }
  return null;
}

export function englishTaughtFromProgramme(language: ProgrammeTeachingLanguage | null): true | false | null {
  if (language === "english") return true;
  if (language === "italian") return false;
  return null;
}

export function detectCurriculumTeachingLanguages(text: string): CurriculumTeachingLanguage[] {
  const found: CurriculumTeachingLanguage[] = [];
  const add = (curriculum: string, language: ProgrammeTeachingLanguage) => {
    const name = curriculum.replace(/\s+/g, " ").trim();
    if (name.length < 3 || found.some((item) => item.curriculum.toLowerCase() === name.toLowerCase())) return;
    found.push({ curriculum: name.slice(0, 120), language, evidenceScope: "curriculum" });
  };
  const quotedNames = (cluster: string) => [...cluster.matchAll(/["“]([^"”]{3,120})["”]/g)].map((match) => match[1]);
  const sections: Array<{ language: ProgrammeTeachingLanguage; pattern: RegExp }> = [
    { language: "italian", pattern: /(?:corsi in lingua italiana|programmes?\s+taught\s+in\s+italian|courses?\s+taught\s+in\s+italian)/gi },
    { language: "english", pattern: /(?:corsi in lingua inglese|programmes?\s+taught\s+in\s+english|courses?\s+taught\s+in\s+english)/gi },
  ];
  for (const section of sections) {
    for (const match of text.matchAll(section.pattern)) {
      if (match.index == null) continue;
      const rest = text.slice(match.index + match[0].length, match.index + match[0].length + 420);
      const stop = rest.search(/programmes?\s+taught\s+in|courses?\s+taught\s+in|corsi\s+in\s+lingua/i);
      const chunk = stop >= 0 ? rest.slice(0, stop) : rest;
      for (const cluster of chunk.matchAll(/curricul(?:um|a)\s+((?:["“][^"”]{3,120}["”]\s*(?:[,;]|e|ed|and)?\s*){0,5}["“][^"”]{3,120}["”])/gi)) {
        for (const name of quotedNames(cluster[1])) add(name, section.language);
      }
      for (const line of chunk.split(/\n+/)) {
        const bullet = /^(?:[-•*]|\d+\.)\s+(.{3,120})$/.exec(line.trim());
        if (!bullet || /curricul|corsi in lingua|taught in/i.test(bullet[1])) continue;
        add(bullet[1], section.language);
      }
    }
  }
  for (const match of text.matchAll(/curriculum\s+["“]([^"”]{3,120})["”][\s\S]{0,200}?taught\s+in\s+(italian|english|italiano|inglese)/gi)) {
    add(match[1], /ingl|english/i.test(match[2]) ? "english" : "italian");
  }
  for (const match of text.matchAll(/["“]([^"”]{3,80})["”]\s*\((?:insegnamento|taught)\s+in\s+(inglese|italiano|english|italian)\)/gi)) {
    add(match[1], /ingl|english/i.test(match[2]) ? "english" : "italian");
  }
  return found.slice(0, 8);
}

export function teachingLanguage(text: string): true | false | null {
  return englishTaughtFromProgramme(detectProgrammeTeachingLanguage(text));
}

function isoDate(day: string, month: string, year: string) {
  const mm = MONTHS[month.toLowerCase()];
  if (!mm || Number(day) < 1 || Number(day) > 31) return null;
  return `${year}-${mm}-${day.padStart(2, "0")}`;
}

const APPLICATION_TYPES = new Set<DateType>([
  "application_open",
  "application_deadline",
  "admission_round_open",
  "admission_round_deadline",
  "non_eu_application_open",
  "non_eu_application_deadline",
  "non_eu_abroad_deadline",
  "non_eu_deadline",
  "visa_applicant_deadline",
  "foreign_qualification_deadline",
  "eu_application_deadline",
]);

const ENROLMENT_TYPES = new Set<DateType>([
  "enrolment_open",
  "enrolment_deadline",
  "immatriculation_open",
  "immatriculation_deadline",
]);

const TEST_REGISTRATION_TYPES = new Set<DateType>([
  "test_registration_open",
  "test_registration_deadline",
]);

export function isApplyByDate(dateType: DateType) {
  return APPLICATION_TYPES.has(dateType) && !dateType.endsWith("_open");
}

export function applicationClosesMessage(dateType: DateType, input: { name: string; days: number }) {
  if (!isApplyByDate(dateType)) return null;
  const when = input.days === 0 ? "closes today" : input.days === 1 ? "closes tomorrow" : `closes in ${input.days} days`;
  return `The application deadline for ${input.name} ${when}.`;
}

function lastCue(hay: string, pattern: RegExp) {
  pattern.lastIndex = 0;
  let index = -1;
  for (const match of hay.matchAll(pattern)) {
    if (match.index != null) index = match.index;
  }
  pattern.lastIndex = 0;
  return index;
}

export function historicalCycle(before: string) {
  if (/\b202[6-9]\b/.test(before)) return false;
  const match = before.match(/\b(20\d{2})\s*\/\s*(?:20)?(\d{2})\b/);
  if (!match) return false;
  return 2000 + Number(match[2].slice(-2)) < 2026;
}

export function legalReferenceDate(before: string) {
  const tail = before.slice(-56).toLowerCase().trim();
  return /(?:\bd\.?\s*m\.|\bdm|\bd\.?\s*lgs\.|\bd\.?\s*p\.?\s*r\.|decreto\s+ministeriale|\bdecreto\b|\blegge\b|\bregolamento\b|\bdirettiva\b)\s*$/i.test(tail);
}

export function deadlineLanguage(before: string) {
  return /deadline|apply by|applications close|application period|submit by|submit the application|must submit|deadline for submitting|applications? must be submitted|\bscadenza\b|domanda di ammissione|domand\w* di partecipazione|domanda entro|domande entro|presentare la domanda|presentare le domande|presentare domanda|candidature entro|termine (?:di |per )?(?:la |le )?presentazione|termine per|\bentro\b/i.test(before);
}

export type DatePageContext = { url?: string; title?: string };

export type ClassifiedDate = { dateType: DateType; applicantCategory: ApplicantCategory; label: string; categoryExplicit: boolean };

const OPENING_CUE = /\bopens\b|\bopening\b|applications open|enrolment opens|enrollment opens|\bapertura\b|\bapre\b|\baprono\b|\binizio\b|\biniziano\b|\binizia\b|a partire dal/gi;
const CLOSING_CUE = /\bcloses\b|\bdeadline\b|\buntil\b|\bby\b|\bentro\b|\bscadenza\b|\bchiude\b|\bchiudono\b|\btermine\b|fino al/gi;
const APPLY_CUE = /domanda di ammissione|scadenza domanda|application deadline|application window|applications close|application closes|applications open|domanda entro|domande entro|candidatura|deadline for submitting (?:an )?applications?|applications? submission deadline|deadline to submit (?:an |your )?applications?|applications? must be submitted by|application must be submitted by|submit (?:your )?applications? by|termine(?:\s+(?:di|per))?(?:\s+(?:la|le))?\s+presentazione(?:\s+(?:della|delle))?\s+domand\w*|scadenza(?:\s+(?:di|per))?(?:\s+(?:la|le))?\s+presentazione(?:\s+(?:della|delle))?\s+domand\w*|presentare\s+(?:la\s+domanda|le\s+domande)\s+entro|domande?\s+di\s+partecipazione|domande possono essere presentate/gi;
const ENROL_CUE = /immatricolazion|(?<!pre-?)iscrizion|enrolment|enrollment/gi;
const TEST_REG_CUE = /registration (?:to|for) the (?:admission )?test|test registration|iscrizione alla prova|iscrizione al test/gi;
const UNIVERSITALY_CUE = /universitaly|pre-iscrizione|preiscrizione/gi;
const PRE_ENROL_CUE = /pre-enrol|pre-immatricol/gi;

function dateDirection(before: string) {
  const hay = before.toLowerCase();
  const openAt = lastCue(hay, OPENING_CUE);
  const closeAt = lastCue(hay, CLOSING_CUE);
  const tail = hay.slice(-24);
  const weakOpen = /\bdal\b|\bfrom\b/.test(tail) ? hay.length - 4 : -1;
  const ranked = [
    openAt >= 0 ? { dir: "open" as const, index: openAt } : null,
    closeAt >= 0 ? { dir: "close" as const, index: closeAt } : null,
    weakOpen >= 0 && (closeAt < 0 || weakOpen > closeAt) ? { dir: "open" as const, index: weakOpen } : null,
  ].filter((item): item is { dir: "open" | "close"; index: number } => item != null);
  ranked.sort((left, right) => right.index - left.index);
  return ranked[0] ?? null;
}

function explicitAllApplicants(hay: string) {
  return /\ball applicants\b|\ball students\b|\bevery applicant\b|\btutti i candidati\b|\btutti gli studenti\b/.test(hay);
}

function explicitApplicant(hay: string): { category: ApplicantCategory; explicit: boolean } {
  const abroad = /extra-?\s*ue|\bnon-eu\b/.test(hay);
  const residing = /residenti all'estero|residing abroad|all'estero/.test(hay);
  if (abroad && residing) return { category: "non_eu_residing_abroad", explicit: true };
  if (/richiedenti visto|visa applicants?/.test(hay)) return { category: "visa_applicant", explicit: true };
  if (/titolo di studio estero|titolo estero|foreign qualification|foreign degree/.test(hay)) return { category: "foreign_qualification", explicit: true };
  if (abroad) return { category: "non_eu", explicit: true };
  if (/(?<!non-)(?<!extra-)eu applicants|(?<!non-)eu students|studenti ue|candidati ue/.test(hay)) return { category: "eu", explicit: true };
  if (/studenti internazionali|candidati internazionali|international applicants|international students/.test(hay)) return { category: "international", explicit: true };
  if (explicitAllApplicants(hay)) return { category: "all_applicants", explicit: true };
  return { category: "all_applicants", explicit: false };
}

function headingCategory(line: string): ApplicantCategory | null {
  const value = line.trim().toLowerCase().replace(/[:.\-–]+$/g, "").trim();
  if (!value || value.length > 90) return null;
  if (/^(?:non-eu students residing abroad|studenti extra-?\s*ue residenti all'estero|extra-?\s*ue residenti all'estero)$/.test(value)) return "non_eu_residing_abroad";
  if (/^(?:visa applicants?|richiedenti visto)$/.test(value)) return "visa_applicant";
  if (/^(?:foreign qualifications?|titolo di studio estero|titolo estero)$/.test(value)) return "foreign_qualification";
  if (/^(?:non-eu(?: students| applicants)?|studenti extra-?\s*ue|extra-?\s*ue)$/.test(value)) return "non_eu";
  if (/^(?:eu applicants only|solo candidati ue|solo studenti ue|studenti ue|eu applicants|eu students)$/.test(value)) return "eu";
  if (/^(?:all applicants|all students|tutti i candidati|tutti gli studenti)$/.test(value)) return "all_applicants";
  if (/^(?:ammissione(?: studentesse e)? studenti internazionali|international admissions|international students|international applicants|studenti internazionali)$/.test(value)) return "international";
  return null;
}

function sectionApplicantCategory(text: string, index: number): ApplicantCategory | null {
  const lines = text.slice(0, index).split(/\n/);
  for (let line = lines.length - 1; line >= 0; line -= 1) {
    const category = headingCategory(lines[line]);
    if (category) return category;
  }
  return null;
}

export function internationalAdmissionsPage(page?: DatePageContext) {
  const blob = `${page?.url ?? ""} ${page?.title ?? ""}`.toLowerCase();
  return /ammissione[-\s/]studenti[-\s]internazionali|international[-\s]admissions|ammissione studentesse e studenti internazionali/.test(blob);
}

function applicationEvent(category: ApplicantCategory, open: boolean, explicit: boolean): ClassifiedDate {
  if (open) {
    const dateType = category === "non_eu" || category === "non_eu_residing_abroad" ? "non_eu_application_open" : "application_open";
    return { dateType, applicantCategory: category, label: "Application opening", categoryExplicit: explicit };
  }
  if (category === "foreign_qualification") return { dateType: "foreign_qualification_deadline", applicantCategory: category, label: "Foreign qualification application", categoryExplicit: explicit };
  if (category === "visa_applicant") return { dateType: "visa_applicant_deadline", applicantCategory: category, label: "Visa applicant deadline", categoryExplicit: explicit };
  if (category === "non_eu" || category === "non_eu_residing_abroad") return { dateType: "non_eu_application_deadline", applicantCategory: category, label: category === "non_eu_residing_abroad" ? "Non-EU residing abroad application" : "Non-EU application deadline", categoryExplicit: explicit };
  if (category === "eu") return { dateType: "eu_application_deadline", applicantCategory: category, label: "EU application deadline", categoryExplicit: explicit };
  if (category === "international") return { dateType: "application_deadline", applicantCategory: category, label: "International application deadline", categoryExplicit: explicit };
  return { dateType: "application_deadline", applicantCategory: category, label: "Application deadline", categoryExplicit: explicit };
}

function staleCalendarYear(before: string, iso: string) {
  const year = Number(iso.slice(0, 4));
  if (year >= 2026) return false;
  return !/\b202[6-9]\b/.test(before);
}

export function classifyDateContext(before: string): ClassifiedDate | null {
  if (legalReferenceDate(before)) {
    return { dateType: "legal_reference_date", applicantCategory: "unknown", label: "Legal reference", categoryExplicit: true };
  }
  const hay = before.toLowerCase();
  const deadline = deadlineLanguage(hay);
  const direction = dateDirection(hay);
  const open = direction?.dir === "open";
  const applicant = explicitApplicant(hay);
  const cues = [
    { kind: "test", index: lastCue(hay, TEST_REG_CUE) },
    { kind: "universitaly", index: lastCue(hay, UNIVERSITALY_CUE) },
    { kind: "preenrol", index: lastCue(hay, PRE_ENROL_CUE) },
    { kind: "enrol", index: lastCue(hay, ENROL_CUE) },
    { kind: "apply", index: lastCue(hay, APPLY_CUE) },
  ].filter((cue) => cue.index >= 0);
  const process = cues.reduce<{ kind: string; index: number } | null>((best, cue) => (!best || cue.index > best.index ? cue : best), null);
  const universitaly = cues.find((cue) => cue.kind === "universitaly");
  const enrol = cues.find((cue) => cue.kind === "enrol");
  const universitalyLinked = Boolean(universitaly && (!enrol || Math.abs(universitaly.index - enrol.index) <= 48));
  if (process?.kind === "test") {
    return { dateType: open ? "test_registration_open" : "test_registration_deadline", applicantCategory: "all_applicants", label: open ? "Test registration opening" : "Test registration deadline", categoryExplicit: true };
  }
  if (process?.kind === "universitaly" || (process?.kind === "enrol" && universitalyLinked)) {
    return { dateType: open ? "universitaly_open" : "universitaly_deadline", applicantCategory: "visa_applicant", label: open ? "Universitaly opening" : "Universitaly pre-enrolment", categoryExplicit: true };
  }
  if (process?.kind === "preenrol") {
    return { dateType: open ? "pre_enrolment_open" : "pre_enrolment_deadline", applicantCategory: "unknown", label: open ? "Pre-enrolment opening" : "Pre-enrolment deadline", categoryExplicit: true };
  }
  if (process?.kind === "enrol") {
    return { dateType: open ? "enrolment_open" : "enrolment_deadline", applicantCategory: applicant.category, label: open ? "Enrolment opening" : "Enrolment deadline", categoryExplicit: applicant.explicit };
  }
  if (process?.kind === "apply") return applicationEvent(applicant.category, open, applicant.explicit);
  if (!applicant.explicit) return null;
  if (open) return applicationEvent(applicant.category, true, true);
  if (deadline || direction?.dir === "close") return applicationEvent(applicant.category, false, true);
  return null;
}

export function reclassifyDate(claimed: DateType, evidenceText: string): DateType {
  const wording = classifyDateContext(evidenceText);
  if (!wording) return claimed;
  if (wording.dateType === "legal_reference_date") return "legal_reference_date";
  if (TEST_REGISTRATION_TYPES.has(wording.dateType) && (APPLICATION_TYPES.has(claimed) || ENROLMENT_TYPES.has(claimed) || claimed === "other")) return wording.dateType;
  if (ENROLMENT_TYPES.has(wording.dateType) && (APPLICATION_TYPES.has(claimed) || claimed === "other")) return wording.dateType;
  if (APPLICATION_TYPES.has(wording.dateType) && ENROLMENT_TYPES.has(claimed)) return wording.dateType;
  const sameEnrolment = ENROLMENT_TYPES.has(wording.dateType) && ENROLMENT_TYPES.has(claimed);
  const sameApplication = APPLICATION_TYPES.has(wording.dateType) && APPLICATION_TYPES.has(claimed);
  if ((sameEnrolment || sameApplication) && wording.dateType !== claimed) return wording.dateType;
  return claimed;
}

export type DatedEvent = { dateType: DateType; date: string; label: string; applicantCategory: ApplicantCategory; round: string | null; historical: boolean };

const MONTH_FIRST = /\b(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/gi;

function dateHits(text: string) {
  const hits: Array<{ index: number; end: number; date: string }> = [];
  for (const match of text.matchAll(/(\d{1,2})\s+([a-zà]+)\s+(\d{4})/gi)) {
    const date = isoDate(match[1], match[2], match[3]);
    if (!date || match.index == null) continue;
    hits.push({ index: match.index, end: match.index + match[0].length, date });
  }
  for (const match of text.matchAll(MONTH_FIRST)) {
    const date = isoDate(match[2], match[1], match[3]);
    if (!date || match.index == null) continue;
    const end = match.index + match[0].length;
    if (hits.some((hit) => match.index! < hit.end && end > hit.index)) continue;
    hits.push({ index: match.index, end, date });
  }
  hits.sort((left, right) => left.index - right.index);
  return hits;
}

export function datedEvents(text: string, page?: DatePageContext): DatedEvent[] {
  const found: DatedEvent[] = [];
  const pageFallback = internationalAdmissionsPage(page) ? "international" : null;
  for (const match of dateHits(text)) {
    const date = match.date;
    const before = text.slice(Math.max(0, match.index - 140), match.index);
    const kind = classifyDateContext(before);
    if (!kind) continue;
    const tail = text.slice(match.end, match.end + 90).split(/[.\n]/)[0] ?? "";
    const localApplicant = explicitApplicant(`${before} ${tail}`);
    let applicantCategory = localApplicant.explicit ? localApplicant.category : kind.applicantCategory;
    let dateType = kind.dateType;
    let label = kind.label;
    const explicit = kind.categoryExplicit || localApplicant.explicit;
    if (!explicit) {
      const inherited = sectionApplicantCategory(text, match.index) ?? pageFallback;
      if (inherited) applicantCategory = inherited;
    }
    if ((dateType === "application_deadline" || dateType === "application_open") && applicantCategory !== "all_applicants") {
      const scoped = applicationEvent(applicantCategory, dateType.endsWith("_open"), true);
      dateType = scoped.dateType;
      label = scoped.label;
    }
    const roundMatches = [...before.matchAll(/\b(?:round|finestra)\s+(\d+)/gi)];
    const round = roundMatches.at(-1)?.[1] ?? null;
    if (found.some((item) => item.dateType === dateType && item.date === date && item.applicantCategory === applicantCategory && item.round === round)) continue;
    found.push({ dateType, date, label, applicantCategory, round, historical: historicalCycle(before) || staleCalendarYear(before, date) });
  }
  return found;
}

export function enrolmentDates(text: string) {
  return datedEvents(text).filter((item) => ENROLMENT_TYPES.has(item.dateType));
}

export function ectsRequirement(text: string) {
  const match = text.match(/\d+\s*CFU\b[^.]{0,220}/i);
  if (!match) return null;
  return match[0].replace(/\s+/g, " ").trim().slice(0, 220);
}

export function unsupportedNote(note: string, evidenceFields: Set<string>) {
  const claims = [
    { pattern: /\bB2\b|\bCEFR\b/i, field: "cefr" },
    { pattern: /\bIELTS\b/i, field: "ieltsMin" },
    { pattern: /\bTOEFL\b/i, field: "toeflMin" },
    { pattern: /\bMOI\b|medium of instruction/i, field: "moi" },
    { pattern: /€|\bEUR\b|\beuro\b/i, field: "money" },
    { pattern: /\bCFU\b|\bECTS\b/i, field: "ects" },
  ];
  return claims.some((claim) => {
    if (!claim.pattern.test(note)) return false;
    if (claim.field === "money") return !evidenceFields.has("applicationFee") && !evidenceFields.has("tuition");
    return !evidenceFields.has(claim.field);
  });
}
