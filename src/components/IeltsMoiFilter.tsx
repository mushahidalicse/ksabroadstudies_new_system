"use client";

import { CheckCircle2 } from "lucide-react";
import type { EnglishFilter } from "@/lib/english-band";

export function IeltsMoiFilter({
  value,
  onFilterChange,
}: {
  value: EnglishFilter;
  onFilterChange: (filter: EnglishFilter) => void;
}) {
  const options: Array<{ id: EnglishFilter; label: string }> = [
    { id: "all", label: "All Programmes" },
    { id: "moi", label: "Accepts MOI / English letter" },
    { id: "ielts", label: "IELTS / TOEFL required" },
  ];

  return (
    <div className="panel rounded-2xl p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="eyebrow">English requirement</p>
          <h2 className="mt-1 text-lg font-bold">Applying without IELTS?</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onFilterChange(option.id)}
              className={`rounded-full px-3 py-2 text-xs font-bold ${
                value === option.id
                  ? "bg-[var(--sea-deep)] text-white"
                  : "border border-[var(--line)] text-[var(--ink-soft)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-[rgba(15,106,111,0.08)] px-3 py-2 text-xs leading-relaxed text-[var(--ink)]">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sea)]" />
        <span>
          The MOI list uses notes already on this site: Salento, Teramo, Politecnico di Milano, and Milano-Bicocca
          mention an English-medium letter for some courses. Cassino and Messina are not written that way here.
          Confirm the call before you skip IELTS.
        </span>
      </p>
    </div>
  );
}
