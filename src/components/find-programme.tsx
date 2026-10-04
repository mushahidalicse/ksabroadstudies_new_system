"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ProgrammeResult } from "@/components/programme-result";
import type { CatalogueCard } from "@/lib/programme-catalogue";
import {
  EMPTY_FINDER,
  filterProgrammes,
  finderQueryToParams,
  sortProgrammes,
  type FinderQuery,
} from "@/lib/programme-filters";

const LEVELS = [
  ["", "All levels"],
  ["bachelor", "Bachelor's"],
  ["master", "Master's"],
  ["single-cycle", "Medicine"],
  ["phd", "PhD"],
] as const;

const REGIONS = [
  ["lazio", "Lazio"],
  ["south", "South"],
  ["centre", "Centre"],
  ["north", "North"],
] as const;

const FIELDS = ["Engineering", "Computer Science", "Economics", "Business", "Medicine", "Data", "Political Science", "Architecture", "Design"];

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function FindProgramme({
  programmes,
  initial,
}: {
  programmes: CatalogueCard[];
  initial: FinderQuery;
}) {
  const router = useRouter();
  const [query, setQuery] = useState<FinderQuery>(initial);
  const [drawer, setDrawer] = useState(false);
  const [shown, setShown] = useState(60);

  const cities = useMemo(
    () => Array.from(new Set(programmes.map((item) => item.city).filter(Boolean))).sort(),
    [programmes],
  );

  const results = useMemo(
    () => sortProgrammes(filterProgrammes(programmes, query), query.sort),
    [programmes, query],
  );

  function commit(next: FinderQuery) {
    setShown(60);
    setQuery(next);
    const params = finderQueryToParams(next);
    const suffix = params.toString();
    router.replace(suffix ? `/programs/find?${suffix}` : "/programs/find", { scroll: false });
  }

  function clear() {
    commit(EMPTY_FINDER);
    setDrawer(false);
  }

  const chips: Array<{ id: string; label: string; clear: () => void }> = [
    query.level
      ? { id: "level", label: LEVELS.find((item) => item[0] === query.level)?.[1] || query.level, clear: () => commit({ ...query, level: "" }) }
      : null,
    ...query.field.map((field) => ({ id: `field-${field}`, label: field, clear: () => commit({ ...query, field: query.field.filter((item) => item !== field) }) })),
    ...query.region.map((region) => ({ id: `region-${region}`, label: region, clear: () => commit({ ...query, region: query.region.filter((item) => item !== region) }) })),
    ...query.city.map((city) => ({ id: `city-${city}`, label: city, clear: () => commit({ ...query, city: query.city.filter((item) => item !== city) }) })),
    query.english !== "any" && query.english !== "undecided"
      ? { id: "english", label: query.english.toUpperCase(), clear: () => commit({ ...query, english: "any" as const }) }
      : null,
    query.fee !== "any"
      ? { id: "fee", label: query.fee === "free" ? "Free fee" : `Fee under €${query.fee}`, clear: () => commit({ ...query, fee: "any" as const }) }
      : null,
    query.status && query.status !== "all"
      ? { id: "status", label: query.status, clear: () => commit({ ...query, status: "" as const }) }
      : null,
    query.centS ? { id: "cent", label: "CEnT-S", clear: () => commit({ ...query, centS: false }) } : null,
    query.gre ? { id: "gre", label: "GRE/GMAT", clear: () => commit({ ...query, gre: false }) } : null,
    query.test ? { id: "test", label: "Test required", clear: () => commit({ ...query, test: false }) } : null,
  ].filter((item): item is { id: string; label: string; clear: () => void } => Boolean(item));

  const controls = (
    <div className="space-y-4">
      <label className="block text-sm font-semibold">
        Study level
        <select
          className="select mt-1"
          value={query.level}
          onChange={(event) => commit({ ...query, level: event.target.value as FinderQuery["level"] })}
        >
          {LEVELS.map(([value, label]) => (
            <option key={value || "all"} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="text-sm font-semibold">Field</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {FIELDS.map((field) => (
            <label key={field} className="cursor-pointer">
              <input
                className="peer sr-only"
                type="checkbox"
                checked={query.field.some((item) => item.toLowerCase() === field.toLowerCase())}
                onChange={() => commit({ ...query, field: toggle(query.field, field) })}
              />
              <span className="inline-block rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-bold peer-checked:bg-[var(--sea-deep)] peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--sea)]">
                {field}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">Region</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {REGIONS.map(([value, label]) => (
            <label key={value} className="cursor-pointer">
              <input
                className="peer sr-only"
                type="checkbox"
                checked={query.region.includes(value)}
                onChange={() => commit({ ...query, region: toggle(query.region, value) })}
              />
              <span className="inline-block rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-bold peer-checked:bg-[var(--sea-deep)] peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--sea)]">
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-semibold">
        Preferred city
        <select
          className="select mt-1"
          value=""
          onChange={(event) => {
            if (!event.target.value) return;
            commit({ ...query, city: toggle(query.city, event.target.value) });
          }}
        >
          <option value="">Add a city</option>
          {cities.map((city) => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold">
        English proof
        <select
          className="select mt-1"
          value={query.english}
          onChange={(event) => commit({ ...query, english: event.target.value as FinderQuery["english"] })}
        >
          <option value="any">Any published note</option>
          <option value="ielts">IELTS mentioned</option>
          <option value="toefl">TOEFL mentioned</option>
          <option value="moi">MOI / English letter mentioned</option>
          <option value="other">Other / not specified</option>
          <option value="undecided">Not decided</option>
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Application fee
        <select
          className="select mt-1"
          value={query.fee}
          onChange={(event) => commit({ ...query, fee: event.target.value as FinderQuery["fee"] })}
        >
          <option value="any">Any</option>
          <option value="free">Free</option>
          <option value="20">Under €20</option>
          <option value="30">Under €30</option>
          <option value="50">Under €50</option>
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Programme status
        <select
          className="select mt-1"
          value={query.status || "all"}
          onChange={(event) => commit({ ...query, status: event.target.value === "all" ? "" : event.target.value as FinderQuery["status"] })}
        >
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="closing">Closing soon</option>
          <option value="upcoming">Upcoming</option>
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Sort
        <select
          className="select mt-1"
          value={query.sort}
          onChange={(event) => commit({ ...query, sort: event.target.value as FinderQuery["sort"] })}
        >
          <option value="name">Programme name</option>
          <option value="university">University</option>
          <option value="deadline">Deadline</option>
          <option value="fee">Application fee</option>
          <option value="updated">Recently checked</option>
        </select>
      </label>
      <fieldset className="space-y-2 text-sm">
        <legend className="font-semibold">Only where the record says so</legend>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={query.centS} onChange={() => commit({ ...query, centS: !query.centS })} />
          CEnT-S mentioned
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={query.gre} onChange={() => commit({ ...query, gre: !query.gre })} />
          GRE / GMAT mentioned
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={query.test} onChange={() => commit({ ...query, test: !query.test })} />
          Admission test recorded
        </label>
      </fieldset>
      <p className="text-xs text-[var(--ink-soft)]">
        Scholarship eligibility is not stored on each programme. Use the Scholarships section for regional grants.
      </p>
      <button type="button" className="text-sm font-bold text-[var(--sea-deep)]" onClick={clear}>
        Clear all
      </button>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="panel hidden rounded-3xl p-5 lg:block">{controls}</aside>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[16rem] flex-1">
            <span className="sr-only">Search programmes</span>
            <input
              className="input"
              placeholder="Search programme, university, or city"
              value={query.q}
              onChange={(event) => commit({ ...query, q: event.target.value })}
            />
          </label>
          <button type="button" className="btn btn-outline lg:hidden" onClick={() => setDrawer(true)}>
            <SlidersHorizontal size={16} aria-hidden /> Filters
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-[var(--ink-soft)]">{results.length} programmes</p>
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2 py-1 text-xs font-bold"
              onClick={chip.clear}
            >
              {chip.label} <X size={12} aria-hidden /> <span className="sr-only">Remove {chip.label}</span>
            </button>
          ))}
        </div>
        {results.length === 0 ? (
          <div className="panel rounded-3xl p-6">
            <p className="font-semibold">No programmes match these filters.</p>
            <button type="button" className="btn btn-sea mt-4" onClick={clear}>Clear all</button>
          </div>
        ) : (
          <div className="grid gap-4">
            {results.slice(0, shown).map((programme) => (
              <ProgrammeResult key={programme.slug} programme={programme} />
            ))}
          </div>
        )}
        {results.length > shown ? (
          <button type="button" className="btn btn-outline" onClick={() => setShown((count) => count + 60)}>
            Load more ({results.length - shown} remaining)
          </button>
        ) : null}
      </div>
      {drawer ? (
        <dialog
          open
          className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none bg-[var(--paper)] p-0 text-[var(--ink)]"
          aria-label="Programme filters"
          onKeyDown={(event) => {
            if (event.key === "Escape") setDrawer(false);
          }}
        >
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
            <h2 className="font-bold">Filters</h2>
            <button type="button" className="btn btn-outline text-sm py-2 px-3" onClick={() => setDrawer(false)}>
              Close
            </button>
          </div>
          <div className="h-[calc(100%-4rem)] overflow-y-auto p-4">{controls}</div>
        </dialog>
      ) : null}
    </div>
  );
}
