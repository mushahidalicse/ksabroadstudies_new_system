/** How this catalogue describes English proof. Not a live university rule. */
export type EnglishFilter = "all" | "moi" | "ielts";

export function englishBand(text: string | undefined): "moi" | "ielts" | "unknown" {
  const note = (text || "").toLowerCase();
  if (!note) return "unknown";
  const rejected = /moi not accepted|moi rejected/.test(note);
  const accepted =
    /moi accepted|moi letter accepted|moi exemption|native\/moi/.test(note);
  if (accepted && !rejected) return "moi";
  if (/ielts|toefl/.test(note) || rejected) return "ielts";
  return "unknown";
}
