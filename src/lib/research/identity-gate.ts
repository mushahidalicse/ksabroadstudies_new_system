import { admissionSourceScope, isAdmissionHub, isConfirmedProgrammeUrl } from "@/lib/research/admission-gates";
import { degreeClassNearTarget, detectTargetDegreeLevel } from "@/lib/research/degree-level";
import {
  buildDiscoveryQueries,
  catalogLevel,
  detectDegreeLevel,
  isDiscoveryCandidate,
  normalizeTitle,
  officialEnglishTitle,
  splitCatalogueTitle,
  universityPresent,
  type CatalogLevel,
} from "@/lib/research/discovery";
import { officialDomains } from "@/lib/research/research-budget";
import type { ConfirmedProgrammeIdentity, IdentityConflict, IdentityFieldProvenance } from "@/lib/research/research-schema";
import { hostOnRegisteredDomain, type UniversityMatch } from "@/lib/research/university-identity";

type IdentityTarget = {
  name: string;
  universityName: string;
  level: string;
  universityWebsite?: string | null;
  admissionPortal?: string | null;
  verifiedTitles?: readonly string[] | null;
  degreeClass?: string | null;
  /** Catalogue Italian title. Only used to tell a language variant apart, never accepted as a name. */
  italianTitle?: string | null;
};

const LANGUAGE_VARIANT = /\bin lingua inglese\b|\bin english\b|\benglish[- ]taught\b/i;
const ENGLISH_DELIVERY = /\bin lingua inglese\b|\bin english\b|\benglish[- ]taught\b|\btaught (?:entirely |fully )?in english\b|\blingua(?: di erogazione| del corso)?\s*:?\s*inglese\b|\blanguage(?: of instruction| of teaching)?\s*:?\s*english\b/i;
const ITALIAN_DELIVERY = /\bin lingua italiana\b|\btaught in italian\b|\blingua(?: di erogazione| del corso)?\s*:?\s*italiano\b(?!\s+e\s+inglese)|\blanguage(?: of instruction| of teaching)?\s*:?\s*italian\b|\bitalian[- ]taught\b/i;

function englishDeliveryNearTarget(sourceText: string, heading: string, names: string[]) {
  if (ENGLISH_DELIVERY.test(heading)) return true;
  const lower = sourceText.toLowerCase();
  for (const name of names) {
    const needle = name.toLowerCase();
    if (needle.length < 4) continue;
    let index = lower.indexOf(needle);
    while (index >= 0) {
      if (ENGLISH_DELIVERY.test(sourceText.slice(Math.max(0, index - 160), index + needle.length + 160))) return true;
      index = lower.indexOf(needle, index + needle.length);
    }
  }
  return false;
}

export type { CatalogLevel };
export { catalogLevel, detectDegreeLevel } from "@/lib/research/discovery";

export type IdentityConfidence = "confirmed" | "ambiguous" | "not_found";

export type CatalogueAnomaly = {
  reason: string;
  catalogueName: string;
  catalogueLevel: string;
  officialName: string | null;
  officialLevel: string | null;
  urls: string[];
};

function aliasesFrom(text: string, catalogueName: string) {
  const aliases = new Set<string>();
  const english = officialEnglishTitle(text);
  const parts = splitCatalogueTitle(catalogueName);
  if (english) aliases.add(english);
  if (normalizeTitle(text).includes(normalizeTitle(parts.programmeName))) aliases.add(parts.programmeName);
  return [...aliases];
}

