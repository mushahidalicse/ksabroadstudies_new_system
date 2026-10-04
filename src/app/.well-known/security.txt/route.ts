import { SITE } from "@/lib/site";
import { getSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = getSiteUrl();
  const body = [
    `Contact: mailto:${SITE.email}`,
    `Contact: ${SITE.whatsappUrl}`,
    `Expires: 2027-12-31T23:59:59.000Z`,
    `Preferred-Languages: en, ur`,
    `Canonical: ${base}/.well-known/security.txt`,
    `Policy: ${base}/agreement`,
    "",
    "# Report security issues privately. Do not publicly disclose student data.",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
