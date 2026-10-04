import { getMeta } from "@/lib/data";
import { searchCatalogue } from "@/lib/search";
import { SITE } from "@/lib/site";

const FAQ = [
  {
    keywords: ["visa", "universitaly", "pre-enrol", "pre enroll", "deadline"],
    en: "Universitaly pre-enrolment for non-EU students is due 30 November 2026. Always confirm embassy and university steps on our Visa guide.",
    ur: "Non-EU students ke liye Universitaly pre-enrolment ki last date 30 November 2026 hai. Embassy aur university steps ke liye hamari Visa guide dekhein.",
  },
  {
    keywords: ["whatsapp", "contact", "phone", "call"],
    en: `WhatsApp KS Abroad at ${SITE.whatsappDisplay} or email ${SITE.email}.`,
    ur: `KS Abroad se WhatsApp par rabta karein: ${SITE.whatsappDisplay}. Email: ${SITE.email}.`,
  },
  {
    keywords: ["portal", "register", "login", "account"],
    en: "Create a free account at /register, then open /portal for profile, documents, and your Top 10 programme shortlist.",
    ur: "Free account /register par banayein, phir /portal par profile, documents aur Top 10 shortlist dekhein.",
  },
  {
    keywords: ["ielts", "english", "moi", "language"],
    en: "Most English programmes accept IELTS ~6.0–6.5 or a Medium of Instruction letter — check each university row on our site.",
    ur: "Zada tar English programmes IELTS 6.0–6.5 ya MOI letter leti hain — har university ki detail site par dekhein.",
  },
  {
    keywords: ["scholarship", "dsu", "erasmus"],
    en: "Regional DSU scholarships and Erasmus guides are under /scholarships and /erasmus. Eligibility depends on ISEE and region.",
    ur: "Regional DSU scholarships aur Erasmus ke liye /scholarships aur /erasmus dekhein. Eligibility region aur ISEE par depend karti hai.",
  },
  {
    keywords: ["imat", "medicine", "mbbs"],
    en: "Medicine / single-cycle uses IMAT. See /programs/single-cycle for programmes and the IMAT guide.",
    ur: "Medicine / single-cycle ke liye IMAT hota hai. Programmes aur guide /programs/single-cycle par hai.",
  },
  {
    keywords: ["cent-s", "bachelor", "engineering"],
    en: "Many English bachelors use CISIA CEnT-S. Full guide on /programs/bachelor.",
    ur: "Kai English bachelors CISIA CEnT-S use karte hain. Poori guide /programs/bachelor par hai.",
  },
];

function pickLang(message: string, preferred?: "en" | "ur"): "en" | "ur" {
  if (preferred === "en" || preferred === "ur") return preferred;
  const urduHints =
    /[\u0600-\u06FF]|kya|kaise|kitna|scholarship|visa|madad|bata|salam|shukriya|program/i;
  return urduHints.test(message) ? "ur" : "en";
}

function faqAnswer(message: string, lang: "en" | "ur") {
  const lower = message.toLowerCase();
  for (const row of FAQ) {
    if (row.keywords.some((k) => lower.includes(k))) {
      return lang === "ur" ? row.ur : row.en;
    }
  }
  return null;
}

export async function buildBotContext(message: string) {
  const meta = await getMeta();
  const hits = await searchCatalogue(message, 5);
  const catalogueLines = hits.map(
    (h) => `- ${h.title} (${h.subtitle}) → ${h.href}`,
  );
  return [
    `Site: ${SITE.name} — Italy study consultancy for Pakistan students.`,
    `WhatsApp: ${SITE.whatsappDisplay}. Email: ${SITE.email}.`,
    `Intake: ${meta.intake}. Universities: ${meta.universityCount}. Programmes: ${meta.programCount}.`,
    `Universitaly pre-enrolment deadline: 30 November 2026 (do not invent other dates).`,
    catalogueLines.length ? `Catalogue matches:\n${catalogueLines.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function mockBotReply(message: string, langPref?: "en" | "ur") {
  const lang = pickLang(message, langPref);
  const faq = faqAnswer(message, lang);
  if (faq) return { reply: faq, lang, mock: true as const };

  const hits = await searchCatalogue(message, 3);
  if (hits.length) {
    const list = hits.map((h) => `• ${h.title} — ${h.subtitle}`).join("\n");
    const reply =
      lang === "ur"
        ? `Hamari list se yeh matches mile:\n${list}\n\nDetail ke liye portal banayein ya WhatsApp karein.`
        : `From our catalogue:\n${list}\n\nOpen a link for details or register at /portal for a personalised Top 10.`;
    return { reply, lang, mock: true as const };
  }

  const fallback =
    lang === "ur"
      ? `Main KS Abroad ka assistant hoon. Visa deadline 30 Nov 2026, programmes, scholarships ya portal ke bare mein pooch sakte hain. WhatsApp: ${SITE.whatsappDisplay}.`
      : `I'm the KS Abroad assistant. Ask about visa (deadline 30 Nov 2026), programmes, scholarships, IELTS, or the student portal. WhatsApp: ${SITE.whatsappDisplay}.`;

  return { reply: fallback, lang, mock: true as const };
}

export async function openAiBotReply(
  message: string,
  langPref: "en" | "ur" | undefined,
  context: string,
) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const lang = pickLang(message, langPref);
  const model = process.env.OPENAI_BUDDY_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const system = [
    "You are KS Buddy, the KS Abroad Studies assistant for Pakistani students applying to Italy.",
    `Answer in ${lang === "ur" ? "Roman Urdu" : "English"}.`,
    "Use ONLY the provided context. Never invent deadlines or fees.",
    "If unsure, suggest WhatsApp or the contact page.",
    "Keep answers under 120 words.",
    "",
    "Context:",
    context,
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: message.slice(0, 800) },
      ],
    }),
  });

  if (!res.ok) {
    console.error("openai bot failed", res.status, await res.text().catch(() => ""));
    return null;
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const reply = json.choices?.[0]?.message?.content?.trim();
  if (!reply) return null;
  return { reply, lang, mock: false as const };
}
