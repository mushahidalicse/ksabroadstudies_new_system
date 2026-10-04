import { getPhdUniversities } from "@/lib/phd";
import { getPrograms, getUniversities } from "@/lib/data";
import { programTrack } from "@/lib/document-vault";
import { getScholarshipRegions } from "@/lib/scholarships";
import { shortlistReady, type PublicStudent } from "@/lib/student-types";
import type { ScholarshipStatus } from "@/lib/scholarship-types";
import type { AdmissionStatus, University } from "@/lib/types";
import { effectiveAdmissionStatus } from "@/lib/admission-status";

export type MatchRow = {
  rank: number;
  kind: "program" | "phd";
  title: string;
  subtitle: string;
  href: string;
  status?: AdmissionStatus;
  field?: string;
  university?: string;
  region?: string;
  englishRequirement?: string;
  fitScore: number;
  why: string;
};

export type ProfileAnalysis = {
  headline: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  readiness: "ready" | "almost" | "incomplete";
  catalogueScanned: number;
};

export type ScholarshipHint = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  status: ScholarshipStatus;
};

export type MatchResult = {
  analysis: ProfileAnalysis;
  matches: MatchRow[];
  scholarships: ScholarshipHint[];
};

const SOUTH = new Set([
  "Apulia",
  "Campania",
  "Calabria",
  "Sicily",
  "Sardinia",
  "Basilicata",
  "Molise",
  "Abruzzo",
]);
const CENTRE = new Set(["Tuscany", "Umbria", "Marche", "Lazio"]);
const NORTH = new Set([
  "Lombardy",
  "Veneto",
  "Piedmont",
  "Liguria",
  "Emilia-Romagna",
  "Friuli-Venezia Giulia",
  "Trentino (Trento)",
  "South Tyrol (Alto Adige / Bolzano)",
  "Aosta Valley",
]);

async function suggestScholarships(student: PublicStudent): Promise<ScholarshipHint[]> {
  const regions = await getScholarshipRegions();
  const pref = student.profile.regionPreference;
  const picked = regions.filter((region) => {
    if (!pref) return region.priority <= 2 || region.region === "Lazio";
    if (pref === "lazio") return region.region === "Lazio";
    if (pref === "south") return SOUTH.has(region.region);
    if (pref === "centre") return CENTRE.has(region.region);
    return NORTH.has(region.region);
  });
  return picked.slice(0, 4).map((region) => ({
    id: region.id,
    title: region.agencyName,
    subtitle: `${region.region} · ${region.openPeriod}`,
    href: `/scholarships/${region.id}`,
    status: region.status,
  }));
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s+/.-]/g, " ")
    .split(/[\s+/.-]+/)
    .filter((t) => t.length > 2);
}

function overlap(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit += 1;
  return hit / Math.min(A.size, B.size);
}

function parseCgpa(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const pct = s.match(/(\d{2,3}(?:\.\d+)?)\s*%/);
  if (pct) {
    const p = Number(pct[1]);
    if (p > 100) return null;
    return Math.min(4, (p / 100) * 4);
  }
  const outOf = s.match(/(\d(?:\.\d+)?)\s*\/\s*(\d(?:\.\d+)?)/);
  if (outOf) {
    const n = Number(outOf[1]);
    const d = Number(outOf[2]);
    if (d > 0) return Math.min(4, (n / d) * 4);
  }
  const plain = s.match(/(\d(?:\.\d+)?)/);
  if (plain) {
    const n = Number(plain[1]);
    if (n <= 4) return n;
    if (n <= 10) return Math.min(4, (n / 10) * 4);
    if (n <= 100) return Math.min(4, (n / 100) * 4);
  }
  return null;
}

function englishScore(proof: string, uni: University | undefined): { pts: number; note: string } {
  const p = proof.toLowerCase();
  if (!p) return { pts: 0, note: "" };
  const hasIelts = /ielts|toefl|pte|duolingo|cambridge/.test(p);
  const hasMoi = /moi|medium of instruction|english taught|waiver/.test(p);
  const req = (uni?.englishRequirement || "").toLowerCase();
  if (hasIelts) {
    return {
      pts: req.includes("ielts") || req.includes("toefl") || !req ? 4 : 3,
      note: "English certificate listed",
    };
  }
  if (hasMoi) {
    return {
      pts: /program-dependent|check|varies|moi|waiver|not required/i.test(req) ? 3 : 2,
      note: "MOI / waiver noted",
    };
  }
  return { pts: 1, note: "English note on file" };
}

function cgpaFit(studentCgpa: number | null, uni: University | undefined): { pts: number; note: string } {
  if (studentCgpa === null) return { pts: 0, note: "" };
  const req = (uni?.cgpaRequirement || "").toLowerCase();
  if (!req || req.includes("program-dependent") || req.includes("check")) {
    return { pts: 2, note: `CGPA ${studentCgpa.toFixed(1)}/4 on file` };
  }
  const need = parseCgpa(req);
  if (need === null) return { pts: 2, note: `CGPA ${studentCgpa.toFixed(1)}/4 on file` };
  if (studentCgpa + 0.05 >= need) {
    return { pts: 4, note: `CGPA meets typical bar (~${need.toFixed(1)})` };
  }
  if (studentCgpa + 0.4 >= need) {
    return { pts: 2, note: "CGPA close to typical requirement" };
  }
  return { pts: 0, note: "CGPA may be below typical bar — verify portal" };
}

