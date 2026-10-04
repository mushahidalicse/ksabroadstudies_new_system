export const PLACEHOLDER_KEYS = [
  "student_name",
  "programme_name",
  "university_name",
  "deadline",
  "case_officer",
] as const;

export type PlaceholderKey = (typeof PLACEHOLDER_KEYS)[number];

export function fillTemplate(text: string, values: Partial<Record<PlaceholderKey, string>>) {
  const missing: string[] = [];
  const filled = text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    if (!(PLACEHOLDER_KEYS as readonly string[]).includes(key)) {
      missing.push(key);
      return "";
    }
    const value = (values[key as PlaceholderKey] ?? "").trim();
    if (!value) {
      missing.push(key);
      return "";
    }
    return value;
  });
  return { text: filled, missing: [...new Set(missing)] };
}
