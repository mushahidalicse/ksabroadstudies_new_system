import { buildResearchPrompt, extractJson } from "@/lib/research/research-programme";
import type { ResearchSubject } from "@/lib/research/research-schema";

function messageText(body: unknown) {
  const output = body && typeof body === "object" && Array.isArray((body as { output?: unknown }).output)
    ? (body as { output: Array<Record<string, unknown>> }).output
    : [];
  const chunks: string[] = [];
  for (const item of output) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
        chunks.push((part as { text: string }).text);
      }
    }
  }
  return chunks.join("\n");
}

export async function grokResearch(subject: ResearchSubject) {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) throw new Error("XAI_API_KEY is not configured. Research was not sent.");
  const model = process.env.XAI_MODEL?.trim() || "grok-4.5";
  const response = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content: buildResearchPrompt(subject) }],
      tools: [{ type: "web_search" }],
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) {
    throw new Error(`Grok research failed (${response.status}). The catalogue was not changed.`);
  }
  const body = await response.json();
  const parsed = extractJson(messageText(body));
  if (!parsed) throw new Error("Grok did not return structured JSON. No finding was saved as verified.");
  return parsed;
}
