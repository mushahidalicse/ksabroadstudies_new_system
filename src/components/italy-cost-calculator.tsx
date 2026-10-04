"use client";

import { useMemo, useState } from "react";
import { EMPTY_COST, estimateCost, type CostInput, type CostSource } from "@/lib/cost/calculator";

const SOURCE_LABEL: Record<CostSource, string> = {
  official: "Official value",
  catalogue: "Catalogue value",
  verified: "Verified catalogue value",
  user: "User-entered value",
  estimate: "Estimate",
};

const FIELDS: Array<{ key: "applicationFeeEuro" | "testFeeEuro" | "documentsEuro" | "visaEuro" | "insuranceEuro" | "flightEuro" | "tuitionEuro" | "rentMonthlyEuro" | "foodMonthlyEuro" | "transportMonthlyEuro" | "utilitiesMonthlyEuro" | "personalMonthlyEuro" | "contingencyEuro"; label: string; group: string }> = [
  { key: "applicationFeeEuro", label: "University application fee", group: "Application" },
  { key: "testFeeEuro", label: "Admission or test fee", group: "Application" },
  { key: "documentsEuro", label: "Translation, legalization, DOV, CIMEA", group: "Documents" },
  { key: "visaEuro", label: "Visa-related fees", group: "Visa / pre-departure" },
  { key: "insuranceEuro", label: "Insurance", group: "Visa / pre-departure" },
  { key: "flightEuro", label: "Flight", group: "Travel" },
  { key: "tuitionEuro", label: "Tuition", group: "Study" },
  { key: "rentMonthlyEuro", label: "Monthly rent", group: "Living" },
  { key: "foodMonthlyEuro", label: "Monthly food", group: "Living" },
  { key: "transportMonthlyEuro", label: "Monthly local transport", group: "Living" },
  { key: "utilitiesMonthlyEuro", label: "Monthly utilities", group: "Living" },
  { key: "personalMonthlyEuro", label: "Monthly personal expenses", group: "Living" },
  { key: "contingencyEuro", label: "Optional contingency", group: "Other" },
];

function money(value: number) {
  return `€${Math.round(value).toLocaleString("en-GB")}`;
}

