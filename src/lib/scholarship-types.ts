export type ScholarshipStatus = "open" | "soon" | "closed" | "tba";

export interface ScholarshipAgency {
  name: string;
  portalUrl: string;
  applyUrl?: string | null;
  cities?: string[];
  deadlineNote?: string | null;
}

export interface RegionalScholarship {
  id: string;
  region: string;
  regionIt: string;
  agencyName: string;
  portalUrl: string;
  applyUrl: string | null;
  typicalBenefits: string[];
  typicalDocuments: string[];
  deadlineNote: string;
  openPeriod: string;
  status: ScholarshipStatus;
  priority: number;
  citiesServed: string[];
  notes: string;
  sources: string[];
  agencies?: ScholarshipAgency[];
}

export interface ScholarshipGuide {
  steps: string[];
  nationalNotes: string[];
}

export interface ScholarshipsDataset {
  lastUpdated: string;
  intake: string;
  generalGuide: ScholarshipGuide;
  regions: RegionalScholarship[];
}
