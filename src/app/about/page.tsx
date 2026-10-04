import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { getCompanyProfile } from "@/lib/content";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About KS Abroad Studies",
  description:
    "KS Abroad Studies (Private) Limited — SECP incorporation certificate, filing acknowledgement, and company details.",
};

export default async function AboutPage() {
  const c = await getCompanyProfile();

  return (
    <div className="site-shell page-hero pb-16">
      <p className="eyebrow">Registered consultancy</p>
      <div className="mt-4 flex items-center gap-4">
        <BrandLogo size={64} />
        <div>
          <h1 className="display text-4xl md:text-5xl">{SITE.name}</h1>
          <p className="mt-1 text-sm font-semibold text-[var(--sea)]">{SITE.tagline}</p>
        </div>
      </div>

      <p className="mt-6 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
        Founded by {SITE.founder} ({SITE.founderHandle}). We help Pakistani
        students with Italy admissions, Universitaly, scholarships, and visa
        file preparation — as a registered private limited company.
      </p>

      <section className="mt-10 panel rounded-3xl p-6 md:p-8">
        <p className="eyebrow">SECP authentication</p>
        <h2 className="display mt-2 text-3xl md:text-4xl">{c.legalName}</h2>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <dt className="eyebrow">CUIN</dt>
            <dd className="mt-1 font-bold">{c.cuin}</dd>
          </div>
          <div>
            <dt className="eyebrow">Incorporated</dt>
            <dd className="mt-1 font-bold">{c.incorporatedOnLabel}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="eyebrow">Registered office</dt>
            <dd className="mt-1 font-semibold leading-relaxed">{c.registeredOffice}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="eyebrow">Registrar</dt>
            <dd className="mt-1 font-semibold leading-relaxed">
              {c.registrar} · {c.act}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Filing acknowledgement</dt>
            <dd className="mt-1 font-bold">
              {c.filingAckNumber} · {c.filingAckDate}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Process ID</dt>
            <dd className="mt-1 font-bold">{c.processId}</dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap gap-3">
          {c.downloads.map((f) => (
            <a key={f.href} href={f.href} target="_blank" rel="noreferrer" className="btn btn-sea">
              {f.label}
            </a>
          ))}
          <a href={c.verifyUrl} target="_blank" rel="noreferrer" className="btn btn-outline">
            Verify on SECP
          </a>
        </div>
        <p className="mt-6 text-sm text-[var(--ink-soft)] leading-relaxed max-w-2xl">
          {c.disclaimer}
        </p>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/agreement" className="btn btn-outline">
          Consultancy agreement
        </Link>
        <Link href="/contact" className="btn btn-outline">
          Contact
        </Link>
        <a href={SITE.whatsappUrl} target="_blank" rel="noreferrer" className="btn btn-outline">
          WhatsApp {SITE.whatsappDisplay}
        </a>
      </div>
    </div>
  );
}
