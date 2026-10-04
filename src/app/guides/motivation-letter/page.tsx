import type { Metadata } from "next";
import Link from "next/link";
import { getPakistanGuides } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Motivation letter guide",
  description:
    "How to write a strong motivation letter for Italian university admission, Erasmus Mundus, and study visa.",
};

export default async function MotivationLetterPage() {
  const { motivationLetter: m } = await getPakistanGuides();

  return (
    <div className="site-shell page-hero pb-16">
      <Link href="/guides" className="text-sm font-semibold text-[var(--sea-deep)] hover:underline">
        ← All guides
      </Link>
      <p className="eyebrow mt-6">Admissions · Erasmus · Visa</p>
      <h1 className="display mt-2 text-4xl md:text-6xl max-w-4xl">{m.title}</h1>
      <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">{m.intro}</p>

      <ol className="mt-10 space-y-4">
        {m.structure.map((step, i) => (
          <li key={step.title} className="panel rounded-3xl p-5 md:p-6">
            <div className="eyebrow">Part {i + 1}</div>
            <h2 className="display mt-1 text-2xl md:text-3xl">{step.title}</h2>
            <p className="mt-3 text-[var(--ink-soft)] leading-relaxed">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <section className="panel rounded-3xl p-6">
          <h2 className="display text-2xl">Tips that raise quality</h2>
          <ul className="mt-4 space-y-2 text-sm text-[var(--ink-soft)] leading-relaxed">
            {m.tips.map((t) => (
              <li key={t}>· {t}</li>
            ))}
          </ul>
        </section>
        <section className="panel rounded-3xl p-6">
          <h2 className="display text-2xl">Common mistakes</h2>
          <ul className="mt-4 space-y-2 text-sm text-[var(--ink-soft)] leading-relaxed">
            {m.mistakes.map((t) => (
              <li key={t}>· {t}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="/guides/how-to-write-motivation-letter.pdf"
          target="_blank"
          rel="noreferrer"
          className="btn btn-sea"
        >
          Download PDF
        </a>
        <Link href="/erasmus" className="btn btn-outline">
          Erasmus Mundus
        </Link>
        <Link href="/contact" className="btn btn-outline">
          Get letter review help
        </Link>
      </div>
    </div>
  );
}
