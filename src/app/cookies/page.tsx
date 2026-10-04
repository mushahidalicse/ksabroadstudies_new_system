import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cookie notice",
  description: "How KS Abroad Studies uses cookies — essential session cookies only by default.",
};

export default function CookiesPage() {
  return (
    <div className="site-shell py-12 md:py-16 max-w-3xl">
      <p className="eyebrow">Legal</p>
      <h1 className="display mt-3 text-4xl md:text-6xl">Cookie notice</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-[var(--ink-soft)]">
        <p>
          {SITE.name} uses cookies that are strictly necessary to run the student
          portal (signed httpOnly session cookie after you log in). These are not used
          for advertising.
        </p>
        <p>
          Optional preference cookie (<code className="text-[var(--ink)]">ks_cookie_ack</code>)
          remembers that you acknowledged this notice so we do not show it on every visit.
        </p>
        <p>
          You can clear cookies in your browser at any time. Logging out clears the
          session cookie. Full details:{" "}
          <Link href="/privacy" className="font-semibold text-[var(--sea-deep)] hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
