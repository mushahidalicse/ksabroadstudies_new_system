"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CatalogueCard } from "@/lib/programme-catalogue";
import { englishBand } from "@/lib/english-band";
import { levelLabel } from "@/lib/programme-filters";
import { publicEnglishLine, publicMoiLine, publicTuitionLine } from "@/lib/programme-enrichment";
import { dedupeResolvedSlugs } from "@/lib/programme-catalogue";
import { COMPARE_KEY, readCompare, replaceStored, STORE_EVENT, toggleStored } from "@/lib/programme-store";
import { formatFee, regionLabel } from "@/lib/utils";

function cell(value: string | null | undefined) {
  const text = (value || "").trim();
  return text || "Not available";
}

export function CompareBoard({ programmes }: { programmes: CatalogueCard[] }) {
  const [slugs, setSlugs] = useState<string[] | null>(null);

  useEffect(() => {
    const sync = () => {
      const stored = readCompare();
      const resolved = dedupeResolvedSlugs(programmes, stored);
      if (resolved.join("|") !== stored.join("|")) {
        replaceStored(COMPARE_KEY, resolved);
        return;
      }
      setSlugs(resolved);
    };
    sync();
    window.addEventListener(STORE_EVENT, sync);
    return () => window.removeEventListener(STORE_EVENT, sync);
  }, [programmes]);

  if (!slugs) return <div className="panel h-40 rounded-3xl" aria-busy="true" />;

  const rows = slugs
    .map((slug) => programmes.find((item) => item.slug === slug))
    .filter((item): item is CatalogueCard => Boolean(item));

  if (rows.length < 2) {
    return (
      <div className="panel rounded-3xl p-6 md:p-8">
        <h2 className="display text-3xl">Choose at least two programmes to compare.</h2>
        <p className="mt-3 text-sm text-[var(--ink-soft)]">You can compare up to four.</p>
        <Link href="/programs/find" className="btn btn-sea mt-5">Explore Programmes</Link>
      </div>
    );
  }

  const lines: Array<[string, (programme: CatalogueCard) => string]> = [
    ["Programme", (programme) => programme.name],
    ["University", (programme) => programme.universityName],
    ["City", (programme) => cell(programme.city)],
    ["Region", (programme) => (programme.region ? regionLabel(programme.region) : "Not available")],
    ["Degree", (programme) => levelLabel(programme.level)],
    ["Duration", () => "Not available"],
    ["Language", (programme) => cell(programme.language)],
    ["Application fee", (programme) => formatFee(programme.applicationFeeEuro)],
    ["Tuition", (programme) => publicTuitionLine(programme) || "Not available"],
    ["Deadline", (programme) => programme.estimatedDeadline ? `${programme.deadlineLabel} (estimated)` : programme.deadlineLabel],
    ["English requirement", (programme) => publicEnglishLine(programme) || (cell(programme.englishRequirement) === "Not available" ? "Check official source" : programme.englishRequirement)],
    ["MOI", (programme) => publicMoiLine(programme) || (englishBand(programme.englishRequirement) === "moi" ? "Mentioned in the university note — confirm the call" : /moi not accepted|moi rejected/i.test(programme.englishRequirement) ? "The note says MOI is not accepted" : "Not specified")],
    ["Test", (programme) => programme.admissionTest || "Not recorded"],
    ["CEnT-S", (programme) => programme.centS ? "Mentioned on this record" : "Not recorded"],
    ["GRE/GMAT", (programme) => programme.greGmat ? "Mentioned on this record" : "Not recorded"],
    ["Scholarship", () => "Check official source"],
    ["CIMEA", (programme) => programme.requiresCimea === null ? "Not available" : programme.requiresCimea ? "University record says CIMEA is required" : "Not marked required on the university record"],
    ["DOV", () => "Check the DOV guide — not a programme field"],
    ["Last checked", (programme) => programme.catalogueChecked || "Not available"],
    ["Official link", (programme) => programme.applyUrl || programme.sourceUrl || "Check official source"],
  ];

  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[720px]">
        <thead>
          <tr>
            <th>Field</th>
            {rows.map((programme) => (
              <th key={programme.slug}>
                <Link href={`/programs/p/${programme.slug}`} className="hover:text-[var(--sea)]">{programme.name}</Link>
                <button
                  type="button"
                  className="mt-2 block text-xs font-bold text-[var(--coral)]"
                  onClick={() => toggleStored(COMPARE_KEY, programme.slug, 4)}
                >
                  Remove
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map(([label, read]) => (
            <tr key={label}>
              <th className="text-left">{label}</th>
              {rows.map((programme) => (
                <td key={programme.slug}>
                  {label === "Official link" && (programme.applyUrl || programme.sourceUrl) ? (
                    <a href={programme.applyUrl || programme.sourceUrl || "#"} target="_blank" rel="noreferrer" className="font-semibold text-[var(--sea-deep)] hover:underline">
                      Open link
                    </a>
                  ) : (
                    read(programme)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
