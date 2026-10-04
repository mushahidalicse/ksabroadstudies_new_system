import type { Metadata } from "next";
import Link from "next/link";
import { getPakistanGuides } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Document attestation",
  description:
    "Pakistan educational document chain for Italy: board, IBCC, HEC, MOFA apostille, translation, and CIMEA.",
};

export default async function DocumentsGuidePage() {
  const g = await getPakistanGuides();

  return (
    <div className="site-shell page-hero pb-16">
      <Link href="/guides" className="text-sm font-semibold text-[var(--sea-deep)] hover:underline">
        ← All guides
      </Link>
      <p className="eyebrow mt-6">Before Universitaly / visa</p>
      <h1 className="display mt-2 text-4xl md:text-6xl max-w-4xl">
        {g.documentChain.title}
      </h1>
      <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
        {g.documentChain.intro}
      </p>

      <ol className="mt-10 space-y-4">
        {g.documentChain.steps.map((step, i) => (
          <li key={step.title} className="panel rounded-3xl p-5 md:p-6">
            <div className="eyebrow">Step {i + 1}</div>
            <h2 className="display mt-1 text-2xl md:text-3xl">{step.title}</h2>
            <p className="mt-3 text-[var(--ink-soft)] leading-relaxed">{step.body}</p>
          </li>
        ))}
      </ol>

      <section className="mt-12 panel rounded-3xl p-6 md:p-8">
        <h2 className="display text-3xl">{g.apostille.title}</h2>
        <ol className="mt-5 space-y-3">
          {g.apostille.steps.map((step, i) => (
            <li key={step} className="flex gap-3 text-[var(--ink-soft)] leading-relaxed">
              <span className="font-bold text-[var(--sea-deep)]">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/guides/translations" className="btn btn-sea">
          Translation companies
        </Link>
        <Link href="/guides/dov" className="btn btn-outline">
          DOV & CIMEA
        </Link>
        <Link href="/guides/visa" className="btn btn-outline">
          Visa guide
        </Link>
      </div>
    </div>
  );
}
