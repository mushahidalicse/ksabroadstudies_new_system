import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  const privatePaths = [
    "/admin",
    "/portal",
    "/login",
    "/register",
    "/api/contact",
    "/api/admin",
    "/api/auth",
    "/api/portal",
    "/api/bot",
    "/api/notify",
  ];

  const publicApi = [
    "/api/v1",
    "/api/v1/openapi",
    "/api/v1/search",
    "/api/v1/universities",
    "/api/v1/programs",
  ];

  const aiAgents = [
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "ClaudeBot",
    "anthropic-ai",
    "Google-Extended",
    "GoogleOther",
    "PerplexityBot",
    "Applebot-Extended",
    "Bytespider",
    "CCBot",
    "meta-externalagent",
    "FacebookBot",
    "cohere-ai",
    "Diffbot",
    "YouBot",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/llms.txt", "/llms-full.txt", "/sitemap.xml", ...publicApi],
        disallow: privatePaths,
      },
      {
        userAgent: aiAgents,
        allow: ["/", "/llms.txt", "/llms-full.txt", "/sitemap.xml", ...publicApi],
        disallow: privatePaths,
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: new URL(base).host,
  };
}
