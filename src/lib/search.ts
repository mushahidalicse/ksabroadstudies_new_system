import { getUniversities } from "@/lib/data";
import { effectiveAdmissionStatus } from "@/lib/admission-status";

export type SearchHit = {
  type: "university" | "program";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  level?: string;
  score: number;
};

function scoreMatch(text: string, q: string): number {
  const lower = text.toLowerCase();
  const query = q.toLowerCase();
  if (!query) return 0;
  if (lower === query) return 100;
  if (lower.startsWith(query)) return 80;
  if (lower.includes(query)) return 55;
  const words = query.split(/\s+/).filter(Boolean);
  let s = 0;
  for (const w of words) {
    if (lower.includes(w)) s += 18;
  }
  return s;
}

export async function searchCatalogue(q: string, limit = 20): Promise<SearchHit[]> {
  const query = q.trim();
  if (!query) return [];

  const universities = await getUniversities();
  const hits: SearchHit[] = [];

  for (const uni of universities) {
    const uniScore = Math.max(
      scoreMatch(uni.name, query),
      scoreMatch(uni.city, query),
      scoreMatch(uni.region, query),
      scoreMatch(uni.id, query),
    );
    if (uniScore > 0) {
      hits.push({
        type: "university",
        id: uni.id,
        title: uni.name,
        subtitle: `${uni.city} · ${uni.region} · ${effectiveAdmissionStatus(uni)}`,
        href: `/universities/${uni.id}`,
        score: uniScore,
      });
    }

    for (const program of uni.programs) {
      const programScore = Math.max(
        scoreMatch(program.name, query),
        scoreMatch(program.field, query),
        scoreMatch(program.admissionTest ?? "", query),
      );
      if (programScore > 0) {
        hits.push({
          type: "program",
          id: `${uni.id}:${program.name}`,
          title: program.name,
          subtitle: `${uni.name} · ${program.level}${program.field ? ` · ${program.field}` : ""}`,
          href: `/universities/${uni.id}`,
          level: program.level,
          score: programScore,
        });
      }
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
