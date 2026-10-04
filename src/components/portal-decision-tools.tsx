"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { profileCompleteness } from "@/lib/matching/profile-completeness";
import type { StudentProfile } from "@/lib/student-types";

export function PortalDecisionTools({
  profile,
  onProfile,
}: {
  profile: StudentProfile;
  onProfile?: () => void;
}) {
  const completeness = profileCompleteness(profile);
  const [shortlistCount, setShortlistCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/portal/shortlist", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { items?: unknown[] };
        if (!cancelled) setShortlistCount(json.items?.length ?? 0);
      })
      .catch(() => {
        if (!cancelled) setShortlistCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    { href: "/portal", title: `Profile ${completeness.percent}% complete`, text: completeness.prompts[0] || "The main matching fields are filled.", profile: true },
    { href: "/portal/matches", title: "Programme matches", text: "View explainable matches from the current catalogue." },
    { href: "/programs/shortlist", title: shortlistCount == null ? "My Shortlist" : `My Shortlist: ${shortlistCount}`, text: "Open the programmes saved to your account." },
    { href: "/scholarships/find", title: "Scholarship finder", text: "Check stored regional scholarship records." },
    { href: "/tools/italy-cost-calculator", title: "Cost calculator", text: "Estimate first-year costs in EUR." },
  ];

  return (
    <section aria-label="Decision tools" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) =>
        "profile" in card && card.profile && onProfile ? (
          <button key={card.title} type="button" className="panel rounded-3xl p-4 text-left hover:border-[var(--sea)]" onClick={onProfile}>
            <h2 className="text-base font-bold">{card.title}</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{card.text}</p>
          </button>
        ) : (
          <Link key={card.href} href={card.href} className="panel rounded-3xl p-4 hover:border-[var(--sea)]">
            <h2 className="text-base font-bold">{card.title}</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{card.text}</p>
          </Link>
        ),
      )}
    </section>
  );
}
