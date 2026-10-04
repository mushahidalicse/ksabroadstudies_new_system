"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(data.get("email") || "").trim(),
          password: String(data.get("password") || ""),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not log in.");
      router.push("/portal");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log in.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        className="input"
        name="email"
        type="email"
        required
        maxLength={120}
        placeholder="Email"
        autoComplete="email"
      />
      <input
        className="input"
        name="password"
        type="password"
        required
        placeholder="Password"
        autoComplete="current-password"
      />
      {error ? (
        <p className="text-sm font-semibold text-[var(--coral)]">{error}</p>
      ) : null}
      <button className="btn btn-sea w-full" type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Log in"}
      </button>
      <p className="text-sm text-[var(--ink-soft)]">
        New student?{" "}
        <Link href="/register" className="font-semibold text-[var(--sea-deep)] hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
