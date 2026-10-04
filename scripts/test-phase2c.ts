import { buildRequirements } from "../src/lib/catalogue-requirements";
import { matchProgramme } from "../src/lib/matching/programme-match";
import type { CatalogueCard } from "../src/lib/programme-catalogue";
import { BLANK_ENRICHMENT } from "../src/lib/programme-catalogue";
import { EMPTY_PROFILE, type StudentProfile } from "../src/lib/student-types";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function profile(partial: Partial<StudentProfile>): StudentProfile {
  return { ...EMPTY_PROFILE, ...partial };
}

function card(partial: Partial<CatalogueCard> & { notes?: string; cgpaText?: string }): CatalogueCard {
  const english = partial.englishRequirement ?? "IELTS 6.0 overall";
  const test = partial.admissionTest ?? null;
  return {
    slug: "sample",
    name: "Business Administration",
    level: "master",
    field: "Business",
    universityId: "sample",
    universityName: "University X",
    city: "Rome",
    region: "lazio",
    language: "English",
    status: "open",
    finderStatus: "open",
    deadline: "2026-11-15",
    deadlineLabel: "15 November 2026",
    countdown: null,
    estimatedDeadline: false,
    applicationFeeEuro: 30,
    englishRequirement: english,
    admissionTest: test,
    centS: false,
    greGmat: false,
    requiresCimea: null,
    applyUrl: null,
    admissionPortal: null,
    universityWebsite: "https://example.edu",
    catalogueChecked: "2026-09-18",
    verificationStatus: "verified",
    sourceUrl: "https://example.edu/admissions",
    sourceTitle: "University website",
    intake: "2026/27",
    ...BLANK_ENRICHMENT,
    requirements: buildRequirements({
      englishRequirement: english,
      admissionTest: test,
      notes: partial.notes,
      cgpaRequirement: partial.cgpaText,
    }),
  };
}

const base = profile({
  studyLevel: "bachelors",
  field: "Business",
  cgpa: "3.4",
  gradeSystem: "cgpa",
  cgpaScale: "4",
  englishProof: "IELTS",
  englishScore: "6.5",
  regionPreference: "lazio",
  maxApplicationFeeEuro: "30",
  willingToTakeTest: "yes",
});

const above = matchProgramme(base, card({}));
assert(above.category !== "mismatch", "IELTS above minimum is not a rejection");
assert(above.reasons.some((reason) => reason.text.includes("Your IELTS 6.5 meets the published minimum of 6")), "IELTS explanation");

const below = matchProgramme(profile({ ...base, englishScore: "5.5" }), card({ englishRequirement: "IELTS 6.5 overall" }));
assert(below.category === "mismatch", "IELTS below minimum is a published conflict");
assert(below.requirementState === "published-conflict", "requirements badge");
assert(below.publishedConflicts.some((reason) => reason.text.includes("below the published IELTS 6.5")), "IELTS conflict text");

const moiYes = matchProgramme(
  profile({ ...base, englishProof: "MOI", englishScore: "" }),
  card({ englishRequirement: "IELTS Required (B2 CEFR; MOI letter accepted for exemption)" }),
);
assert(moiYes.reasons.some((reason) => reason.text.includes("explicitly accepts medium of instruction")), "explicit MOI matches");
assert(moiYes.category !== "mismatch", "accepted MOI is not a conflict");

const moiUnknown = matchProgramme(
  profile({ ...base, englishProof: "MOI", englishScore: "" }),
  card({ englishRequirement: "IELTS Required (B2 CEFR or accepted equivalents)" }),
);
assert(moiUnknown.requirementState === "unknown", "unknown MOI needs checking");
assert(moiUnknown.category !== "mismatch", "unknown MOI is not a rejection");
assert(!JSON.stringify(moiUnknown).includes("MOI should be fine"), "no guessed MOI");

const moiNo = matchProgramme(
  profile({ ...base, englishProof: "MOI", englishScore: "" }),
  card({ englishRequirement: "English Proficiency (Cambridge/IELTS/TOEFL accepted; MOI not accepted)" }),
);
assert(moiNo.category === "mismatch", "explicit MOI rejection is a published conflict");

const willing = matchProgramme(base, card({ admissionTest: "CEnT-S" }));
assert(willing.preferenceState === "fits", "willing student has no preference conflict from the test");
assert(willing.reasons.some((reason) => reason.text.includes("CEnT-S")), "test requirement is explained");

const unwilling = matchProgramme(profile({ ...base, willingToTakeTest: "no" }), card({ admissionTest: "CEnT-S" }));
assert(unwilling.category !== "mismatch", "refusing a test is not an eligibility mismatch");
assert(unwilling.preferenceState === "conflict", "test preference is separate");
assert(unwilling.preferenceConflicts.some((reason) => reason.text.includes("prefer not to take")), "preference wording");
assert(unwilling.requirementState !== "published-conflict", "the test preference is not a published conflict");

const unknownTest = matchProgramme(base, card({ admissionTest: null }));
assert(unknownTest.category !== "mismatch", "unknown test is not a rejection");
assert(!unknownTest.publishedConflicts.length, "unknown test creates no published conflict");

const tuitionKnown = matchProgramme(
  profile({ ...base, annualBudgetEuro: "1000" }),
  card({ notes: "Annual tuition €2,500 per year." }),
);
assert(tuitionKnown.preferenceConflicts.some((reason) => reason.text.includes("tuition")), "known tuition can conflict with a budget preference");
assert(tuitionKnown.category !== "mismatch", "budget is a preference");

const tuitionUnknown = matchProgramme(base, card({ notes: "Enrolment first instalment €156." }));
assert(!tuitionUnknown.checks.some((reason) => /tuition/i.test(reason.text)), "an instalment is not treated as tuition");

const cutoff = matchProgramme(
  profile({ ...base, gradeSystem: "percentage", percentage: "60", cgpa: "" }),
  card({ cgpaText: "Minimum 70% overall" }),
);
assert(cutoff.category === "mismatch", "a direct percentage cutoff can conflict");

const cutoffUnknown = matchProgramme(base, card({ cgpaText: "Program-dependent (e.g. Economics ≥70% overall + math)" }));
assert(cutoffUnknown.category !== "mismatch", "an example cutoff is not a rejection");

const incomplete = matchProgramme(profile({}), card({}));
assert(incomplete.category !== "mismatch", "an empty profile is not rejected");
assert(incomplete.checks.length > 0, "an empty profile explains what is missing");

const rejected = buildRequirements({ englishRequirement: "MOI not accepted" });
assert(rejected.english.moiAccepted === false, "explicit rejection is false");
const unclear = buildRequirements({ englishRequirement: "Program-dependent" });
assert(unclear.english.moiAccepted === null, "unclear MOI stays null");

console.log("phase 2c checks passed");
