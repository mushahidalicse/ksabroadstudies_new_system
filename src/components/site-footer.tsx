import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { SocialLinks } from "@/components/social-links";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--line)] bg-[rgba(16,36,51,0.04)]">
      <div className="site-shell py-12 grid gap-10 lg:grid-cols-[1.3fr_0.9fr_1.1fr]">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <BrandLogo size={56} />
            <div>
              <div className="display text-2xl leading-none">{SITE.name}</div>
              <div className="mt-1 text-xs font-semibold text-[var(--coral)]">
                {SITE.tagline}
              </div>
            </div>
          </div>
          <p className="text-[var(--ink-soft)] max-w-md leading-relaxed">
            Founded by {SITE.founder}. An informative Study in Italy hub for
            Pakistani students — universities, English programmes, portals,
            deadlines, and visa steps. Priority focus: Lazio and South Italy.
          </p>
        </div>
        <div className="space-y-2 text-sm font-semibold">
          <div className="eyebrow mb-3">Explore</div>
          <Link href="/programs/find" className="block hover:text-[var(--sea)]">
            Find My Programme
          </Link>
          <Link href="/programs/shortlist" className="block hover:text-[var(--sea)]">
            My Shortlist
          </Link>
          <Link href="/universities" className="block hover:text-[var(--sea)]">
            Universities
          </Link>
          <Link href="/programs/master" className="block hover:text-[var(--sea)]">
            Master&apos;s in English
          </Link>
          <Link href="/programs/bachelor" className="block hover:text-[var(--sea)]">
            Bachelor&apos;s + CEnT-S
          </Link>
          <Link href="/programs/single-cycle" className="block hover:text-[var(--sea)]">
            Single-cycle (Medicine) + IMAT
          </Link>
          <Link href="/phd" className="block hover:text-[var(--sea)]">
            PhD / Dottorato
          </Link>
          <Link href="/guides" className="block hover:text-[var(--sea)]">
            Guides
          </Link>
          <Link href="/guides/dov" className="block hover:text-[var(--sea)]">
            DOV & CIMEA
          </Link>
          <Link href="/guides/visa" className="block hover:text-[var(--sea)]">
            Visa guide
          </Link>
          <Link href="/scholarships" className="block hover:text-[var(--sea)]">
            Regional scholarships
          </Link>
          <Link href="/erasmus" className="block hover:text-[var(--sea)]">
            Erasmus Mundus 2027
          </Link>
          <Link href="/process" className="block hover:text-[var(--sea)]">
            Full process · tests
          </Link>
          <Link href="/about" className="block hover:text-[var(--sea)]">
            Company registration
          </Link>
          <Link href="/agreement" className="block hover:text-[var(--sea)]">
            Consultancy agreement
          </Link>
          <Link href="/privacy" className="block hover:text-[var(--sea)]">
            Privacy Policy
          </Link>
          <Link href="/cookies" className="block hover:text-[var(--sea)]">
            Cookie notice
          </Link>
          <Link href="/contact" className="block hover:text-[var(--sea)]">
            Contact Us
          </Link>
        </div>
        <div className="space-y-5 text-sm">
          <div>
            <div className="eyebrow mb-3">Contact</div>
            <a
              href={SITE.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-[var(--ink)] hover:text-[var(--sea)]"
            >
              WhatsApp {SITE.whatsappDisplay}
            </a>
            <a
              href={SITE.emailUrl}
              className="mt-2 block text-[var(--ink)] hover:text-[var(--sea)]"
            >
              {SITE.email}
            </a>
          </div>
          <SocialLinks compact groups={["company", "channels"]} />
        </div>
      </div>
      <div className="site-shell pb-8 text-xs text-[var(--ink-soft)]">
        Always confirm final deadlines on the university portal and Universitaly.
        Universitaly pre-enrolment deadline for this cycle: 30 November 2026 (MUR).
        Status labels reflect non-EU / visa-applicant calls as of the last curation date.
      </div>
    </footer>
  );
}
