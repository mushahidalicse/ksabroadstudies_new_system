import type { RegionalScholarship, ScholarshipsDataset } from "@/lib/scholarship-types";
import type { StudentProfile } from "@/lib/student-types";

export type ScholarshipLabel =
  | "potentially-relevant"
  | "check-current-call"
  | "not-relevant"
  | "closed"
  | "upcoming";

export type ScholarshipMatch = {
  id: string;
  name: string;
  region: string;
  agency: string;
  status: RegionalScholarship["status"];
  label: ScholarshipLabel;
  deadline: string;
  benefits: string[];
  sourceUrl: string | null;
  sourceTitle: string | null;
  lastUpdated: string;
  academicYear: string | null;
  nextCall: string | null;
  why: string[];
  stillRequired: string[];
};

const SOUTH = new Set(["apulia", "campania", "calabria", "sicily", "sardinia", "basilicata", "molise", "abruzzo"]);
const CENTRE = new Set(["tuscany", "umbria", "marche", "lazio"]);
const NORTH = new Set([
  "lombardy",
  "veneto",
  "piedmont",
  "liguria",
  "emilia-romagna",
  "friuli-venezia giulia",
  "trentino (trento)",
  "south tyrol (alto adige / bolzano)",
  "aosta valley",
]);

function regionFits(preference: StudentProfile["regionPreference"], scholarship: RegionalScholarship) {
  const name = scholarship.region.toLowerCase();
  const id = scholarship.id.toLowerCase();
  if (!preference) return null;
  if (preference === "lazio") return id === "lazio" || name === "lazio";
  if (preference === "south") return SOUTH.has(name);
  if (preference === "centre") return CENTRE.has(name);
  return NORTH.has(name);
}

function statedYear(note: string) {
  const match = note.match(/a\.y\.\s*(20\d{2}\s*\/\s*\d{4})/i) || note.match(/\b(20\d{2}\s*\/\s*20\d{2})\b/);
  return match ? match[1].replace(/\s/g, "") : null;
}

export function matchScholarships(profile: StudentProfile, dataset: ScholarshipsDataset): ScholarshipMatch[] {
  return dataset.regions.map((scholarship) => {
    const fit = regionFits(profile.regionPreference, scholarship);
    const why: string[] = [];
    const stillRequired = [
      "Check the current official call.",
      "Income, ISEE, or ISEE Parificato rules are not decided here.",
      "Merit, enrolment, and deadline conditions still apply.",
    ];
    if (profile.scholarshipInterest !== "yes") {
      stillRequired.push("You have not said that you want scholarship screening.");
    }
    if (fit === true) {
      why.push(`Your selected region matches ${scholarship.region}.`);
      why.push("This regional support is for students at eligible institutions in that area.");
    } else if (fit === false) {
      why.push(`Your selected region does not match ${scholarship.region}.`);
    } else {
      why.push("No region is selected, so this call is listed for you to check.");
    }
    let label: ScholarshipLabel = "check-current-call";
    if (scholarship.status === "closed") label = "closed";
    else if (scholarship.status === "soon" || scholarship.status === "tba") label = "upcoming";
    else if (fit === false) label = "not-relevant";
    else if (fit === true) label = "potentially-relevant";
    if (!scholarship.sources.length && !scholarship.portalUrl) {
      stillRequired.push("No official source is stored for this record.");
    }
    return {
      id: scholarship.id,
      name: scholarship.agencyName || scholarship.region,
      region: scholarship.region,
      agency: scholarship.agencyName,
      status: scholarship.status,
      label,
      deadline: scholarship.deadlineNote,
      benefits: scholarship.typicalBenefits,
      sourceUrl: scholarship.portalUrl || scholarship.sources[0] || null,
      sourceTitle: scholarship.sources[0] ? "Stored source" : scholarship.portalUrl ? "Agency portal" : null,
      lastUpdated: dataset.lastUpdated,
      academicYear: statedYear(`${scholarship.deadlineNote} ${scholarship.openPeriod}`),
      nextCall: scholarship.status === "closed" || scholarship.status === "tba" ? "Next call not announced" : null,
      why,
      stillRequired,
    };
  });
}

export const SCHOLARSHIP_LABEL: Record<ScholarshipLabel, string> = {
  "potentially-relevant": "Potentially relevant",
  "check-current-call": "Check current call",
  "not-relevant": "Not relevant to selected region",
  closed: "Currently closed",
  upcoming: "Upcoming / not announced",
};
