"use client";

import { useEffect, useState } from "react";
import { CheckSquare, Square } from "lucide-react";

const STEPS = [
  {
    id: "school",
    title: "High school / Intermediate → Board attestation → IBCC",
    detail: "Matric and Intermediate marksheets attested by the board, then verified by IBCC.",
  },
  {
    id: "degree",
    title: "Bachelor's degree and transcript → HEC → MOFA",
    detail: "HEC verification, then Ministry of Foreign Affairs attestation, for a master's file.",
  },
  {
    id: "cimea",
    title: "CIMEA statement of comparability",
    detail: "The comparability or verification statement used with the university and Universitaly.",
  },
  {
    id: "family",
    title: "FRC and FBR income proof",
    detail: "NADRA family registration certificate and FBR tax papers for the regional grant and the visa file.",
  },
] as const;

const STORAGE_KEY = "ks-attestation-tracker";

export function DocumentTracker() {
  const [done, setDone] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as unknown;
        if (Array.isArray(saved)) {
          setDone(saved.filter((item): item is string => typeof item === "string"));
        }
      } catch {
        /* ignore */
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggle(id: string) {
    setDone((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const percent = Math.round((done.length / STEPS.length) * 100);

  return (
    <section className="panel rounded-3xl p-6 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Before pre-enrolment and visa</p>
          <h2 className="display mt-2 text-3xl">Pakistani attestation tracker</h2>
        </div>
        <p className="text-sm font-bold text-[var(--sea-deep)]">
          File readiness: {ready ? percent : 0}% ready
        </p>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[var(--paper-deep)]">
        <div
          className="h-full bg-[var(--sea)] transition-all"
          style={{ width: `${ready ? percent : 0}%` }}
        />
      </div>
      <ul className="mt-5 space-y-3">
        {STEPS.map((step) => {
          const on = done.includes(step.id);
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => toggle(step.id)}
                className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left ${
                  on ? "border-[var(--sea)] bg-[rgba(15,106,111,0.06)]" : "border-[var(--line)]"
                }`}
              >
                {on ? (
                  <CheckSquare className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sea)]" />
                ) : (
                  <Square className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ink-soft)]" />
                )}
                <span>
                  <span className="block text-sm font-semibold">{step.title}</span>
                  <span className="mt-1 block text-xs text-[var(--ink-soft)]">{step.detail}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
