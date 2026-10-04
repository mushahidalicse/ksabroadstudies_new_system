import { absoluteUrl, SITE_DESCRIPTION } from "@/lib/seo";
import { SITE } from "@/lib/site";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "EducationalOrganization"],
    "@id": absoluteUrl("/#organization"),
    name: SITE.name,
    legalName: SITE.legalName,
    url: absoluteUrl("/"),
    logo: absoluteUrl(SITE.logoSrc),
    image: absoluteUrl(SITE.logoSrc),
    description: SITE_DESCRIPTION,
    email: SITE.email,
    telephone: SITE.whatsappDisplay,
    foundingDate: "2023-10-11",
    identifier: {
      "@type": "PropertyValue",
      name: "SECP CUIN",
      value: SITE.cuin,
    },
    address: {
      "@type": "PostalAddress",
      streetAddress:
        "A-301, Wonder Towers, Gulshan-e-Iqbal Block 11, Karachi, Gulshan Town, Karachi East",
      addressLocality: "Karachi",
      addressRegion: "Sindh",
      addressCountry: "PK",
    },
    areaServed: [
      { "@type": "Country", name: "Pakistan" },
      { "@type": "Country", name: "Italy" },
    ],
    sameAs: [
      SITE.linkedinCompanyUrl,
      SITE.instagramCompanyUrl,
      SITE.whatsappChannelUrl,
      SITE.linktreeUrl,
      SITE.youtubeUrl,
      SITE.tiktokUrl,
      SITE.threadsUrl,
      SITE.facebookUrl,
      SITE.linkedinPersonalUrl,
      SITE.instagramPersonalUrl,
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: SITE.email,
        telephone: SITE.whatsappDisplay,
        availableLanguage: ["English", "Urdu"],
        url: absoluteUrl("/contact"),
      },
    ],
    founder: {
      "@type": "Person",
      name: SITE.founder,
      url: SITE.linkedinPersonalUrl,
      sameAs: [
        SITE.instagramPersonalUrl,
        SITE.youtubeUrl,
        SITE.tiktokUrl,
        SITE.threadsUrl,
        SITE.facebookUrl,
      ],
    },
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: SITE.name,
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    inLanguage: "en",
    publisher: { "@id": absoluteUrl("/#organization") },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/api/v1/search?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function siteGraphJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [organizationJsonLd(), websiteJsonLd()],
  };
}

export function universityJsonLd(uni: {
  id: string;
  name: string;
  city: string;
  region: string;
  website?: string;
  admissionPortal?: string;
  programs: Array<{ name: string; level: string }>;
}) {
  const sameAs = [uni.website, uni.admissionPortal].filter(Boolean) as string[];
  return {
    "@context": "https://schema.org",
    "@type": "CollegeOrUniversity",
    "@id": absoluteUrl(`/universities/${uni.id}#college`),
    name: uni.name,
    url: absoluteUrl(`/universities/${uni.id}`),
    address: {
      "@type": "PostalAddress",
      addressLocality: uni.city,
      addressRegion: uni.region,
      addressCountry: "IT",
    },
    ...(sameAs.length ? { sameAs } : {}),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: `English programmes at ${uni.name}`,
      numberOfItems: uni.programs.length,
      itemListElement: uni.programs.slice(0, 40).map((p, i) => ({
        "@type": "Offer",
        position: i + 1,
        itemOffered: {
          "@type": "Course",
          name: p.name,
          educationalLevel: p.level,
          provider: { "@id": absoluteUrl(`/universities/${uni.id}#college`) },
        },
      })),
    },
    provider: { "@id": absoluteUrl("/#organization") },
  };
}

export function scholarshipJsonLd(region: {
  id: string;
  region: string;
  agencyName: string;
  portalUrl?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "GovernmentService",
    name: `${region.region} regional scholarship (DSU)`,
    url: absoluteUrl(`/scholarships/${region.id}`),
    description: `${region.agencyName} regional right-to-study benefits for students in ${region.region}, Italy.`,
    provider: {
      "@type": "GovernmentOrganization",
      name: region.agencyName,
      ...(region.portalUrl ? { url: region.portalUrl } : {}),
    },
    areaServed: {
      "@type": "AdministrativeArea",
      name: region.region,
      containedInPlace: { "@type": "Country", name: "Italy" },
    },
    audience: {
      "@type": "EducationalAudience",
      educationalRole: "student",
    },
    broker: { "@id": absoluteUrl("/#organization") },
  };
}

export function phdUniversityJsonLd(uni: {
  id: string;
  name: string;
  city?: string;
  programmes?: Array<{ name: string }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollegeOrUniversity",
    "@id": absoluteUrl(`/phd/${uni.id}#phd`),
    name: uni.name,
    url: absoluteUrl(`/phd/${uni.id}`),
    ...(uni.city
      ? {
          address: {
            "@type": "PostalAddress",
            addressLocality: uni.city,
            addressCountry: "IT",
          },
        }
      : {}),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: `PhD / Dottorato programmes at ${uni.name}`,
      numberOfItems: uni.programmes?.length ?? 0,
      itemListElement: (uni.programmes ?? []).slice(0, 40).map((p, i) => ({
        "@type": "Offer",
        position: i + 1,
        itemOffered: {
          "@type": "Course",
          name: p.name,
          educationalLevel: "doctoral",
        },
      })),
    },
    provider: { "@id": absoluteUrl("/#organization") },
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqJsonLd(
  faqs: Array<{ question: string; answer: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };
}