function analyzeProfile(student: PublicStudent, catalogueScanned: number): ProfileAnalysis {
  const p = student.profile;
  const docs = student.documents ?? [];
  const kinds = new Set(docs.map((d) => d.kind));
  const strengths: string[] = [];
  const gaps: string[] = [];

  if (p.studyLevel) strengths.push(`Target level: ${p.studyLevel}`);
  else gaps.push("Choose bachelor / master / medicine / PhD");

  if (p.field.trim()) strengths.push(`Field interest: ${p.field.trim()}`);
  else gaps.push("Add your preferred field (e.g. Computer Science)");

  if (p.cgpa.trim()) strengths.push(`Academic record noted: ${p.cgpa.trim()}`);
  else gaps.push("Add CGPA or percentage for better filtering");

  if (p.englishProof.trim()) strengths.push(`English proof: ${p.englishProof.trim()}`);
  else gaps.push("Add IELTS / TOEFL / MOI note");

  if (p.cityPreference.trim() || p.regionPreference) {
    strengths.push(
      `Location: ${[p.cityPreference.trim(), p.regionPreference].filter(Boolean).join(" · ")}`,
    );
  } else {
    gaps.push("Optional: preferred city or Italy region");
  }

  if (
    kinds.has("passport") ||
    kinds.has("hssc") ||
    kinds.has("bachelors-degree") ||
    kinds.has("masters-degree") ||
    kinds.has("degree") ||
    kinds.has("transcript")
  ) {
    strengths.push("Documents in the vault");
  } else {
    gaps.push("Upload the checklist in your document vault");
  }

  if (kinds.has("english")) strengths.push("English document uploaded");
  else gaps.push("Upload English certificate or IELTS in the vault");

  if (p.notes.trim()) strengths.push("Extra notes saved for counselling");

  let readiness: ProfileAnalysis["readiness"] = "incomplete";
  if (p.studyLevel && p.field.trim() && (p.cgpa.trim() || docs.length > 0)) {
    readiness = gaps.length <= 2 ? "ready" : "almost";
  } else if (p.studyLevel && p.field.trim()) {
    readiness = "almost";
  }

  const headline =
    readiness === "ready"
      ? "Profile strong enough for tailored shortlist"
      : readiness === "almost"
        ? "Profile usable — fill gaps for sharper matches"
        : "Complete profile to unlock accurate top-10 suggestions";

  const summary = [
    student.name ? `${student.name}'s file` : "Student file",
    p.studyLevel ? `for ${p.studyLevel}` : "",
    p.field.trim() ? `in ${p.field.trim()}` : "",
    `— scanned ${catalogueScanned} catalogue entries.`,
  ]
    .filter(Boolean)
    .join(" ");

  return { headline, summary, strengths, gaps, readiness, catalogueScanned };
}

