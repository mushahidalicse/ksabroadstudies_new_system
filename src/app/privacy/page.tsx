import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import { CONSENT_POLICY_VERSION } from "@/lib/student-types";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How KS Abroad Studies collects, uses, stores, and deletes student personal data — with consent.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="site-shell py-12 md:py-16 max-w-3xl">
      <p className="eyebrow">Legal · Policy version {CONSENT_POLICY_VERSION}</p>
      <h1 className="display mt-3 text-4xl md:text-6xl">Privacy Policy</h1>
      <p className="mt-4 text-[var(--ink-soft)] leading-relaxed">
        {SITE.legalName} (&quot;{SITE.name}&quot;, &quot;we&quot;) processes personal data only
        with your clear consent, to provide study-abroad information and portal
        services for applications to Italy. This notice is designed to meet
        common requirements under GDPR (EU/EEA/UK), Pakistan&apos;s emerging data
        protection expectations, and similar consent-based regimes worldwide.
      </p>

      <section className="mt-10 space-y-3 text-sm leading-relaxed text-[var(--ink-soft)]">
        <h2 className="display text-2xl text-[var(--ink)]">1. Who we are</h2>
        <p>
          Controller: {SITE.legalName} (SECP CUIN {SITE.cuin}). Contact:{" "}
          <a className="font-semibold text-[var(--sea-deep)] hover:underline" href={SITE.emailUrl}>
            {SITE.email}
          </a>{" "}
          · WhatsApp {SITE.whatsappDisplay}.
        </p>

        <h2 className="display text-2xl text-[var(--ink)] pt-4">2. Data we collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Identity & contact: name, email, phone/WhatsApp</li>
          <li>Account security: password hash (we never store plain passwords)</li>
          <li>Study profile: preferred level, field, CGPA, English proof, region/city</li>
          <li>Documents you upload (passport, transcripts, etc.)</li>
          <li>Consent records: policy version, timestamps, IP/user-agent at acceptance</li>
          <li>Technical logs needed for security (rate limits, abuse prevention)</li>
        </ul>

        <h2 className="display text-2xl text-[var(--ink)] pt-4">3. Lawful basis</h2>
        <p>
          Primary basis: <strong className="text-[var(--ink)]">consent</strong>. You
          tick Privacy + Terms on registration (and contact form where shown). You may
          withdraw consent and request deletion at any time. Separate optional consent
          covers marketing/WhatsApp updates.
        </p>

        <h2 className="display text-2xl text-[var(--ink)] pt-4">4. Why we use data</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Create and secure your student portal account</li>
          <li>Match programmes and guide admissions/visa steps</li>
          <li>Respond to contact or consultancy requests</li>
          <li>Improve service security and prevent fraud/abuse</li>
        </ul>
        <p>We do not sell personal data.</p>

        <h2 className="display text-2xl text-[var(--ink)] pt-4">5. Sharing</h2>
        <p>
          We share data only as needed: email delivery providers you configure,
          universities/consulates when you ask us to assist an application, or when
          law requires. Processors must protect data appropriately.
        </p>

        <h2 className="display text-2xl text-[var(--ink)] pt-4">6. Storage & security</h2>
        <p>
          Data is stored in secured server-side stores (not public website files).
          Access is limited to authenticated sessions and admin controls. Use strong
          passwords. No method is 100% risk-free; report issues via{" "}
          <Link href="/.well-known/security.txt" className="font-semibold text-[var(--sea-deep)] hover:underline">
            security.txt
          </Link>
          .
        </p>

        <h2 className="display text-2xl text-[var(--ink)] pt-4">7. Retention</h2>
        <p>
          We keep account and document data while your account is active and for a
          reasonable period afterward if needed for legal claims or your reopen
          request. You may request earlier deletion.
        </p>

        <h2 className="display text-2xl text-[var(--ink)] pt-4">8. Your rights</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Access / export your data (portal or email request)</li>
          <li>Correct inaccurate data</li>
          <li>Delete your account and uploads</li>
          <li>Withdraw consent / opt out of marketing</li>
          <li>Lodge a complaint with a supervisory authority where applicable</li>
        </ul>
        <p>
          In-portal: use Privacy controls, or email {SITE.email} with subject
          &quot;Data request&quot;.
        </p>

        <h2 className="display text-2xl text-[var(--ink)] pt-4">9. Cookies</h2>
        <p>
          Essential cookies only by default (signed session for login). We do not use
          advertising trackers. See{" "}
          <Link href="/cookies" className="font-semibold text-[var(--sea-deep)] hover:underline">
            Cookie notice
          </Link>
          .
        </p>

        <h2 className="display text-2xl text-[var(--ink)] pt-4">10. Children</h2>
        <p>
          Services are intended for students who can form a contract under applicable
          law (typically 18+). If you are a minor, a parent/guardian must consent.
        </p>

        <h2 className="display text-2xl text-[var(--ink)] pt-4">11. International transfers</h2>
        <p>
          Servers and tools may process data outside your country. We rely on your
          consent and appropriate safeguards when transferring data internationally.
        </p>

        <h2 className="display text-2xl text-[var(--ink)] pt-4">12. Changes</h2>
        <p>
          We may update this policy; the version label above changes when material
          updates require fresh consent.
        </p>

        <p className="pt-6">
          Related:{" "}
          <Link href="/agreement" className="font-semibold text-[var(--sea-deep)] hover:underline">
            Consultancy agreement
          </Link>{" "}
          ·{" "}
          <Link href="/contact" className="font-semibold text-[var(--sea-deep)] hover:underline">
            Contact
          </Link>
        </p>
      </section>
    </div>
  );
}
