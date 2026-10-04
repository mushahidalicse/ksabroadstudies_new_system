import type { Metadata } from "next";
import Link from "next/link";
import { getPakistanGuides } from "@/lib/guides";

export const metadata: Metadata = {
  title: "DOV & CIMEA",
  description:
    "Declaration of Value (DOV) checklists for Sindh/Balochistan and other provinces, plus CIMEA Diplome comparability for Italian universities.",
};

export default async function DovCimeaGuidePage() {
  const g = await getPakistanGuides();
  const cimea = g.postAdmission.cimeaLinks;

  return (
    <div className="site-shell page-hero pb-16">
      <Link href="/guides" className="text-sm font-semibold text-[var(--sea-deep)] hover:underline">
        ← All guides
      </Link>
      <p className="eyebrow mt-6">After admission · before visa</p>
      <h1 className="display mt-2 text-4xl md:text-6xl max-w-4xl">
        DOV & CIMEA
      </h1>
      <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
        Declaration of Value (Dichiarazione di Valore) and CIMEA Diplome
        comparability are academic recognition steps — separate from the study
        visa file. Follow what your university letter asks for.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
        <a href="#dov" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          DOV checklist
        </a>
        <a href="#tracks" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          Islamabad vs Karachi
        </a>
        <a href="#cimea" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          CIMEA
        </a>
        <Link href="/guides/visa" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          Visa guide →
        </Link>
      </nav>

      <section id="dov" className="mt-12 scroll-mt-24">
        <h2 className="display text-3xl md:text-4xl max-w-3xl">{g.dovChecklist.title}</h2>
        <p className="mt-4 max-w-3xl text-[var(--ink-soft)] leading-relaxed">
          {g.dovChecklist.intro}
        </p>
        <ul className="mt-6 space-y-3">
          {g.dovChecklist.items.map((item) => (
            <li
              key={item.slice(0, 48)}
              className="panel rounded-2xl p-4 text-sm text-[var(--ink-soft)] leading-relaxed"
            >
              · {item}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-[var(--ink-soft)]">{g.dovChecklist.submissionNote}</p>
      </section>

      <section id="tracks" className="mt-12 scroll-mt-24">
        <h2 className="display text-3xl">{g.postAdmission.title}</h2>
        <p className="mt-3 max-w-3xl text-[var(--ink-soft)]">{g.postAdmission.intro}</p>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="panel rounded-3xl p-5">
            <h3 className="font-bold">Islamabad track (Punjab, KPK, ICT, GB)</h3>
            <ol className="mt-3 space-y-2 text-sm text-[var(--ink-soft)]">
              {g.postAdmission.islamabadTrack.map((s, i) => (
                <li key={s.slice(0, 28)}>
                  {i + 1}. {s}
                </li>
              ))}
            </ol>
          </div>
          <div className="panel rounded-3xl p-5">
            <h3 className="font-bold">Karachi / BLS track (Sindh & Balochistan)</h3>
            <ol className="mt-3 space-y-2 text-sm text-[var(--ink-soft)]">
              {g.postAdmission.karachiTrack.map((s, i) => (
                <li key={s.slice(0, 28)}>
                  {i + 1}. {s}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="cimea" className="mt-12 panel rounded-3xl p-6 md:p-8 scroll-mt-24">
        <p className="eyebrow">Comparability</p>
        <h2 className="display mt-2 text-3xl">CIMEA Diplome</h2>
        <p className="mt-4 max-w-3xl text-[var(--ink-soft)] leading-relaxed">
          Many universities accept a CIMEA statement of comparability instead of
          (or alongside) DOV. Register on the Diplome portal, follow the courier
          instructions for attested photocopies, and keep the certificate for
          enrollment and visa where required.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <a
            href={cimea.register}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[var(--sea-deep)] hover:underline"
          >
            CIMEA Diplome register →
          </a>
          <a
            href={cimea.bls}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[var(--sea-deep)] hover:underline"
          >
            BLS Italy Pakistan →
          </a>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/guides/visa" className="btn btn-sea">
          Study visa guide
        </Link>
        <Link href="/guides/documents" className="btn btn-outline">
          Document attestation
        </Link>
        <a
          href="/guides/dov-checklist-sindh-balochistan.pdf"
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline"
        >
          DOV checklist PDF
        </a>
      </div>
    </div>
  );
}
