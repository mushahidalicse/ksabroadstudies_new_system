import type { MetadataRoute } from "next";
import { getCatalogue, getUniversities } from "@/lib/data";
import { getPhdUniversities } from "@/lib/phd";
import { getScholarshipRegions } from "@/lib/scholarships";
import { absoluteUrl, getSiteUrl, STATIC_SITEMAP_PATHS } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [universities, programmes, phdUnis, regions] = await Promise.all([
    getUniversities(),
    getCatalogue(),
    getPhdUniversities(),
    getScholarshipRegions(),
  ]);

  const staticEntries: MetadataRoute.Sitemap = STATIC_SITEMAP_PATHS.map(
    (row) => ({
      url: absoluteUrl(row.path),
      lastModified: now,
      changeFrequency: row.changeFrequency,
      priority: row.priority,
    }),
  );

  const universityEntries: MetadataRoute.Sitemap = universities.map((u) => ({
    url: absoluteUrl(`/universities/${u.id}`),
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const phdEntries: MetadataRoute.Sitemap = phdUnis.map((u) => ({
    url: absoluteUrl(`/phd/${u.id}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const scholarshipEntries: MetadataRoute.Sitemap = regions.map((r) => ({
    url: absoluteUrl(`/scholarships/${r.id}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.75,
  }));

  // Discovery surfaces for AI crawlers (also listed in robots / llms.txt)
  const aiSurfaces: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/llms.txt"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/llms-full.txt"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.65,
    },
    {
      url: `${getSiteUrl()}/api/v1/openapi`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const programmeEntries: MetadataRoute.Sitemap = programmes.map((programme) => ({
    url: absoluteUrl(`/programs/p/${programme.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.55,
  }));

  return [
    ...staticEntries,
    ...universityEntries,
    ...programmeEntries,
    ...phdEntries,
    ...scholarshipEntries,
    ...aiSurfaces,
  ];
}
