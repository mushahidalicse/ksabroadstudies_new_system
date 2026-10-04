export type CatalogLevel = "bachelor" | "master" | "single-cycle" | "phd";

const ENTRY_CUE = /possesso\s+di|in\s+possesso\s+di|titolo\s+di\s+accesso|titolo\s+precedente|laurea\s+conseguita|candidati\s+con|applicants?\s+holding|previous\s+degree|prior\s+qualification|eligible\s+qualifications|degree\s+required\s+for\s+admission|titolo\s+di\s+laurea\s+di\s+primo\s+livello|first-cycle\s+degree|conseguit[oa]\s+(?:in\s+italia|all['’]estero)|obtained\s+(?:in\s+italy|abroad)|accessing\s+the\s+programmes?\s+with/gi;

const SINGLE_CYCLE = /laurea\s+magistrale\s+a\s+ciclo\s+unico|\bsingle[-\s]cycle(?:\s+master(?:'s)?)?(?:\s+(?:degree|programme|program))?\b/i;
const MASTER_PHRASE = /laurea\s+magistrale(?!\s+a\s+ciclo\s+unico)|\bmaster(?:'s)?\b/i;
const PHD_PHRASE = /\b(?:dottorato|phd)\b/i;
const LM_CLASS = /\bLM-\d{1,3}\b/i;
const L_CLASS = /\bL-\d{1,3}\b/i;

export function maskEntryQualifications(value: string) {
  const text = value.replace(/\((?:[^()]{0,400})\)/g, (group) => (
    /ciclo\s+unico|single[-\s]cycle|triennale|bachelor|magistrale|dottorato|\bphd\b/i.test(group)
    && /,|\/|\bo\b|\bor\b|equivalente|equivalent/i.test(group)
      ? " "
      : group
  ));
  const ranges: Array<[number, number]> = [];
  for (const match of text.matchAll(ENTRY_CUE)) {
    if (match.index == null) continue;
    const tail = text.slice(match.index, match.index + 280);
    const stop = tail.search(/[.]/);
    ranges.push([match.index, match.index + (stop >= 0 ? stop + 1 : Math.min(tail.length, 220))]);
  }
  if (!ranges.length) return text;
  let cursor = 0;
  let out = "";
  for (const [start, end] of ranges) {
    if (end <= cursor) continue;
    out += text.slice(cursor, start);
    out += " ";
    cursor = end;
  }
  return out + text.slice(cursor);
}

function windowsAround(text: string, programmeName?: string) {
  const needle = programmeName?.trim().toLowerCase() ?? "";
  if (needle.length < 4) return "";
  const hay = text.toLowerCase();
  let blob = "";
  let from = 0;
  while (from < hay.length) {
    const at = hay.indexOf(needle, from);
    if (at < 0) break;
    blob += `\n${text.slice(Math.max(0, at - 220), Math.min(text.length, at + needle.length + 220))}`;
    from = at + needle.length;
  }
  return blob.trim();
}

function bestLevel(signals: Array<{ level: CatalogLevel; weight: number }>) {
  signals.sort((left, right) => right.weight - left.weight);
  return signals[0]?.level ?? null;
}

export function detectTargetDegreeLevel(value: string, programmeName?: string): CatalogLevel | null {
  const masked = maskEntryQualifications(value.replace(/https?:\/\/\S+/gi, " "));
  const heading = (masked.split("\n")[0] ?? "").slice(0, 240);
  const window = windowsAround(masked, programmeName);
  const focus = window ? `${heading}\n${window}` : masked;
  const signals: Array<{ level: CatalogLevel; weight: number }> = [];
  const add = (level: CatalogLevel, weight: number, when: boolean) => {
    if (when) signals.push({ level, weight });
  };
  add("single-cycle", 100, SINGLE_CYCLE.test(focus));
  add("master", 96, LM_CLASS.test(focus) && !SINGLE_CYCLE.test(focus));
  add("phd", 88, PHD_PHRASE.test(heading) && !LM_CLASS.test(heading) && !MASTER_PHRASE.test(heading) && !SINGLE_CYCLE.test(heading));
  add("bachelor", 92, L_CLASS.test(focus) && !LM_CLASS.test(focus) && !SINGLE_CYCLE.test(focus) && !MASTER_PHRASE.test(focus));
  add("master", 74, MASTER_PHRASE.test(focus) && !SINGLE_CYCLE.test(focus));
  add("bachelor", 70, /laurea\s+triennale|\bbachelor\b|\bfirst\s+cycle\b/i.test(focus) && !MASTER_PHRASE.test(focus) && !LM_CLASS.test(focus) && !SINGLE_CYCLE.test(focus));
  add("bachelor", 58, /\blaurea\b/i.test(focus) && !MASTER_PHRASE.test(focus) && !LM_CLASS.test(focus) && !SINGLE_CYCLE.test(focus));
  add("phd", 46, PHD_PHRASE.test(focus) && !LM_CLASS.test(focus) && !MASTER_PHRASE.test(focus) && !SINGLE_CYCLE.test(focus));
  add("single-cycle", 84, /\bciclo\s+unico\b|\bsingle[-\s]cycle\b/i.test(focus) && !LM_CLASS.test(focus) && !MASTER_PHRASE.test(focus));
  return bestLevel(signals);
}

export function degreeClassNearTarget(value: string, programmeName?: string) {
  const masked = maskEntryQualifications(value.replace(/https?:\/\/\S+/gi, " "));
  const classes = [...masked.matchAll(/\b((?:LM|L)-\d{1,3})\b/gi)].map((match) => ({
    code: match[1].toUpperCase(),
    index: match.index ?? 0,
  }));
  if (!classes.length) return null;
  const needle = programmeName?.trim().toLowerCase() ?? "";
  const at = needle.length >= 4 ? masked.toLowerCase().indexOf(needle) : -1;
  if (at >= 0) {
    const nearest = classes.reduce((best, item) => Math.abs(item.index - at) < Math.abs(best.index - at) ? item : best);
    return Math.abs(nearest.index - at) <= 800 ? nearest.code : null;
  }
  return classes.length === 1 ? classes[0].code : null;
}