export function ItalyCostCalculator({
  prefill,
}: {
  prefill?: {
    programmeLabel?: string | null;
    applicationFeeEuro?: number | null;
    tuitionEuro?: number | null;
    tuitionNote?: string | null;
    tuitionVerified?: boolean;
  };
}) {
  const [input, setInput] = useState<CostInput>({
    ...EMPTY_COST,
    applicationFeeEuro: prefill?.applicationFeeEuro ?? 0,
    tuitionEuro: prefill?.tuitionEuro ?? 0,
  });
  const [catalogueFields, setCatalogueFields] = useState({
    applicationFeeEuro: prefill?.applicationFeeEuro != null,
    tuitionEuro: prefill?.tuitionEuro != null,
  });
  const [rateText, setRateText] = useState("");
  const estimate = useMemo(
    () => estimateCost({ ...input, exchangeRate: rateText.trim() ? Number(rateText) : null }),
    [input, rateText],
  );

  function setNumber(
    key: "applicationFeeEuro" | "testFeeEuro" | "documentsEuro" | "visaEuro" | "insuranceEuro" | "flightEuro" | "tuitionEuro" | "rentMonthlyEuro" | "foodMonthlyEuro" | "transportMonthlyEuro" | "utilitiesMonthlyEuro" | "personalMonthlyEuro" | "contingencyEuro" | "expectedScholarshipEuro",
    value: string,
  ) {
    setCatalogueFields((current) => ({ ...current, [key]: false }));
    const parsed = Number(value);
    setInput((current) => ({ ...current, [key]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 }));
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Planning tool</p>
        <h1 className="display mt-3 text-4xl md:text-5xl">Italy study cost calculator</h1>
        <p className="mt-3 max-w-3xl text-[var(--ink-soft)]">
          Enter the figures you have. Blank amounts stay at zero. Nothing here is an official university or embassy quote.
          {prefill?.programmeLabel ? ` Catalogue figures for ${prefill.programmeLabel} can be overwritten.` : ""}
        </p>
        {prefill?.tuitionNote ? (
          <p className="mt-2 max-w-3xl text-sm">Tuition was not prefilled. {prefill.tuitionNote}</p>
        ) : null}
      </div>
      <form className="grid gap-4">
        {FIELDS.map((field, index) => {
          const showGroup = index === 0 || FIELDS[index - 1].group !== field.group;
          return (
            <label key={field.key} className="grid gap-1 text-sm font-semibold">
              {showGroup ? <span className="eyebrow mt-2">{field.group}</span> : null}
              {field.label}
              <input
                className="input"
                inputMode="decimal"
                value={input[field.key] === 0 ? "" : String(input[field.key])}
                placeholder="0"
                onChange={(event) => setNumber(field.key, event.target.value)}
              />
              <span className="text-xs font-normal text-[var(--ink-soft)]">
                {field.key === "contingencyEuro"
                  ? SOURCE_LABEL.estimate
                  : field.key === "applicationFeeEuro" && catalogueFields.applicationFeeEuro
                    ? SOURCE_LABEL.catalogue
                    : field.key === "tuitionEuro" && catalogueFields.tuitionEuro
                      ? (prefill?.tuitionVerified ? SOURCE_LABEL.verified : SOURCE_LABEL.catalogue)
                      : SOURCE_LABEL.user}
              </span>
            </label>
          );
        })}
        <label className="grid gap-1 text-sm font-semibold">
          EUR to PKR rate
          <input className="input" inputMode="decimal" value={rateText} placeholder="Leave blank to stay in EUR" onChange={(event) => setRateText(event.target.value)} />
          <span className="text-xs font-normal text-[var(--ink-soft)]">Exchange rate used for estimate. You enter this rate.</span>
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={input.scholarshipScenario}
            onChange={(event) => setInput({ ...input, scholarshipScenario: event.target.checked })}
          />
          Show an optional scholarship scenario
        </label>
        {input.scholarshipScenario ? (
          <label className="grid gap-1 text-sm font-semibold">
            Expected scholarship support (EUR)
            <input
              className="input"
              inputMode="decimal"
              value={input.expectedScholarshipEuro || ""}
              onChange={(event) => setNumber("expectedScholarshipEuro", event.target.value)}
            />
            <span className="text-xs font-normal text-[var(--ink-soft)]">This amount is subtracted only in the optional scenario. It is not an award.</span>
          </label>
        ) : null}
      </form>
      <section className="panel rounded-3xl p-5 space-y-3" aria-live="polite">
        <p className="text-sm font-bold">{estimate.disclaimer}</p>
        <p>Estimated upfront cost: {money(estimate.upfrontEuro)}</p>
        <p>Estimated monthly living cost: {money(estimate.monthlyLivingEuro)}</p>
        <ul className="space-y-1 text-sm">
          {estimate.lines.filter((item) => item.amountEuro > 0).map((item) => (
            <li key={item.id}>
              {item.label}
              {item.monthly ? " × 12" : ""}: {money(item.monthly ? item.amountEuro * 12 : item.amountEuro)} ({SOURCE_LABEL[
                item.id === "application" && catalogueFields.applicationFeeEuro
                  ? "catalogue"
                  : item.id === "tuition" && catalogueFields.tuitionEuro
                    ? (prefill?.tuitionVerified ? "verified" : "catalogue")
                    : item.source
              ]})
            </li>
          ))}
        </ul>
        <p className="text-lg font-bold">Without scholarship: {money(estimate.firstYearEuro)}</p>
        {estimate.withScholarshipEuro != null ? (
          <p className="text-lg font-bold">If your selected scholarship is awarded: {money(estimate.withScholarshipEuro)}</p>
        ) : null}
        {estimate.pkr != null && estimate.exchangeRate ? (
          <p>About PKR {estimate.pkr.toLocaleString("en-GB")} at the exchange rate used for this estimate ({estimate.exchangeRate}).</p>
        ) : (
          <p className="text-sm text-[var(--ink-soft)]">PKR is hidden until you enter an exchange rate. The EUR total still stands.</p>
        )}
      </section>
    </div>
  );
}
