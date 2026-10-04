"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { SITE } from "@/lib/site";

type Status = "idle" | "sending" | "ok" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setError("");

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") || "").trim(),
          email: String(data.get("email") || "").trim(),
          phone: String(data.get("phone") || "").trim(),
          purpose: String(data.get("purpose") || "").trim(),
          message: String(data.get("message") || "").trim(),
          website: String(data.get("website") || ""),
          contactConsent: data.get("contactConsent") === "on",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Could not send message.");
      }
      setStatus("ok");
      form.reset();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not send message.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      {/* Honeypot — leave empty */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="input"
          name="name"
          required
          maxLength={80}
          placeholder="Your name"
          autoComplete="name"
        />
        <input
          className="input"
          name="phone"
          maxLength={30}
          placeholder="WhatsApp (with country code)"
          autoComplete="tel"
        />
      </div>
      <input
        className="input"
        name="email"
        type="email"
        required
        maxLength={120}
        placeholder="Email"
        autoComplete="email"
      />
      <select className="select" name="purpose" required defaultValue="">
        <option value="" disabled>
          Purpose of inquiry
        </option>
        <option>University shortlisting</option>
        <option>Bachelor / CEnT-S guidance</option>
        <option>Master&apos;s application</option>
        <option>Medicine / IMAT</option>
        <option>Scholarship guidance</option>
        <option>Visa / Universitaly</option>
        <option>B2B / agency collaboration</option>
      </select>
      <textarea
        className="textarea min-h-28"
        name="message"
        required
        maxLength={2000}
        placeholder="CGPA, English proof, bachelor/master/medicine, city preference"
      />

      <label className="flex items-start gap-2 text-sm text-[var(--ink-soft)]">
        <input name="contactConsent" type="checkbox" required className="mt-1" />
        <span>
          I consent to KS Abroad Studies using my contact details to reply to this
          inquiry, as described in the{" "}
          <a href="/privacy" className="font-semibold text-[var(--sea-deep)] hover:underline">
            Privacy Policy
          </a>
          .
        </span>
      </label>

      <button
        type="submit"
        className="btn btn-sea w-full sm:w-auto"
        disabled={status === "sending"}
      >
        {status === "sending" ? "Sending…" : "Send to KS Abroad"}
        <Send size={16} />
      </button>

      {status === "ok" && (
        <p className="text-sm font-semibold text-[var(--sea-deep)]">
          Message sent to {SITE.email}. We&apos;ll reply soon — WhatsApp is fastest
          for urgent questions.
        </p>
      )}
      {status === "error" && (
        <p className="text-sm font-semibold text-[var(--coral)]">
          {error} You can also email{" "}
          <a href={SITE.emailUrl} className="underline">
            {SITE.email}
          </a>{" "}
          or use WhatsApp.
        </p>
      )}
    </form>
  );
}
