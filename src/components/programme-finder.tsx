"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

const LEVELS = [
  { id: "bachelor", label: "Bachelor's", href: "/programs/bachelor" },
  { id: "master", label: "Master's", href: "/programs/master" },
  { id: "medicine", label: "Medicine/IMAT", href: "/programs/single-cycle" },
  { id: "phd", label: "PhD", href: "/phd" },
] as const;

const FIELDS = [
  { value: "Business|Economics", label: "Economics & Business" },
  { value: "Engineering|Computer Science", label: "Engineering & CS" },
  { value: "Computer Science|Data", label: "Data Science" },
  { value: "Medicine|Life Sciences|Pharmacy", label: "Health Sciences" },
  { value: "Humanities|Political Science", label: "Humanities" },
] as const;

const REGIONS = [
  { value: "lazio", label: "Lazio" },
  { value: "south", label: "South & Islands" },
  { value: "centre", label: "Centre" },
  { value: "north", label: "North" },
] as const;

export function ProgrammeFinder({
  counts,
}: {
  counts: { bachelor: number; master: number; singleCycle: number };
}) {
  const router = useRouter();
  const [level, setLevel] = useState<(typeof LEVELS)[number]["id"]>("master");
  const [field, setField] = useState("");
  const [region, setRegion] = useState("");

  const levelLabel: Record<(typeof LEVELS)[number]["id"], string> = {
    bachelor: `Bachelor's (${counts.bachelor}+)`,
    master: `Master's (${counts.master}+)`,
    medicine: `Medicine/IMAT (${counts.singleCycle}+)`,
    phd: "PhD",
  };

  function search() {
    const params = new URLSearchParams();
    params.set("level", level === "medicine" ? "single-cycle" : level);
    if (field) params.set("field", field);
    if (region) params.set("region", region);
    router.push(`/programs/find?${params.toString()}`);
  }

  return (
    <form
      className="sticky top-20 z-30 rounded-2xl border border-white/15 bg-[#0a2428]/85 p-3 shadow-2xl backdrop-blur-xl"
      onSubmit={(event) => {
        event.preventDefault();
        search();
      }}
    >
      <div className="grid gap-2 md:grid-cols-[1fr_1.15fr_1fr_auto] md:items-end">
        <label className="block text-sm text-[#f7f4ed]">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#dcc7a4]">
            Degree level
          </span>
          <select
            className="select"
            value={level}
            onChange={(event) => setLevel(event.target.value as (typeof LEVELS)[number]["id"])}
          >
            {LEVELS.map((item) => (
              <option key={item.id} value={item.id}>
                {levelLabel[item.id]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-[#f7f4ed]">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#dcc7a4]">
            Discipline
          </span>
          <select className="select" value={field} onChange={(event) => setField(event.target.value)}>
            <option value="">Any discipline</option>
            {FIELDS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-[#f7f4ed]">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#dcc7a4]">
            Preferred region
          </span>
          <select className="select" value={region} onChange={(event) => setRegion(event.target.value)}>
            <option value="">All Italy</option>
            {REGIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-glow md:self-end" type="submit">
          Find My Programme <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}
