import type { Metadata } from "next";
import Link from "next/link";
import { getTranslationGuide } from "@/lib/content";
import type { TranslationRegionList } from "@/lib/content-types";

export const metadata: Metadata = {
  title: "Italian translation companies",
  description:
    "Authorised Italian translators — Embassy of Italy Islamabad list and Consulate of Italy Karachi list for Sindh & Balochistan.",
};

function TranslatorGrid({ list, id }: { list: TranslationRegionList; id: string }) {
  return (
    <section className="mt-12 scroll-mt-24" id={id}>
      <p className="eyebrow">Authorised list</p>
      <h2 className="display mt-2 text-3xl md:text-4xl max-w-3xl">{list.title}</h2>
      <p className="mt-4 max-w-3xl text-[var(--ink-soft)] leading-relaxed">{list.note}</p>
      <p className="mt-2 text-sm text-[var(--ink-soft)]">{list.sourceNote}</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {list.companies.map((co) => (
          <article key={co.name + co.email} className="panel rounded-3xl p-5 md:p-6">
            <h3 className="font-bold text-lg leading-snug">{co.name}</h3>
            <p className="mt-3 text-sm text-[var(--ink-soft)] leading-relaxed">{co.address}</p>
            <p className="mt-2 text-sm font-semibold">{co.phone}</p>
            <a
              href={`mailto:${co.email}`}
              className="mt-1 inline-block text-sm font-semibold text-[var(--sea-deep)] hover:underline"
            >
              {co.email}
            </a>
            {co.website && (
              <a
                href={co.website}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block text-sm font-semibold text-[var(--sea-deep)] hover:underline"
              >
                Website →
              </a>
            )}
          </article>
        ))}
      </div>

      {list.pdf && (
        <a
          href={list.pdf}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-6 font-bold text-[var(--sea-deep)] hover:underline"
        >
          Download list PDF →
        </a>
      )}
    </section>
  );
}

export default async function TranslationsPage() {
  const data = await getTranslationGuide();

  return (
    <div className="site-shell page-hero pb-16">
      <Link href="/guides" className="text-sm font-semibold text-[var(--sea-deep)] hover:underline">
        ← All guides
      </Link>
      <p className="eyebrow mt-6">Islamabad · Karachi</p>
      <h1 className="display mt-2 text-4xl md:text-6xl max-w-4xl">
        Italian translation — authorised lists
      </h1>
      <p className="mt-5 max-w-3xl text-lg text-[var(--ink-soft)] leading-relaxed">
        {data.intro}
      </p>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
        <a href="#karachi" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          Karachi · Sindh & Balochistan
        </a>
        <a href="#islamabad" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          Islamabad Embassy
        </a>
        <Link href="/guides/visa" className="rounded-full border border-[var(--line)] px-3 py-1.5 hover:bg-white/60">
          DOV & visa guide
        </Link>
      </nav>

      <TranslatorGrid list={data.karachi} id="karachi" />
      <TranslatorGrid list={data.islamabad} id="islamabad" />
    </div>
  );
}
