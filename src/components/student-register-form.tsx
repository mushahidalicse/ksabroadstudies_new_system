"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password") || "");
    const confirm = String(data.get("confirm") || "");
    const privacy = data.get("privacyConsent") === "on";
    const terms = data.get("termsConsent") === "on";
    const marketing = data.get("marketingConsent") === "on";

    if (password !== confirm) {
      setError("Passwords do not match.");
      setBusy(false);
      return;
    }
    if (!privacy || !terms) {
      setError("Please accept the Privacy Policy and Terms to continue.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") || "").trim(),
          surname: String(data.get("surname") || "").trim(),
          dateOfBirth: String(data.get("dateOfBirth") || "").trim(),
          placeOfBirth: String(data.get("placeOfBirth") || "").trim(),
          passportOrCnic: String(data.get("passportOrCnic") || "").trim(),
          phone: String(data.get("phone") || "").trim(),
          currentCity: String(data.get("currentCity") || "").trim(),
          address: String(data.get("address") || "").trim(),
          email: String(data.get("email") || "").trim(),
          password,
          website: String(data.get("website") || ""),
          privacyConsent: privacy,
          termsConsent: terms,
          marketingConsent: marketing,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not register.");
      router.push("/portal");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-[var(--ink)]">
          Name
          <input className="input mt-1 font-normal" name="name" required maxLength={80} autoComplete="given-name" />
        </label>
        <label className="block text-sm font-semibold text-[var(--ink)]">
          Surname
          <input className="input mt-1 font-normal" name="surname" required maxLength={80} autoComplete="family-name" />
        </label>
        <label className="block text-sm font-semibold text-[var(--ink)]">
          Date of birth
          <input className="input mt-1 font-normal" name="dateOfBirth" required maxLength={20} placeholder="DD-MM-YYYY" />
        </label>
        <label className="block text-sm font-semibold text-[var(--ink)]">
          Place of birth
          <input className="input mt-1 font-normal" name="placeOfBirth" required maxLength={80} />
        </label>
        <label className="block text-sm font-semibold text-[var(--ink)] sm:col-span-2">
          Passport / CNIC number
          <input className="input mt-1 font-normal" name="passportOrCnic" required maxLength={40} />
        </label>
        <label className="block text-sm font-semibold text-[var(--ink)]">
          WhatsApp / phone
          <input className="input mt-1 font-normal" name="phone" required maxLength={30} autoComplete="tel" />
        </label>
        <label className="block text-sm font-semibold text-[var(--ink)]">
          Current city
          <input className="input mt-1 font-normal" name="currentCity" required maxLength={80} />
        </label>
        <label className="block text-sm font-semibold text-[var(--ink)] sm:col-span-2">
          Address
          <input className="input mt-1 font-normal" name="address" required maxLength={240} autoComplete="street-address" />
        </label>
      </div>
      <label className="block text-sm font-semibold text-[var(--ink)]">
        Email
        <input
          className="input mt-1 font-normal"
          name="email"
          type="email"
          required
          maxLength={120}
          autoComplete="email"
        />
      </label>
      <label className="block text-sm font-semibold text-[var(--ink)]">
        Password
        <input
          className="input mt-1 font-normal"
          name="password"
          type="password"
          required
          minLength={10}
          placeholder="10+ characters, letters and numbers"
          autoComplete="new-password"
        />
      </label>
      <label className="block text-sm font-semibold text-[var(--ink)]">
        Confirm password
        <input
          className="input mt-1 font-normal"
          name="confirm"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </label>

      <label className="flex items-start gap-2 text-sm text-[var(--ink-soft)]">
        <input name="privacyConsent" type="checkbox" required className="mt-1" />
        <span>
          I have read and agree to the{" "}
          <Link href="/privacy" className="font-semibold text-[var(--sea-deep)] hover:underline" target="_blank">
            Privacy Policy
          </Link>
          . I consent to KS Abroad Studies collecting and processing my personal data
          (profile, contact details, and documents I upload) to provide portal and
          consultancy services.
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm text-[var(--ink-soft)]">
        <input name="termsConsent" type="checkbox" required className="mt-1" />
        <span>
          I agree to the{" "}
          <Link href="/agreement" className="font-semibold text-[var(--sea-deep)] hover:underline" target="_blank">
            Consultancy agreement
          </Link>{" "}
          / terms of use.
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm text-[var(--ink-soft)]">
        <input name="marketingConsent" type="checkbox" className="mt-1" />
        <span>
          Optional: send me WhatsApp / email updates about intakes and scholarships.
          I can unsubscribe anytime.
        </span>
      </label>

      {error ? (
        <p className="text-sm font-semibold text-[var(--coral)]">{error}</p>
      ) : null}
      <button className="btn btn-sea w-full" type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create account"}
      </button>
      <p className="text-sm text-[var(--ink-soft)]">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-[var(--sea-deep)] hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
