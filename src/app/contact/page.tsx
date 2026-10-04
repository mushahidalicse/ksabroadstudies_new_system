import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { SocialLinks } from "@/components/social-links";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact KS Abroad Studies for Study in Italy guidance — WhatsApp, email, and social channels.",
};

export default function ContactPage() {
  return (
    <div className="site-shell py-16 md:py-24">
      <p className="eyebrow">Contact</p>
      <h1 className="display mt-3 max-w-xl text-4xl md:text-5xl">Talk to KS Abroad</h1>
      <p className="mt-4 max-w-md text-[var(--ink-soft)] leading-relaxed">
        A short note is enough. We reply by email, or faster on WhatsApp.
      </p>

      <div className="mt-8 flex flex-col gap-2 text-sm sm:flex-row sm:gap-10">
        <a
          href={SITE.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--ink)] hover:text-[var(--sea-deep)]"
        >
          WhatsApp {SITE.whatsappDisplay}
        </a>
        <a href={SITE.emailUrl} className="text-[var(--ink)] hover:text-[var(--sea-deep)]">
          {SITE.email}
        </a>
      </div>

      <div className="mt-12 max-w-xl border-t border-[var(--line)] pt-10">
        <ContactForm />
      </div>

      <div className="mt-14 max-w-xl border-t border-[var(--line)] pt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          Social
        </p>
        <div className="mt-4">
          <SocialLinks compact groups={["company", "channels"]} />
        </div>
      </div>
    </div>
  );
}
