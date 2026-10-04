"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "ks_cookie_ack";

export function CookieNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (!localStorage.getItem(KEY)) setOpen(true);
      } catch {
        setOpen(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function accept() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl rounded-2xl border border-[var(--line)] bg-[rgba(255,252,246,0.97)] p-4 shadow-[0_18px_40px_rgba(14,36,48,0.16)] backdrop-blur-md sm:inset-x-auto sm:right-4 sm:left-auto"
    >
      <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
        We use essential cookies for login security only — no ad trackers. Details in our{" "}
        <Link href="/cookies" className="font-semibold text-[var(--sea-deep)] hover:underline">
          Cookie notice
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-semibold text-[var(--sea-deep)] hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
      <div className="mt-3 flex justify-end">
        <button type="button" className="btn btn-sea" onClick={accept}>
          OK
        </button>
      </div>
    </div>
  );
}
