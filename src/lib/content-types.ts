export type ErasmusGuide = {
  lastUpdated: string;
  intake: string;
  officialCatalogue: string;
  officialStudentPage: string;
  ecNews: string;
  selectedProjects2026?: string;
  headline: string;
  intro: string;
  cycle2027: {
    title: string;
    points: string[];
    exampleNewFields: string[];
  };
  timeline: Array<{ when: string; what: string }>;
  scholarship: { title: string; items: string[]; note: string };
  howToApply: string[];
  englishWithoutIelts: { title: string; intro: string; tips: string[] };
  documents: string[];
  archivesNote: string;
  downloads: Array<{ label: string; href: string }>;
};

export type TranslationCompany = {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string | null;
};

export type TranslationRegionList = {
  title: string;
  note: string;
  sourceNote: string;
  pdf?: string;
  companies: TranslationCompany[];
};

export type TranslationGuide = {
  lastUpdated: string;
  intro: string;
  islamabad: TranslationRegionList;
  karachi: TranslationRegionList;
};

export type CompanyProfile = {
  lastUpdated: string;
  legalName: string;
  cuin: string;
  incorporatedOn: string;
  incorporatedOnLabel: string;
  registeredOffice: string;
  registrar: string;
  act: string;
  processId: string;
  filingAckNumber: string;
  filingAckDate: string;
  verifyUrl: string;
  downloads: Array<{ label: string; href: string }>;
  disclaimer: string;
};
