import { readFileSync } from "node:fs";
import { buildRequirements } from "../src/lib/catalogue-requirements";
import { estimateCost } from "../src/lib/cost/calculator";
import { profileCompleteness } from "../src/lib/matching/profile-completeness";
import { matchProgramme, targetLevel } from "../src/lib/matching/programme-match";
import type { CatalogueCard } from "../src/lib/programme-catalogue";
import { BLANK_ENRICHMENT } from "../src/lib/programme-catalogue";
import { matchScholarships } from "../src/lib/scholarships/scholarship-match";
import type { ScholarshipsDataset } from "../src/lib/scholarship-types";
import { EMPTY_PROFILE, type StudentProfile } from "../src/lib/student-types";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function profile(partial: Partial<StudentProfile>): StudentProfile {
  return { ...EMPTY_PROFILE, ...partial };
}

function card(partial: Partial<CatalogueCard>): CatalogueCard {
  return {
    slug: "sample-master-business",
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
    englishRequirement: "IELTS 6.5 overall",
    admissionTest: null,
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
      englishRequirement: partial.englishRequirement ?? "IELTS 6.5 overall",
      admissionTest: partial.admissionTest ?? null,
      notes: null,
      cgpaRequirement: null,
    }),
    ...partial,
  };
}

const scholarships: ScholarshipsDataset = {
  lastUpdated: "2026-09-18",
  intake: "2026/27",
  generalGuide: { steps: [], nationalNotes: [] },
  regions: [
    {
      id: "lazio",
      region: "Lazio",
      regionIt: "Lazio",
      agencyName: "DiSCo Lazio",
      portalUrl: "https://example.org/disco",
      applyUrl: null,
      typicalBenefits: ["Grant"],
      typicalDocuments: [],
      deadlineNote: "See the call",
      openPeriod: "",
      status: "open",
      priority: 1,
      citiesServed: ["Rome"],
      notes: "",
      sources: ["https://example.org/disco"],
    },
    {
      id: "apulia",
      region: "Apulia",
      regionIt: "Puglia",
      agencyName: "ADISU Puglia",
      portalUrl: "",
      applyUrl: null,
      typicalBenefits: [],
      typicalDocuments: [],
      deadlineNote: "",
      openPeriod: "",
      status: "open",
      priority: 2,
      citiesServed: [],
      notes: "",
      sources: [],
    },
    {
      id: "closed-north",
      region: "Lombardy",
      regionIt: "Lombardia",
      agencyName: "Closed agency",
      portalUrl: "https://example.org/closed",
      applyUrl: null,
      typicalBenefits: [],
      typicalDocuments: [],
      deadlineNote: "Closed",
      openPeriod: "",
      status: "closed",
      priority: 3,
      citiesServed: [],
      notes: "",
      sources: ["https://example.org/closed"],
    },
    {
      id: "soon-centre",
      region: "Tuscany",
      regionIt: "Toscana",
      agencyName: "Upcoming agency",
      portalUrl: "https://example.org/soon",
      applyUrl: null,
      typicalBenefits: [],
      typicalDocuments: [],
      deadlineNote: "Not announced",
      openPeriod: "",
      status: "tba",
      priority: 4,
      citiesServed: [],
      notes: "",
      sources: [],
    },
  ],
};

const full = profile({
  studyLevel: "bachelors",
  field: "Business",
  cgpa: "3.4",
  gradeSystem: "cgpa",
  cgpaScale: "4",
  englishProof: "IELTS",
  englishScore: "7",
  regionPreference: "lazio",
  cityPreference: "Rome",
  maxApplicationFeeEuro: "30",
  scholarshipInterest: "yes",
  willingToTakeTest: "yes",
});

assert(profileCompleteness(profile({})).percent < 100, "empty profile is incomplete");
assert(profileCompleteness(full).percent === 100, "full matching profile is complete");
assert(targetLevel(profile({ studyLevel: "intermediate" })) === "bachelor", "intermediate targets bachelor");
assert(targetLevel(profile({ studyLevel: "bsc" })) === "master", "bachelor-level targets master");
assert(targetLevel(profile({ studyLevel: "masters" })) === "phd", "master targets phd");

const strong = matchProgramme(full, card({}));
assert(strong.category === "strong", `expected strong, got ${strong.category}`);
assert(strong.reasons.some((reason) => reason.text.includes("IELTS")), "ielts reason present");
assert(!strong.reasons.some((reason) => /guarantee|probability|eligible/i.test(reason.text)), "no guarantee language");

const lowScore = matchProgramme(profile({ ...full, englishScore: "5.5" }), card({}));
assert(lowScore.category === "mismatch", "score below published IELTS is a mismatch");

const moi = matchProgramme(profile({ ...full, englishProof: "MOI", englishScore: "" }), card({}));
assert(moi.category !== "strong", "MOI is not treated as accepted without an explicit statement");
assert(moi.checks.some((reason) => reason.text.includes("not clearly stated")), "MOI warning present");

