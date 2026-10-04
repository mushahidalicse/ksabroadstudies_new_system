import { readFileSync } from "node:fs";
import { buildRequirements } from "../src/lib/catalogue-requirements";
import { buildDegreeCatalogue, buildPhdCatalogue } from "../src/lib/programme-catalogue";
import type { PhdDataset } from "../src/lib/phd-types";
import type { UniversitiesDataset } from "../src/lib/types";

const universities = JSON.parse(readFileSync(new URL("../src/data/universities.json", import.meta.url), "utf8")) as UniversitiesDataset;
const phd = JSON.parse(readFileSync(new URL("../src/data/phd.json", import.meta.url), "utf8")) as PhdDataset;
const cards = [
  ...buildDegreeCatalogue(universities),
  ...buildPhdCatalogue(phd.universities, { lastUpdated: phd.lastUpdated, academicYear: phd.academicYear }),
];

const count = (predicate: (card: (typeof cards)[number]) => boolean) => cards.filter(predicate).length;
const ownProgrammeDate = universities.universities.reduce(
  (count, university) => count + university.programs.filter((program) => program.lastVerified).length,
  0,
);
const report = {
  totalProgrammes: cards.length,
  explicitIeltsMinimum: count((card) => card.requirements.english.ieltsMin != null),
  explicitToeflMinimum: count((card) => card.requirements.english.toeflMin != null),
  explicitMoiAccepted: count((card) => card.requirements.english.moiAccepted === true),
  explicitMoiRejected: count((card) => card.requirements.english.moiAccepted === false),
  moiUnknown: count((card) => card.requirements.english.moiAccepted == null),
  explicitTestRequirement: count((card) => card.requirements.test.required === true),
  structuredTuitionSingleAmount: count((card) => card.requirements.tuition?.amount != null),
  structuredTuitionRange: count((card) => card.requirements.tuition != null && card.requirements.tuition.amount == null),
  academicCutoff: count((card) => card.requirements.academic.minimumCgpa != null || card.requirements.academic.minimumPercentage != null),
  officialSourceStored: count((card) => Boolean(card.sourceUrl)),
  markedVerifiedWithSource: count((card) => card.verificationStatus === "verified" && Boolean(card.sourceUrl)),
  needsReview: count((card) => card.verificationStatus === "needs_review"),
  programmeLevelVerifiedDate: ownProgrammeDate,
  ambiguousEnglish: count((card) => card.requirements.english.ambiguous),
  missingSource: count((card) => !card.sourceUrl),
  missingDeadline: count((card) => !card.deadline),
  missingApplicationFee: count((card) => card.applicationFeeEuro == null),
};

console.log(JSON.stringify(report, null, 2));

const sample = buildRequirements({
  englishRequirement: "IELTS Required (min IELTS 5.5 / TOEFL iBT 72 / B2 CEFR) or exemption",
  admissionTest: "CEnT-S",
  notes: "Non-EU tuition fixed by country list (€206/€256/€356 incl. regional).",
  cgpaRequirement: "Program-dependent (e.g. Economics ≥70% overall + math)",
});
if (sample.english.ieltsMin !== 5.5 || sample.english.toeflMin !== 72) throw new Error("english parse failed");
if (sample.english.moiAccepted !== null) throw new Error("MOI was inferred");
if (sample.test.type[0] !== "CEnT-S") throw new Error("test parse failed");
if (sample.tuition?.amount != null || sample.tuition?.min !== 206 || sample.tuition?.max !== 356) throw new Error("tuition range parse failed");
if (sample.academic.minimumPercentage != null) throw new Error("example cutoff was treated as a rule");

const enrichmentFile = JSON.parse(readFileSync(new URL("../src/data/programme-enrichment.json", import.meta.url), "utf8")) as {
  records: Array<{ slug: string; verificationStatus: string; sourceUrl: string; lastChecked: string; english: { ieltsMin: number | null; moi: string | null }; academic: { requiredBackground: string[] } }>;
};
const byUniversity = new Map<string, { total: number; verified: number; missingSource: number }>();
for (const card of cards) {
  const row = byUniversity.get(card.universityName) ?? { total: 0, verified: 0, missingSource: 0 };
  row.total += 1;
  const record = enrichmentFile.records.find((item) => item.slug === card.slug);
  if (record?.verificationStatus === "verified") row.verified += 1;
  if (!record?.sourceUrl) row.missingSource += 1;
  byUniversity.set(card.universityName, row);
}
const enrichment = {
  records: enrichmentFile.records.length,
  programmeLevelSource: enrichmentFile.records.filter((record) => record.sourceUrl).length,
  programmeLevelVerifiedDate: enrichmentFile.records.filter((record) => record.verificationStatus === "verified" && record.lastChecked).length,
  needsReview: enrichmentFile.records.filter((record) => record.verificationStatus === "needs_review").length,
  partiallyVerified: enrichmentFile.records.filter((record) => record.verificationStatus === "partially_verified").length,
  verified: enrichmentFile.records.filter((record) => record.verificationStatus === "verified").length,
  outdated: enrichmentFile.records.filter((record) => record.verificationStatus === "outdated").length,
  missingSource: cards.length - enrichmentFile.records.filter((record) => record.sourceUrl).length,
  byUniversity: [...byUniversity.entries()].map(([university, counts]) => ({ university, ...counts })),
};
console.log(JSON.stringify({ enrichmentRecords: enrichment.records, verified: enrichment.verified, missingSource: enrichment.missingSource }, null, 2));
