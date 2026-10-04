"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConsultancyCase } from "@/lib/consultancy-types";

export function ConsultancyPanel({ onCases }: { onCases?: (count: number) => void }) {
  const [cases, setCases] = useState<ConsultancyCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyBusy, setReplyBusy] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/consultancy");
      const json = (await res.json()) as { cases?: ConsultancyCase[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Could not load cases.");
      setCases(json.cases ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load cases.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    onCases?.(cases.length);
  }, [cases, onCases]);

  async function createCase(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/consultancy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: String(form.get("type") || ""),
          topic: String(form.get("topic") || ""),
          message: String(form.get("message") || ""),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not submit.");
      e.currentTarget.reset();
      setMessage("Request sent. KS Abroad team will reply by email or portal.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReply(caseId: string) {
    const body = (replyText[caseId] || "").trim();
    if (!body) return;
    setReplyBusy(caseId);
    setError("");
    try {
      const res = await fetch(`/api/consultancy/${caseId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not send reply.");
      setReplyText((prev) => ({ ...prev, [caseId]: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reply.");
    } finally {
      setReplyBusy(null);
    }
  }

  return (
    <div className="panel rounded-3xl p-6 md:p-8 space-y-5">
      <div>
        <p className="eyebrow">Stage 3 · Service</p>
        <h2 className="display mt-2 text-3xl">Agreement or session</h2>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Pick a service. An open case unlocks assisted apply. KS Abroad updates the
          status on your file: in progress, applied, pre-enrolment done, or ready for
          the visa file.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          {
            type: "one-to-one",
            topic: "1-to-1 counselling session",
            blurb: "A private session on your shortlist and next step.",
          },
          {
            type: "private-case",
            topic: "Document review",
            blurb: "We check the vault and tell you what is still missing.",
          },
          {
            type: "private-case",
            topic: "Visa file",
            blurb: "FBR returns, insurance, hotel, and flight for the visa file.",
          },
        ].map((service) => (
          <button
            key={service.topic}
            type="button"
            className="rounded-2xl border border-[var(--line)] p-4 text-left hover:border-[rgba(15,106,111,0.35)]"
            onClick={() => {
              const form = document.getElementById("consultancy-form") as HTMLFormElement | null;
              if (!form) return;
              (form.elements.namedItem("type") as HTMLSelectElement).value = service.type;
              (form.elements.namedItem("topic") as HTMLInputElement).value = service.topic;
              form.querySelector("textarea")?.focus();
            }}
          >
            <div className="font-semibold">{service.topic}</div>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{service.blurb}</p>
          </button>
        ))}
      </div>

      {error ? <p className="text-sm font-semibold text-[var(--coral)]">{error}</p> : null}
      {message ? <p className="text-sm font-semibold text-[var(--sea-deep)]">{message}</p> : null}

      <form id="consultancy-form" onSubmit={createCase} className="grid gap-3">
        <select className="select" name="type" defaultValue="one-to-one" required>
          <option value="one-to-one">1-to-1 counselling</option>
          <option value="private-case">Private case review</option>
        </select>
        <input className="input" name="topic" required placeholder="Topic (e.g. Rome master shortlist)" />
        <textarea
          className="textarea min-h-24"
          name="message"
          required
          placeholder="Describe your question, timeline, and documents ready…"
        />
        <button className="btn btn-sea w-fit" type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Submit request"}
        </button>
      </form>

      <div className="space-y-3">
        <div className="eyebrow">Your cases</div>
        {loading ? (
          <p className="text-sm text-[var(--ink-soft)]">Loading…</p>
        ) : cases.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">No consultancy requests yet.</p>
        ) : (
          cases.map((c) => (
            <div key={c.id} className="rounded-2xl border border-[var(--line)] p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{c.topic}</span>
                <span className="text-xs uppercase tracking-wide text-[var(--ink-soft)]">
                  {c.type.replace("-", " ")} · {c.status}
                </span>
                <span className="ml-auto text-xs text-[var(--ink-soft)]">
                  {c.createdAt.slice(0, 10)}
                </span>
              </div>
              <p className="text-sm text-[var(--ink-soft)]">{c.message}</p>
              {c.replies.length > 0 ? (
                <ul className="space-y-2 border-t border-[var(--line)] pt-3">
                  {c.replies.map((r, i) => (
                    <li key={`${r.at}-${i}`} className="text-sm">
                      <span className="font-semibold capitalize">{r.from}</span>
                      <span className="text-xs text-[var(--ink-soft)]"> · {r.at.slice(0, 16).replace("T", " ")}</span>
                      <div className="mt-1">{r.body}</div>
                    </li>
                  ))}
                </ul>
              ) : null}
              {c.status !== "closed" ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <input
                    className="input flex-1 min-w-[12rem]"
                    value={replyText[c.id] || ""}
                    onChange={(e) =>
                      setReplyText((prev) => ({ ...prev, [c.id]: e.target.value }))
                    }
                    placeholder="Add a follow-up message…"
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={replyBusy === c.id}
                    onClick={() => void sendReply(c.id)}
                  >
                    {replyBusy === c.id ? "Sending…" : "Reply"}
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
