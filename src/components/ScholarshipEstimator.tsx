"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Award, Banknote, Home, Users } from "lucide-react";
import { SITE } from "@/lib/site";

const INCOMES = [
  { id: "under_100k", label: "Under 1 Lakh" },
  { id: "100k_200k", label: "1 – 2 Lakhs" },
  { id: "200k_350k", label: "2 – 3.5 Lakhs" },
  { id: "above_400k", label: "Above 4 Lakhs" },
] as const;

type IncomeId = (typeof INCOMES)[number]["id"];

function readBand(income: IncomeId, housing: "rented" | "owned") {
  if (income === "above_400k") return "review" as const;
  if (income === "200k_350k" && housing === "owned") return "review" as const;
  return "often" as const;
}

export function ScholarshipEstimator() {
  const [familyMembers, setFamilyMembers] = useState(5);
  const [monthlyIncome, setMonthlyIncome] = useState<IncomeId>("under_100k");
  const [housing, setHousing] = useState<"rented" | "owned">("rented");
  const [calculated, setCalculated] = useState(false);

  const band = useMemo(
    () => (calculated ? readBand(monthlyIncome, housing) : null),
    [calculated, monthlyIncome, housing],
  );

  const whatsapp = `${SITE.whatsappUrl}?text=${encodeURIComponent(
    "Salam KS Abroad. I used the scholarship checker on the website and want help preparing the regional scholarship file.",
  )}`;

  return (
    <section className="ink-card rounded-3xl p-6 shadow-2xl md:p-8">
      <div className="mx-auto mb-8 max-w-2xl text-center">
        <span className="ink-sand mb-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold">
          <Award className="h-3.5 w-3.5" /> Check Free Education & €8,000+ Stipend Eligibility
        </span>
        <h2 className="display text-3xl md:text-4xl">Will a regional grant cover this file?</h2>
        <p className="ink-muted mt-3 text-sm leading-relaxed">
          Household size, monthly income, and whether the home is rented are the first clues.
          The official figure is still calculated in Italy. This checker does not approve a grant.
        </p>
      </div>

      <form
        className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          setCalculated(true);
        }}
      >
        <div className="ink-well rounded-2xl p-4">
          <label className="ink-sand mb-3 flex items-center gap-2 text-xs font-semibold">
            <Users className="h-4 w-4" /> Family members
          </label>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="ink-chip h-10 w-10 rounded-xl text-lg"
              onClick={() => setFamilyMembers((count) => Math.max(2, count - 1))}
            >
              −
            </button>
            <span className="text-2xl font-extrabold">{familyMembers === 10 ? "10+" : familyMembers}</span>
            <button
              type="button"
              className="ink-chip h-10 w-10 rounded-xl text-lg"
              onClick={() => setFamilyMembers((count) => Math.min(10, count + 1))}
            >
              +
            </button>
          </div>
          <p className="ink-muted mt-2 text-center text-[11px]">2 to 10+</p>
        </div>

        <div className="ink-well rounded-2xl p-4">
          <p className="ink-sand mb-3 flex items-center gap-2 text-xs font-semibold">
            <Banknote className="h-4 w-4" /> Monthly family income (PKR)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {INCOMES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMonthlyIncome(item.id)}
                className={`ink-chip rounded-xl px-2 py-2 text-xs font-semibold ${
                  monthlyIncome === item.id ? "is-on" : ""
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ink-well rounded-2xl p-4">
          <p className="ink-sand mb-3 flex items-center gap-2 text-xs font-semibold">
            <Home className="h-4 w-4" /> Housing
          </p>
          <div className="grid grid-cols-1 gap-2">
            {(
              [
                ["rented", "Rented house"],
                ["owned", "Owned house"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setHousing(id)}
                className={`ink-chip rounded-xl px-3 py-3 text-xs font-semibold ${
                  housing === id ? "is-on" : ""
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-3">
          <button className="btn btn-glow w-full" type="submit">
            Check my scholarship range <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>

      {band ? (
        <div className="ink-well rise rounded-2xl p-6">
          <p className="ink-sand text-xs font-bold uppercase tracking-wide">
            {band === "often" ? "Often in the full-support range" : "Needs a file check first"}
          </p>
          <h3 className="mt-2 text-xl font-bold">
            {band === "often"
              ? `A household of ${familyMembers === 10 ? "10 or more" : familyMembers} at this income often matches the band used for the highest regional support.`
              : "Owned property or income above about 3.5 lakh a month can push the file out of the highest band."}
          </h3>
          <p className="ink-muted mt-2 text-sm">
            This is not an official result. A recognised Italian office still calculates the household file.
            A larger family can lower the figure they use. An owned house can raise it.
          </p>
          <div className="my-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="ink-well rounded-xl p-4">
              <div className="ink-sand text-xs">Tuition</div>
              <div className="mt-1 text-lg font-extrabold">Often the minimum band</div>
              <p className="ink-muted mt-1 text-xs">Many calls reduce tuition. A small regional tax can remain.</p>
            </div>
            <div className="ink-well rounded-xl p-4">
              <div className="ink-sand text-xs">Living grant</div>
              <div className="mt-1 text-lg font-extrabold">About €7,000–€8,000</div>
              <p className="ink-muted mt-1 text-xs">Typical reported range for a student living away from home. Each region sets its own amount.</p>
            </div>
            <div className="ink-well rounded-xl p-4">
              <div className="ink-sand text-xs">Canteen and housing</div>
              <div className="mt-1 text-lg font-extrabold">Often included</div>
              <p className="ink-muted mt-1 text-xs">Meal support and a housing place depend on the call and on places left.</p>
            </div>
          </div>
          <p className="ink-muted text-xs">
            Agencies students usually compare: DiSCo Lazio, ADISU Puglia, ER.GO, and the Liguria ALiSEO desk.
            Open the scholarship pages for the current window before you count the money.
          </p>
          <a className="btn btn-primary mt-5 w-full sm:w-auto" href={whatsapp} target="_blank" rel="noreferrer">
            Prepare your scholarship file with KS Abroad <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      ) : null}
    </section>
  );
}
