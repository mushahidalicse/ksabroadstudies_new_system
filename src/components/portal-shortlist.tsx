"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShortlistSyncPrompt } from "@/components/shortlist-sync-prompt";
import { finderStatusLabel, type FinderStatus } from "@/lib/deadline-display";
import {
  applyAccountItems,
  getAccountSnapshot,
  refreshAccountShortlist,
  STORE_EVENT,
  subscribeAccount,
  type AccountShortlistItem,
} from "@/lib/programme-store";
import { formatFee, regionLabel } from "@/lib/utils";

type SortKey = "saved" | "deadline" | "university" | "name" | "status";
const STATUS_ORDER = ["open", "closing", "upcoming", "unannounced", "closed"];

export function PortalShortlist() {
  const [account, setAccount] = useState(getAccountSnapshot());
  const [sort, setSort] = useState<SortKey>("saved");
  const [error, setError] = useState("");

  useEffect(() => {
    const sync = () => setAccount(getAccountSnapshot());
    sync();
    void refreshAccountShortlist().then(sync);
    const stop = subscribeAccount(sync);
    window.addEventListener(STORE_EVENT, sync);
    return () => {
      stop();
      window.removeEventListener(STORE_EVENT, sync);
    };
  }, []);

  const rows = useMemo(() => {
    const items = [...account.items];
    items.sort((a, b) => {
      if (sort === "university") return (a.programme?.universityName || "zzz").localeCompare(b.programme?.universityName || "zzz");
      if (sort === "name") return (a.programme?.name || a.slug).localeCompare(b.programme?.name || b.slug);
      if (sort === "status") {
        const left = STATUS_ORDER.indexOf(a.programme?.finderStatus || "");
        const right = STATUS_ORDER.indexOf(b.programme?.finderStatus || "");
        return (left < 0 ? 9 : left) - (right < 0 ? 9 : right);
      }
      if (sort === "deadline") return (a.programme?.deadline || "9999-99-99").localeCompare(b.programme?.deadline || "9999-99-99");
      return b.savedAt.localeCompare(a.savedAt);
    });
    return items;
  }, [account.items, sort]);

  if (!account.ready || !account.loggedIn) return null;

  return (
    <section className="panel rounded-3xl p-5 md:p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Saved programmes</p>
          <h2 className="display mt-2 text-3xl">My Shortlist</h2>
        </div>
        <label className="text-sm font-semibold">
          Sort
          <select className="select mt-1" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="saved">Recently saved</option>
            <option value="deadline">Deadline</option>
            <option value="university">University</option>
            <option value="name">Programme name</option>
            <option value="status">Status</option>
          </select>
        </label>
      </div>
      <ShortlistSyncPrompt />
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)]">
          No programmes on your account yet.{" "}
          <Link href="/programs/find" className="font-semibold text-[var(--sea-deep)] hover:underline">Explore Programmes</Link>
        </p>
      ) : (
        <div className="grid gap-3">
          {rows.map((item) => (
            <article key={item.slug} className="rounded-2xl border border-[var(--line)] p-4">
              {item.programme ? (
                <>
                  <h3 className="font-bold leading-tight">{item.programme.name}</h3>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    {item.programme.universityName}
                    {item.programme.city ? ` · ${item.programme.city}` : ""}
                    {item.programme.region ? ` · ${regionLabel(item.programme.region)}` : ""}
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    {finderStatusLabel(item.programme.finderStatus as FinderStatus)} · {item.programme.deadlineLabel}
                    {item.programme.countdown ? ` · ${item.programme.countdown}` : ""} · {formatFee(item.programme.applicationFeeEuro)}
                  </p>
                </>
              ) : (
                <p className="text-sm">This programme is no longer in the catalogue.</p>
              )}
              <p className="mt-1 text-xs text-[var(--ink-soft)]">Saved {item.savedAt.slice(0, 10)}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold">
                <Link href={`/programs/p/${item.slug}`} className="text-[var(--sea-deep)] hover:underline">View programme</Link>
                <button
                  type="button"
                  className="text-[var(--coral)]"
                  onClick={() => {
                    setError("");
                    void fetch("/api/portal/shortlist", {
                      method: "DELETE",
                      credentials: "same-origin",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ slug: item.slug }),
                    }).then(async (res) => {
                      const json = (await res.json()) as { items?: AccountShortlistItem[]; error?: string };
                      if (!res.ok || !json.items) {
                        setError(json.error || "Could not remove that programme.");
                        return;
                      }
                      applyAccountItems(json.items);
                    });
                  }}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {error ? <p className="text-sm font-semibold text-[var(--coral)]">{error}</p> : null}
    </section>
  );
}