export async function analyzeAndMatchStudent(student: PublicStudent): Promise<MatchResult> {
  const p = student.profile;
  const city = p.cityPreference.trim().toLowerCase();
  const field = p.field.trim();
  const region = p.regionPreference;
  const notes = p.notes.trim();
  const studentCgpa = parseCgpa(p.cgpa);
  const matches: MatchRow[] = [];

  const track = programTrack(p.studyLevel);
  const scholarships = await suggestScholarships(student);

  if (track === "phd") {
    const unis = await getPhdUniversities();
    const scored = unis.map((uni) => {
      let score = 5;
      const why: string[] = ["PhD catalogue"];
      const cityHit = city && (uni.city || "").toLowerCase().includes(city);
      const regionHit = region && uni.region === region;
      const fieldHits = uni.programmes.filter(
        (prog) =>
          overlap(field, prog.field) >= 0.34 ||
          overlap(field, prog.name) >= 0.34 ||
          prog.field.toLowerCase().includes(field.toLowerCase()) ||
          prog.name.toLowerCase().includes(field.toLowerCase()),
      );
      if (cityHit) {
        score += 8;
        why.push(`city ${uni.city}`);
      }
      if (regionHit) {
        score += 6;
        why.push("preferred region");
      }
      if (field && fieldHits.length) {
        score += 12 + Math.min(6, fieldHits.length);
        why.push(`${fieldHits.length} matching course(s)`);
      } else if (field) {
        score -= 4;
      }
      if (notes && overlap(notes, `${uni.name} ${uni.englishNote || ""}`)) {
        score += 2;
        why.push("notes alignment");
      }
      if ((student.documents?.length ?? 0) >= 2) score += 2;
      return { uni, score, why, fieldHits };
    });

    scored.sort((a, b) => b.score - a.score);
    for (const row of scored.slice(0, 10)) {
      if (row.score < 5) continue;
      const sample = row.fieldHits[0]?.name;
      matches.push({
        rank: matches.length + 1,
        kind: "phd",
        title: sample ? `${sample}` : row.uni.name,
        subtitle: `${row.uni.name} · ${row.uni.city || "Italy"} · ${row.uni.programmes.length} courses`,
        href: `/phd/${row.uni.id}`,
        field: row.fieldHits[0]?.field,
        university: row.uni.name,
        region: row.uni.region,
        englishRequirement: row.uni.englishNote || undefined,
        fitScore: Math.min(99, Math.round(row.score * 4)),
        why: row.why.slice(0, 4).join(" · "),
      });
    }

    return {
      analysis: analyzeProfile(student, unis.length),
      matches,
      scholarships,
    };
  }

  const level = track === "bachelor" || track === "master" ? track : undefined;

  const programs = await getPrograms(level);
  const universities = await getUniversities();
  const byId = new Map(universities.map((u) => [u.id, u]));

  const scored = programs.map((prog) => {
    const uni = byId.get(prog.universityId);
    let score = level ? 4 : 1;
    const why: string[] = [];

    if (level) why.push(level);

    const fieldOv = Math.max(overlap(field, prog.field), overlap(field, prog.name));
    if (field && fieldOv >= 0.5) {
      score += 14;
      why.push(`strong field fit · ${prog.field}`);
    } else if (field && fieldOv >= 0.25) {
      score += 8;
      why.push(`related field · ${prog.field}`);
    } else if (
      field &&
      (prog.field.toLowerCase().includes(field.toLowerCase()) ||
        prog.name.toLowerCase().includes(field.toLowerCase()))
    ) {
      score += 12;
      why.push(`field match · ${prog.field}`);
    } else if (field) {
      score -= 2;
    }

    if (city && prog.city.toLowerCase().includes(city)) {
      score += 8;
      why.push(prog.city);
    }
    if (region && uni?.region === region) {
      score += 6;
      why.push(region);
    }

    const cg = cgpaFit(studentCgpa, uni);
    score += cg.pts;
    if (cg.note) why.push(cg.note);

    const en = englishScore(p.englishProof, uni);
    score += en.pts;
    if (en.note) why.push(en.note);

    if (notes) {
      const noteHit = overlap(notes, `${prog.name} ${prog.field} ${prog.city}`);
      if (noteHit >= 0.2) {
        score += 3;
        why.push("matches your notes");
      }
    }

    const admission = uni ? effectiveAdmissionStatus(uni) : "tba";
    if (admission === "open") {
      score += 4;
      why.push("applications open");
    } else if (admission === "soon") {
      score += 2;
      why.push("opening soon");
    }

    const docs = student.documents ?? [];
    if (
      docs.some((d) =>
        ["transcript", "degree", "bachelors-degree", "masters-degree", "hssc"].includes(d.kind),
      )
    ) {
      score += 2;
    }
    if (docs.some((d) => d.kind === "passport")) score += 1;
    if (docs.some((d) => d.kind === "english")) score += 2;

    if (prog.admissionTest) {
      score += 1;
      why.push(`test: ${prog.admissionTest}`);
    }

    return { prog, uni, score, why };
  });

  scored.sort((a, b) => b.score - a.score || a.prog.name.localeCompare(b.prog.name));

  const minScore = field || city || region || level ? 6 : 99;
  for (const row of scored) {
    if (row.score < minScore) continue;
    matches.push({
      rank: matches.length + 1,
      kind: "program",
      title: row.prog.name,
      subtitle: `${row.prog.universityName} · ${row.prog.city}`,
      href: `/universities/${row.prog.universityId}`,
      status: row.uni ? effectiveAdmissionStatus(row.uni) : undefined,
      field: row.prog.field,
      university: row.prog.universityName,
      region: row.uni?.region,
      englishRequirement: row.uni?.englishRequirement,
      fitScore: Math.min(99, Math.round(row.score * 3.2)),
      why: row.why.slice(0, 4).join(" · "),
    });
    if (matches.length >= 10) break;
  }

  return {
    analysis: analyzeProfile(student, programs.length),
    matches,
    scholarships,
  };
}

export function emptyMatchResult(student: PublicStudent): MatchResult {
  const gaps = [
    !student.profile.studyLevel ? "Study level" : "",
    !student.profile.field.trim() ? "Target field" : "",
    !student.profile.cgpa.trim() ? "CGPA or percentage" : "",
    !student.profile.englishProof.trim() ? "English proficiency (MOI or IELTS)" : "",
  ].filter(Boolean);
  return {
    analysis: {
      headline: "Shortlist is waiting",
      summary: "Add study level, target field, CGPA, and English proof before the catalogue is scanned.",
      strengths: [],
      gaps,
      readiness: "incomplete",
      catalogueScanned: 0,
    },
    matches: [],
    scholarships: [],
  };
}

export async function portalMatch(student: PublicStudent): Promise<MatchResult> {
  if (!shortlistReady(student.profile)) return emptyMatchResult(student);
  return analyzeAndMatchStudent(student);
}

/** @deprecated use analyzeAndMatchStudent */
export async function matchStudent(student: PublicStudent): Promise<MatchRow[]> {
  const result = await analyzeAndMatchStudent(student);
  return result.matches;
}
