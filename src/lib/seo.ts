import { SITE } from "@/lib/site";

/** Canonical public origin. Set NEXT_PUBLIC_SITE_URL in production. */
export function getSiteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const vercel = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;
  return "http://localhost:43127";
}

export function absoluteUrl(path = "/") {
  const base = getSiteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export const SITE_DESCRIPTION =
  "Pakistan-based study abroad consultancy for Italy: public universities, English programmes, admission portals, deadlines, regional scholarships, visa guidance, and AI student matching.";

export const STATIC_SITEMAP_PATHS: Array<{
  path: string;
  changeFrequency:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/study-in-italy", changeFrequency: "monthly", priority: 0.95 },
  { path: "/universities", changeFrequency: "daily", priority: 0.95 },
  { path: "/programs", changeFrequency: "weekly", priority: 0.9 },
  { path: "/programs/find", changeFrequency: "weekly", priority: 0.92 },
  { path: "/programs/master", changeFrequency: "weekly", priority: 0.9 },
  { path: "/programs/bachelor", changeFrequency: "weekly", priority: 0.9 },
  { path: "/programs/single-cycle", changeFrequency: "weekly", priority: 0.9 },
  { path: "/programs/english", changeFrequency: "weekly", priority: 0.85 },
  { path: "/phd", changeFrequency: "weekly", priority: 0.85 },
  { path: "/scholarships", changeFrequency: "weekly", priority: 0.9 },
  { path: "/erasmus", changeFrequency: "monthly", priority: 0.8 },
  { path: "/guides", changeFrequency: "monthly", priority: 0.85 },
  { path: "/guides/documents", changeFrequency: "monthly", priority: 0.75 },
  { path: "/guides/translations", changeFrequency: "monthly", priority: 0.75 },
  { path: "/guides/motivation-letter", changeFrequency: "monthly", priority: 0.75 },
  { path: "/guides/dov", changeFrequency: "monthly", priority: 0.8 },
  { path: "/guides/visa", changeFrequency: "monthly", priority: 0.85 },
  { path: "/guides/scholarship-docs", changeFrequency: "monthly", priority: 0.75 },
  { path: "/process", changeFrequency: "monthly", priority: 0.8 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.85 },
  { path: "/about", changeFrequency: "yearly", priority: 0.6 },
  { path: "/agreement", changeFrequency: "yearly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.7 },
  { path: "/cookies", changeFrequency: "yearly", priority: 0.5 },
];

export const DEFAULT_OG = {
  title: `${SITE.name} | Study in Italy`,
  description: SITE_DESCRIPTION,
  images: [
    {
      url: "/ks-abroad-logo.png",
      width: 512,
      height: 512,
      alt: SITE.name,
    },
  ],
} as const;