export function sourceDecision(
  target: IdentityTarget,
  sourceText: string,
  pageUrl?: string,
  confirmedIdentity?: ConfirmedProgrammeIdentity | null,
) {
  const expected = detectDegreeLevel(target.level) || (target.level as CatalogLevel);
  const partsForLevel = splitCatalogueTitle(target.name);
  const heading = sourceText.split("\n")[0] ?? "";
  const attached = detectTargetDegreeLevel(sourceText, partsForLevel.programmeName);
  const pageLevel = detectTargetDegreeLevel(sourceText);
  const scope = admissionSourceScope({ url: pageUrl ?? "", title: heading, text: sourceText }, target, confirmedIdentity);
  const hub = isAdmissionHub({ url: pageUrl ?? "", title: heading, text: sourceText }, target, confirmedIdentity);
  const broadPage = scope === "university_wide" || scope === "national";
  const departmentWithoutTarget = scope === "department_specific" && attached == null;
  const lmOnlyMaster = attached === "master" && expected === "single-cycle" && /\bLM-\d{1,3}\b/i.test(sourceText) && !/laurea\s+magistrale(?!\s+a\s+ciclo)|\bmaster(?:'s)?\b/i.test(heading);
  const inheritTargetLevel = Boolean(
    confirmedIdentity
    && scope === "programme_specific"
    && catalogLevel(confirmedIdentity.degreeLevel) === expected
    && (attached == null || attached === expected || lmOnlyMaster)
  );
  const detected = broadPage || departmentWithoutTarget ? null : inheritTargetLevel ? expected : attached ?? pageLevel;
  const levelRejected = broadPage || departmentWithoutTarget ? false : Boolean(detected && expected && detected !== expected);
  const domain = officialDomains(target)[0] ?? "";
  let universityMatch: UniversityMatch | null = null;
  if (domain && pageUrl) universityMatch = hostOnRegisteredDomain(pageUrl, domain) ? "confirmed_by_official_domain" : null;
  else if (universityPresent(target.universityName, sourceText)) universityMatch = "confirmed_by_catalogue_text";
  const universityMatched = universityMatch != null;
  const parts = splitCatalogueTitle(target.name);
  const acceptedNames = [...new Set([parts.programmeName, ...(target.verifiedTitles ?? [])].map((item) => item.trim()).filter((item) => item.length > 3))];
  const haystack = normalizeTitle(sourceText);
  const basePresent = acceptedNames.some((name) => haystack.includes(normalizeTitle(name)));
  const english = officialEnglishTitle(sourceText);
  const translationConfirmed = Boolean(english && acceptedNames.some((name) => normalizeTitle(english).includes(normalizeTitle(name))));
  const trackTokens = parts.curriculumOrTrack
    ? normalizeTitle(parts.curriculumOrTrack).split(" ").filter((token) => token.length > 3)
    : [];
  const trackPresent = trackTokens.length > 0 && trackTokens.every((token) => normalizeTitle(sourceText).includes(token));
  const classCode = acceptedNames.map((name) => degreeClassNearTarget(sourceText, name)).find(Boolean) ?? degreeClassNearTarget(sourceText);
  const classSupportsLevel = Boolean(classCode && detected === expected && (
    (expected === "master" && classCode.startsWith("LM-"))
    || (expected === "bachelor" && classCode.startsWith("L-") && !classCode.startsWith("LM-"))
    || expected === "single-cycle"
  ));
  const titleHasTarget = acceptedNames.some((name) => normalizeTitle(heading).includes(normalizeTitle(name)));
  const collectionHeading = !titleHasTarget && /\bcorsi\b|\bcourses?\b|\bprogrammes?\b|\bprograms?\b/i.test(heading);
  const expectedClass = (target.degreeClass ?? "").toUpperCase();
  const classAgrees = !expectedClass || !classCode || classCode === expectedClass;
  const languageVariant = LANGUAGE_VARIANT.test(target.italianTitle ?? "");
  const languageVariantProven = !languageVariant || Boolean(confirmedIdentity)
    || englishDeliveryNearTarget(sourceText, heading, [...acceptedNames, target.italianTitle ?? ""]);
  const confirmed = Boolean(
    !collectionHeading
    && !levelRejected
    && detected === expected
    && universityMatched
    && classAgrees
    && languageVariantProven
    && (basePresent || translationConfirmed || (classSupportsLevel && trackPresent)),
  );
  return { expected, detected, pageDegreeLevel: detected, levelRejected, scope, hub, universityMatched, universityMatch, basePresent, translationConfirmed, trackPresent, classCode, languageVariantProven, confirmed };
}

/** A post-freeze admission page that merely lacks standalone identity markers is not a conflict. */
export function postConfirmationAdmissionConflict(
  target: IdentityTarget,
  source: { url: string; title: string; pageText?: string; pageTitle?: string },
  confirmedIdentity?: ConfirmedProgrammeIdentity | null,
) {
  const heading = source.pageTitle || source.title;
  const blob = `${heading}\n${source.pageText ?? ""}`;
  const decision = sourceDecision(target, blob, source.url, confirmedIdentity);
  if (decision.hub || decision.scope === "university_wide" || decision.scope === "national") return false;
  if (decision.levelRejected || decision.scope === "unrelated_programme") return true;
  const expectedClass = (target.degreeClass ?? confirmedIdentity?.degreeClass ?? "").toUpperCase();
  if (expectedClass && decision.classCode && decision.classCode !== expectedClass) return true;
  if (!LANGUAGE_VARIANT.test(target.italianTitle ?? "")) return false;
  const names = [target.name, target.italianTitle ?? "", ...(confirmedIdentity?.officialTitles ?? []), ...(confirmedIdentity?.aliases ?? [])];
  if (englishDeliveryNearTarget(blob, heading, names)) return false;
  return ITALIAN_DELIVERY.test(blob);
}

export function identityFromSources(
  target: IdentityTarget,
  sources: Array<{ url: string; title: string; pageText?: string }>,
): {
  confidence: IdentityConfidence;
  kept: number[];
  warnings: string[];
  catalogueReview: boolean;
  anomaly: CatalogueAnomaly | null;
  programmeName: string;
  curriculumOrTrack: string | null;
  degreeClass: string | null;
  aliases: string[];
  identityConflicts: IdentityConflict[];
} {
  const warnings: string[] = [];
  const kept: number[] = [];
  const parts = splitCatalogueTitle(target.name);
  const mismatched: Array<{ url: string; level: string | null; title: string }> = [];
  let classCode: string | null = null;
  let classSource = "";
  let trackConfirmed = false;
  const aliases = new Set<string>();
  const identityConflicts: IdentityConflict[] = [];
  sources.forEach((source, index) => {
    const blob = `${source.title}\n${source.pageText ?? ""}`;
    const decision = sourceDecision(target, blob, source.url);
    if (decision.hub || decision.scope === "university_wide" || decision.scope === "national") return;
    if (decision.levelRejected && isDiscoveryCandidate(target, source)) {
      mismatched.push({ url: source.url, level: decision.detected, title: source.title });
      warnings.push(`Identity rejected: catalogue level is ${decision.expected} and ${source.url} is a ${decision.detected} source.`);
      return;
    }
    if (!decision.confirmed) {
      if (!decision.hub && isDiscoveryCandidate(target, source)) warnings.push(`Identity not confirmed for ${source.url}. Official evidence does not yet tie this page to the catalogue programme.`);
      return;
    }
    kept.push(index);
    if (decision.trackPresent) trackConfirmed = true;
    for (const alias of aliasesFrom(blob, target.name)) aliases.add(alias);
    const title = source.title.trim();
    if (title && normalizeTitle(title) !== normalizeTitle(target.name) && normalizeTitle(title) !== normalizeTitle(parts.programmeName)) aliases.add(title);
    if (!decision.classCode) return;
    if (!classCode) {
      classCode = decision.classCode;
      classSource = source.url;
      return;
    }
    if (classCode !== decision.classCode) {
      identityConflicts.push({
        field: "degreeClass",
        confirmedValue: classCode,
        observedValue: decision.classCode,
        confirmedSource: classSource,
        conflictingSource: source.url,
      });
    }
  });
  const sameLevelUnresolved = sources.some((source) => {
    const decision = sourceDecision(target, `${source.title}\n${source.pageText ?? ""}`, source.url);
    if (decision.hub || decision.scope === "university_wide" || decision.scope === "national") return false;
    return isDiscoveryCandidate(target, source) && !decision.levelRejected && !decision.confirmed;
  });
  const catalogueReview = kept.length === 0 && mismatched.length > 0 && !sameLevelUnresolved;
  const anomaly = catalogueReview ? {
    reason: `Catalogue lists ${target.level} ${parts.programmeName}, but official sources found only a ${mismatched[0]?.level ?? "different"} programme.`,
    catalogueName: target.name,
    catalogueLevel: target.level,
    officialName: mismatched[0]?.title ?? null,
    officialLevel: mismatched[0]?.level ?? null,
    urls: mismatched.map((item) => item.url),
  } : null;
  if (catalogueReview) warnings.push(anomaly?.reason ?? "Catalogue review is required.");
  return {
    confidence: kept.length ? "confirmed" : catalogueReview ? "not_found" : sources.length ? "ambiguous" : "not_found",
    kept,
    warnings,
    catalogueReview,
    anomaly,
    programmeName: parts.programmeName,
    curriculumOrTrack: trackConfirmed ? parts.curriculumOrTrack : null,
    degreeClass: classCode,
    aliases: [...aliases],
    identityConflicts,
  };
}

function provenance(value: string | null, sourceUrl: string, confirmedAt: string): IdentityFieldProvenance | null {
  if (!value) return null;
  return { value, sourceUrl, sourceType: "official_programme_page", confirmedAt, confidence: "confirmed" };
}

export function freezeConfirmedIdentity(
  subject: { universityName: string; level: string },
  keptPages: Array<{ url: string; title: string }>,
  gate: { programmeName: string; degreeClass: string | null; aliases: string[]; curriculumOrTrack: string | null },
  domain: string,
  confirmedAt = new Date().toISOString(),
): ConfirmedProgrammeIdentity {
  const page = keptPages[0];
  const aliases = gate.aliases.slice(0, 8);
  const identity: ConfirmedProgrammeIdentity = {
    programmeUrl: page?.url ?? "",
    university: subject.universityName,
    degreeLevel: subject.level,
    degreeClass: gate.degreeClass,
    officialTitles: [page?.title ?? "", ...aliases].filter((item, index, all) => item && all.indexOf(item) === index).slice(0, 8),
    aliases,
    trackOrCurriculum: gate.curriculumOrTrack,
    universityDomain: domain,
    confirmedAt,
    supportingSources: keptPages.map((item) => item.url).slice(0, 4),
    provenance: {
      programmeName: provenance(gate.programmeName || page?.title || null, page?.url ?? "", confirmedAt),
      degreeLevel: provenance(subject.level, page?.url ?? "", confirmedAt),
      degreeClass: provenance(gate.degreeClass, page?.url ?? "", confirmedAt),
      trackOrCurriculum: provenance(gate.curriculumOrTrack, page?.url ?? "", confirmedAt),
      aliases: aliases.map((alias) => ({ value: alias, sourceUrl: page?.url ?? "", sourceType: "official_programme_page", confirmedAt, confidence: "confirmed" as const })),
    },
  };
  return Object.freeze({
    ...identity,
    officialTitles: Object.freeze([...identity.officialTitles]),
    aliases: Object.freeze([...identity.aliases]),
    supportingSources: Object.freeze([...(identity.supportingSources ?? [])]),
    provenance: Object.freeze({
      ...identity.provenance,
      aliases: Object.freeze([...(identity.provenance?.aliases ?? [])]),
    }),
  }) as ConfirmedProgrammeIdentity;
}

export function identityObservation(
  page: { url: string; title: string; text?: string },
  identity: ConfirmedProgrammeIdentity,
  subject: { name: string },
): IdentityConflict | null {
  if (isConfirmedProgrammeUrl(page.url, identity)) return null;
  if (admissionSourceScope(page, subject, identity) !== "programme_specific") return null;
  const blob = `${page.title}\n${page.text ?? ""}`;
  const labels = [subject.name, ...identity.officialTitles, ...identity.aliases];
  const observed = labels.map((label) => degreeClassNearTarget(blob, label)).find((code) => code) ?? null;
  if (!observed || !identity.degreeClass || observed === identity.degreeClass) return null;
  return {
    field: "degreeClass",
    confirmedValue: identity.degreeClass,
    observedValue: observed,
    confirmedSource: identity.provenance?.degreeClass?.sourceUrl || identity.programmeUrl,
    conflictingSource: page.url,
  };
}

function classNearConfirmedProgramme(blob: string, labels: string[]) {
  return labels.map((label) => degreeClassNearTarget(blob, label)).find((code) => code) ?? null;
}

function freezeIdentityCopy(identity: ConfirmedProgrammeIdentity): ConfirmedProgrammeIdentity {
  return Object.freeze({
    ...identity,
    officialTitles: Object.freeze([...(identity.officialTitles ?? [])]),
    aliases: Object.freeze([...(identity.aliases ?? [])]),
    supportingSources: Object.freeze([...(identity.supportingSources ?? [])]),
    provenance: Object.freeze({
      programmeName: identity.provenance?.programmeName ?? null,
      degreeLevel: identity.provenance?.degreeLevel ?? null,
      degreeClass: identity.provenance?.degreeClass ?? null,
      trackOrCurriculum: identity.provenance?.trackOrCurriculum ?? null,
      aliases: Object.freeze([...(identity.provenance?.aliases ?? [])]),
    }),
  }) as ConfirmedProgrammeIdentity;
}

export function enrichConfirmedIdentity(
  identity: ConfirmedProgrammeIdentity,
  target: IdentityTarget,
  sources: Array<{ url: string; title: string; text?: string; sourceType?: string }>,
  enrichedAt = new Date().toISOString(),
): ConfirmedProgrammeIdentity {
  if (identity.degreeClass) return identity;
  const parts = splitCatalogueTitle(target.name);
  const labels = [...new Set([parts.programmeName, ...(target.verifiedTitles ?? []), ...identity.officialTitles, ...identity.aliases].map((item) => item.trim()).filter((item) => item.length > 3))];
  let filled: { code: string; url: string; sourceType: string } | null = null;
  for (const source of sources) {
    const page = { url: source.url, title: source.title, text: source.text ?? "" };
    if (admissionSourceScope(page, target, identity) !== "programme_specific") continue;
    const blob = `${source.title}\n${source.text ?? ""}`;
    const decision = sourceDecision(target, blob, source.url, identity);
    if (!decision.confirmed) continue;
    const classCode = classNearConfirmedProgramme(blob, labels);
    if (!classCode) continue;
    if (!filled) {
      filled = { code: classCode, url: source.url, sourceType: source.sourceType || "official_programme_page" };
      continue;
    }
    if (filled.code !== classCode) break;
  }
  if (!filled) return identity;
  const supportingSources = [...(identity.supportingSources ?? [])];
  if (!supportingSources.includes(filled.url) && supportingSources.length < 4) supportingSources.push(filled.url);
  return freezeIdentityCopy({
    ...identity,
    degreeClass: filled.code,
    supportingSources,
    provenance: {
      programmeName: identity.provenance?.programmeName ?? null,
      degreeLevel: identity.provenance?.degreeLevel ?? null,
      degreeClass: {
        value: filled.code,
        sourceUrl: filled.url,
        sourceType: filled.sourceType,
        confirmedAt: enrichedAt,
        confidence: "confirmed",
      },
      trackOrCurriculum: identity.provenance?.trackOrCurriculum ?? null,
      aliases: identity.provenance?.aliases ?? [],
    },
  });
}

export { buildDiscoveryQueries };
