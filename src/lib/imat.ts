import { promises as fs } from "fs";
import path from "path";

/** Normalized shape consumed by UI pages. */
export type ImatInfo = {
  fullName: string;
  what: string;
  whoNeedsIt: string;
  typicalTimeline: string;
  sections: string[];
  notes: string[];
  registrationPortal: string;
  universitaly: string;
  universitalyNote: string;
  documents: string[];
  officialSources: string[];
};

export type SingleCycleProgram = {
  universityId: string;
  name: string;
  field: string;
  applyUrl: string | null;
  admissionTest?: string | null;
  notes?: string;
};

export type SingleCycleDataset = {
  lastUpdated: string;
  note: string;
  imat: {
    fullName?: string;
    whatItIs?: string;
    what?: string;
    whoNeedsIt: string;
    registrationPortal: string;
    universitaly?: string;
    universitalyNote?: string;
    typicalTimeline: string | string[];
    sections?: string[];
    notes?: string[];
    documents?: string[];
    officialSources: string[];
  };
  programs: SingleCycleProgram[];
};

const DATA_PATH = path.join(process.cwd(), "src/data/english-single-cycle.json");

export async function getSingleCycleDataset(): Promise<SingleCycleDataset> {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  return JSON.parse(raw) as SingleCycleDataset;
}

export async function getImatInfo(): Promise<ImatInfo> {
  const data = await getSingleCycleDataset();
  const imat = data.imat;
  const timeline = Array.isArray(imat.typicalTimeline)
    ? imat.typicalTimeline.join(" · ")
    : imat.typicalTimeline;
  const notes = imat.notes ?? [];
  const universitalyNote =
    imat.universitalyNote ??
    notes.find((n) => /non-EU|Universitaly|pre-enrol/i.test(n)) ??
    "Non-EU residents abroad must complete Universitaly pre-enrolment for their chosen university in addition to IMAT registration. Confirm annual deadlines on Universitaly.";

  return {
    fullName: imat.fullName ?? "International Medical Admissions Test",
    what: imat.whatItIs ?? imat.what ?? "",
    whoNeedsIt: imat.whoNeedsIt,
    typicalTimeline: timeline,
    sections: imat.sections ?? [],
    notes,
    registrationPortal: imat.registrationPortal,
    universitaly: imat.universitaly ?? imat.registrationPortal,
    universitalyNote,
    documents: imat.documents ?? [
      "Valid passport / identity document for Universitaly registration and the test day",
      "Upper secondary diploma (or equivalent) meeting Italian university entry rules for foreign qualifications — confirm Pakistan HSSC / A-Level pathway with the university and CIMEA guidance",
      "Universitaly IMAT registration (and payment of the participation fee shown on the portal)",
      "Universitaly international pre-enrolment dossier for non-EU residents abroad (https://www.universitaly.it/studenti-stranieri)",
      "Optional English language certificate (Annex 3 of the decree) — not required to sit IMAT; may help in tie-breaks / enrolment",
      "Study visa documents after assignment (financial means, accommodation, insurance) — follow the Italian Embassy/Consulate checklist for Pakistan",
    ],
    officialSources: imat.officialSources,
  };
}
