export type PhdPortalType = "pica" | "esse3" | "own" | "mixed" | "unknown";

export type PhdProgramme = {
  name: string;
  field: string;
  language: string;
  applyUrl: string | null;
  notes: string;
};

export type PhdUniversity = {
  id: string;
  name: string;
  city?: string;
  region?: string;
  priority: number;
  website?: string;
  phdHubUrl: string | null;
  applicationPortal: string | null;
  applicationPortalNote: string | null;
  portalType: PhdPortalType;
  cycleNote: string;
  typicalDeadlineWindow: string | null;
  englishNote: string | null;
  programmes: PhdProgramme[];
  requirements: string[];
  selection: string | null;
  scholarshipNote: string | null;
  sources: string[];
  confidence: string;
};

export type PhdGuide = {
  lastUpdated: string;
  cycle: string;
  academicYear: string;
  picaLogin: string;
  picaHome: string;
  headline: string;
  intro: string;
  procedure: Array<{ title: string; body: string }>;
  documentsChecklist: string[];
  picaSteps: string[];
  englishReality: string;
  scholarshipNote: string;
  universitalyNote: string;
  disclaimer: string;
};

export type PhdDataset = {
  lastUpdated: string;
  cycle: string;
  academicYear: string;
  guide: PhdGuide;
  universityCount: number;
  programmeCount: number;
  universities: PhdUniversity[];
};
