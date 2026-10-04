export type EnglishRequirement = {
  level: string | null;
  ieltsMin: number | null;
  toeflMin: number | null;
  /** True only when the stored text explicitly accepts MOI. False only when it explicitly rejects MOI. */
  moiAccepted: true | false | null;
  cambridgeAccepted: true | false | null;
  notes: string | null;
  ambiguous: boolean;
};

export type TestType =
  | "CEnT-S"
  | "TOLC"
  | "SAT"
  | "GRE"
  | "GMAT"
  | "interview"
  | "university test"
  | "other";

export type TestRequirement = {
  required: true | false | null;
  type: TestType[];
  notes: string | null;
};

export type TuitionRequirement = {
  amount: number | null;
  min: number | null;
  max: number | null;
  currency: "EUR";
  period: "year" | "programme" | "semester" | null;
  notes: string | null;
};

export type AcademicRequirement = {
  minimumCgpa: number | null;
  cgpaScale: number | null;
  minimumPercentage: number | null;
  requiredBackground: string[];
  notes: string | null;
};

export type CatalogueRequirements = {
  english: EnglishRequirement;
  test: TestRequirement;
  tuition: TuitionRequirement | null;
  academic: AcademicRequirement;
};

const TEST_PATTERNS: Array<[RegExp, TestType]> = [
  [/cent-s|cents|cisia/i, "CEnT-S"],
  [/\btolc\b/i, "TOLC"],
  [/\bsat\b/i, "SAT"],
  [/\bgre\b/i, "GRE"],
  [/\bgmat\b/i, "GMAT"],
  [/interview/i, "interview"],
  [/\bimat\b|til-i|university test/i, "university test"],
];

function band(value: number, min: number, max: number) {
  return value >= min && value <= max ? value : null;
}

export function parseEnglishRequirement(text: string | null | undefined): EnglishRequirement {
  const raw = String(text ?? "").trim();
  const empty: EnglishRequirement = {
    level: null,
    ieltsMin: null,
    toeflMin: null,
    moiAccepted: null,
    cambridgeAccepted: null,
    notes: raw || null,
    ambiguous: true,
  };
  if (!raw) return empty;

  const ieltsMatch = raw.match(/ielts[^0-9]{0,24}(\d(?:\.\d)?)/i);
  const ieltsMin = ieltsMatch ? band(Number(ieltsMatch[1]), 4, 9) : null;
  const toeflMatch = raw.match(/toefl(?:\s*ibt)?[^0-9]{0,16}(\d{2,3})/i);
  const toeflMin = toeflMatch ? band(Number(toeflMatch[1]), 0, 120) : null;
  const hedged = /typical|often|usually|for some|possible|may apply|unclear/i.test(raw);
  const programmeDependent = /program-dependent|programme-dependent/i.test(raw);
  const cefr = raw.match(/\b(A1|A2|B1|B2|C1|C2)\b/);
  const level = cefr && !hedged && !programmeDependent ? cefr[1] : null;

  let moiAccepted: true | false | null = null;
  if (/moi not accepted|moi rejected|medium of instruction (is )?not accepted/i.test(raw)) moiAccepted = false;
  else if (
    /medium of instruction (is )?accepted|moi letter accepted|moi accepted(?! for some)|exemptions for native\/moi|native\/moi/i.test(raw) &&
    !/for some|possible/i.test(raw)
  ) {
    moiAccepted = true;
  }

  const cambridgeAccepted = /cambridge\/ielts|cambridge[^.]{0,40}accepted/i.test(raw) ? true : null;
  const ambiguous = programmeDependent || hedged || (ieltsMin == null && toeflMin == null && moiAccepted == null && level == null);

  return {
    level,
    ieltsMin,
    toeflMin,
    moiAccepted,
    cambridgeAccepted,
    notes: raw,
    ambiguous,
  };
}

export function parseTestRequirement(admissionTest: string | null | undefined): TestRequirement {
  const raw = String(admissionTest ?? "").trim();
  if (!raw) return { required: null, type: [], notes: null };
  const type: TestType[] = [];
  for (const [pattern, name] of TEST_PATTERNS) {
    if (pattern.test(raw) && !type.includes(name)) type.push(name);
  }
  if (!type.length) type.push("other");
  return { required: true, type, notes: raw };
}

export function parseTuition(text: string | null | undefined): TuitionRequirement | null {
  const raw = String(text ?? "");
  const labeled = raw.match(/tuition[^.]{0,120}/i);
  if (!labeled) return null;
  const amounts = [...labeled[0].matchAll(/€\s*(\d{1,3}(?:[.,]\d{3})+|\d{2,5})/g)].map((match) =>
    Number(match[1].replace(/[.,](?=\d{3}\b)/g, "")),
  );
  if (!amounts.length) return null;
  const period = /\/\s*year|per year|annual/i.test(labeled[0]) ? "year" : /semester/i.test(labeled[0]) ? "semester" : null;
  if (amounts.length === 1) {
    return {
      amount: amounts[0],
      min: null,
      max: null,
      currency: "EUR",
      period,
      notes: labeled[0].trim(),
    };
  }
  return {
    amount: null,
    min: Math.min(...amounts),
    max: Math.max(...amounts),
    currency: "EUR",
    period,
    notes: "Stored as more than one amount, so it is not a single tuition fee.",
  };
}

export function parseAcademicRequirement(text: string | null | undefined): AcademicRequirement {
  const raw = String(text ?? "").trim();
  const base: AcademicRequirement = {
    minimumCgpa: null,
    cgpaScale: null,
    minimumPercentage: null,
    requiredBackground: [],
    notes: raw && !/^program-dependent$/i.test(raw) ? raw : null,
  };
  if (!raw || /e\.g\.|example|program-dependent|programme-dependent|for some/i.test(raw)) return base;
  const percentage = raw.match(/(?:minimum|at least|≥)\s*(\d{2,3})\s*%/i);
  if (percentage) {
    const value = Number(percentage[1]);
    if (value >= 40 && value <= 100) base.minimumPercentage = value;
  }
  const cgpa = raw.match(/minimum\s+cgpa\s+(\d(?:\.\d+)?)\s*(?:\/\s*(\d{1,3}))?/i);
  if (cgpa) {
    base.minimumCgpa = Number(cgpa[1]);
    base.cgpaScale = cgpa[2] ? Number(cgpa[2]) : null;
  }
  return base;
}

export function buildRequirements(input: {
  englishRequirement?: string | null;
  admissionTest?: string | null;
  notes?: string | null;
  cgpaRequirement?: string | null;
}): CatalogueRequirements {
  return {
    english: parseEnglishRequirement(input.englishRequirement),
    test: parseTestRequirement(input.admissionTest),
    tuition: parseTuition(input.notes),
    academic: parseAcademicRequirement(input.cgpaRequirement),
  };
}
