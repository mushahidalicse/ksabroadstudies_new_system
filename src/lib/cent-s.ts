import { promises as fs } from "fs";
import path from "path";

export type CentSSection = {
  name: string;
  durationMinutes: number;
  topics: string;
};

export type CentSGuide = {
  lastUpdated: string;
  fullName: string;
  whatItIs: string;
  whoNeedsIt: string;
  registrationPortal: string;
  cisiaHome: string;
  feeEuro: number;
  formats: string[];
  macroPeriods: string[];
  structure: {
    totalQuestions: number;
    durationMinutes: number;
    sections: CentSSection[];
  };
  scoringNote: string;
  howToUseScore: string;
  typicalFields: string[];
  exceptions: string[];
  notes: string[];
  officialSources: string[];
};

const DATA_PATH = path.join(process.cwd(), "src/data/cent-s-guide.json");

export async function getCentSGuide(): Promise<CentSGuide> {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  return JSON.parse(raw) as CentSGuide;
}
