import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { CookieNotice } from "@/components/cookie-notice";
import { KsBuddy } from "@/components/ai-bot";
import { JsonLd } from "@/components/json-ld";
import { PwaRegister } from "@/components/pwa-register";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { DEFAULT_OG, getSiteUrl, SITE_DESCRIPTION } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { siteGraphJsonLd } from "@/lib/structured-data";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const siteUrl = getSiteUrl();

export const viewport: Viewport = {
  themeColor: "#0f6a6f",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE.name} | Study in Italy`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE.name,
  authors: [{ name: SITE.founder }, { name: SITE.legalName }],
  creator: SITE.founder,
  publisher: SITE.legalName,
  keywords: [
    "study in Italy",
    "Pakistan students Italy",
    "English programmes Italy",
    "Universitaly",
    "DSU scholarship",
    "IMAT",
    "CEnT-S",
    "study visa Italy",
    "KS Abroad Studies",
    "KS Buddy",
  ],
  category: "education",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/ks-abroad-logo.png", type: "image/png" }],
    apple: [{ url: "/ks-abroad-logo.png" }],
    shortcut: ["/ks-abroad-logo.png"],
  },
  appleWebApp: {
    capable: true,
    title: "KS Abroad",
    statusBarStyle: "default",
  },
  alternates: {
    canonical: "/",
    types: {
      "application/xml": [{ url: "/sitemap.xml", title: "Sitemap" }],
      "text/plain": [
        { url: "/llms.txt", title: "LLM index" },
        { url: "/llms-full.txt", title: "LLM full catalogue" },
      ],
      "application/json": [{ url: "/api/v1/openapi", title: "OpenAPI" }],
    },
  },
  openGraph: {
    type: "website",
    locale: "en_PK",
    url: siteUrl,
    siteName: SITE.name,
    title: DEFAULT_OG.title,
    description: DEFAULT_OG.description,
    images: [...DEFAULT_OG.images],
  },
  twitter: {
    card: "summary",
    title: DEFAULT_OG.title,
    description: DEFAULT_OG.description,
    images: [SITE.logoSrc],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  other: {
    "ai-content": "KS Abroad Studies publishes structured education guidance for Pakistani students applying to Italy. Primary AI context: /llms.txt",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full`}
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject body attrs */}
      <body className="min-h-full flex flex-col antialiased" suppressHydrationWarning>
        <JsonLd data={siteGraphJsonLd()} />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <KsBuddy />
        <CookieNotice />
        <PwaRegister />
      </body>
    </html>
  );
}