const moiAccepted = matchProgramme(
  profile({ ...full, englishProof: "MOI", englishScore: "" }),
  card({ englishRequirement: "Medium of instruction is accepted" }),
);
assert(moiAccepted.reasons.some((reason) => reason.text.includes("medium of instruction")), "explicit MOI can match");

const noEnglish = matchProgramme(profile({ ...full, englishProof: "None", englishScore: "" }), card({ englishRequirement: "" }));
assert(noEnglish.category !== "mismatch", "missing English data is not a rejection");

const bachelorTarget = matchProgramme(profile({ ...full, studyLevel: "intermediate" }), card({ level: "master" }));
assert(bachelorTarget.category !== "mismatch", "a different target level is not a published rejection");
assert(bachelorTarget.preferenceConflicts.some((reason) => reason.text.includes("preference")), "target level is a preference conflict");

const phd = matchProgramme(profile({ studyLevel: "masters", field: "Data", englishProof: "IELTS", englishScore: "7" }), card({ level: "phd", field: "Data Science", name: "Data Science" }));
assert(phd.category !== "mismatch", "master profile can see a PhD programme");

const percentage = matchProgramme(profile({ ...full, gradeSystem: "percentage", cgpa: "", percentage: "78" }), card({}));
assert(percentage.category === "strong", "percentage profile still matches when other factors fit");

const missingFee = matchProgramme(full, card({ applicationFeeEuro: null }));
assert(missingFee.category !== "mismatch", "missing fee is not a mismatch");
assert(missingFee.checks.some((reason) => reason.text.includes("not recorded")), "missing fee is flagged");

const lazio = matchScholarships(profile({ regionPreference: "lazio", scholarshipInterest: "yes" }), scholarships);
assert(lazio.find((row) => row.id === "lazio")?.label === "potentially-relevant", "Lazio call can be potentially relevant");
const south = matchScholarships(profile({ regionPreference: "south" }), scholarships);
assert(south.find((row) => row.id === "apulia")?.label === "potentially-relevant", "South preference includes Apulia");
assert(south.find((row) => row.id === "lazio")?.label === "not-relevant", "Lazio is not relevant to a South preference");
assert(south.find((row) => row.id === "apulia")?.sourceUrl == null, "missing source stays empty");
assert(lazio.find((row) => row.id === "closed-north")?.label === "closed", "closed call stays closed");
assert(lazio.find((row) => row.id === "soon-centre")?.label === "upcoming", "unannounced call stays upcoming");
assert(
  !JSON.stringify(lazio).match(/qualify|guaranteed|Fascia 1/i),
  "scholarship results do not guarantee an award",
);

const yearInput = {
  applicationFeeEuro: 30,
  testFeeEuro: 0,
  documentsEuro: 350,
  visaEuro: 100,
  insuranceEuro: 0,
  flightEuro: 400,
  tuitionEuro: 1000,
  rentMonthlyEuro: 500,
  foodMonthlyEuro: 200,
  transportMonthlyEuro: 50,
  utilitiesMonthlyEuro: 0,
  personalMonthlyEuro: 0,
  contingencyEuro: 0,
  exchangeRate: null,
  scholarshipScenario: false,
  expectedScholarshipEuro: 4000,
};
const baseCost = estimateCost(yearInput);
assert(baseCost.upfrontEuro === 1880, `upfront ${baseCost.upfrontEuro}`);
assert(baseCost.monthlyLivingEuro === 750, `monthly ${baseCost.monthlyLivingEuro}`);
assert(baseCost.firstYearEuro === 10880, `year ${baseCost.firstYearEuro}`);
assert(baseCost.withScholarshipEuro == null, "scholarship scenario stays off");
assert(baseCost.pkr == null, "PKR stays hidden without a rate");

const zero = estimateCost({
  ...yearInput,
  applicationFeeEuro: 0,
  documentsEuro: 0,
  visaEuro: 0,
  flightEuro: 0,
  tuitionEuro: 0,
  rentMonthlyEuro: 0,
  foodMonthlyEuro: 0,
  transportMonthlyEuro: 0,
  exchangeRate: 300,
  scholarshipScenario: true,
  expectedScholarshipEuro: 200,
});
assert(zero.firstYearEuro === 0, "zero inputs stay zero");
assert(zero.withScholarshipEuro === 0, "scholarship scenario cannot go below zero");
assert(zero.pkr === 0, "zero EUR converts to zero PKR");

const awarded = estimateCost({
  ...yearInput,
  exchangeRate: 300,
  scholarshipScenario: true,
  expectedScholarshipEuro: 2000,
});
assert(awarded.firstYearEuro === 10880, "scenario does not change the base total");
assert(awarded.withScholarshipEuro === 8880, `scholarship scenario ${awarded.withScholarshipEuro}`);
assert(awarded.pkr === 10880 * 300, "PKR uses the entered rate on the base total");

const route = readFileSync(new URL("../src/app/api/portal/matches/route.ts", import.meta.url), "utf8");
assert(route.includes("sessionIdFromRequest"), "matches API uses the session");
assert(!route.includes("searchParams.get(\"student") && !route.includes("body.studentId"), "matches API does not trust a browser student id");

console.log("phase 2b checks passed");
