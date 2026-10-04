import { promises as fs } from "fs";
import path from "path";

export type GuideStep = { title: string; body: string };

export type PakistanGuides = {
  lastUpdated: string;
  universitalyPreEnrolmentDeadline: string;
  universitalyDeadlineLabel: string;
  universitalyNote: string;
  documentChain: { title: string; intro: string; steps: GuideStep[] };
  apostille: { title: string; steps: string[] };
  dovChecklist: {
    title: string;
    intro: string;
    items: string[];
    submissionNote: string;
  };
  postAdmission: {
    title: string;
    intro: string;
    islamabadTrack: string[];
    karachiTrack: string[];
    visaDocuments: string[];
    cimeaLinks: { register: string; bls: string };
  };
  scholarshipPakistan: {
    title: string;
    intro: string;
    steps: GuideStep[];
    documentsBeforeTravel: string[];
    italyLegalisation: string[];
    moneyNotes: string[];
  };
  islamabadVisaChecklist: {
    title: string;
    intro: string;
    items: string[];
  };
  karachiVisaInfo: {
    title: string;
    intro: string;
    steps: string[];
    visaDocuments: string[];
    scamWarning: string;
  };
  motivationLetter: {
    title: string;
    intro: string;
    structure: GuideStep[];
    tips: string[];
    mistakes: string[];
  };
  downloads: Array<{ label: string; href: string }>;
};

const DATA_PATH = path.join(process.cwd(), "src/data/pakistan-guides.json");

export async function getPakistanGuides(): Promise<PakistanGuides> {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  return JSON.parse(raw) as PakistanGuides;
}
