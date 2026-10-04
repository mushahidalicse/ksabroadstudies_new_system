"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProgrammeResult } from "@/components/programme-result";
import { ShortlistSyncPrompt } from "@/components/shortlist-sync-prompt";
import { dedupeResolvedSlugs, resolveCatalogueSlug, type CatalogueCard } from "@/lib/programme-catalogue";
import {
  applyAccountItems,
  getAccountSnapshot,
  readShortlist,
  refreshAccountShortlist,
  replaceStored,
  SHORTLIST_KEY,
  STORE_EVENT,
  subscribeAccount,
  toggleStored,
  type AccountShortlistItem,
} from "@/lib/programme-store";
type SortKey = "saved" | "deadline" | "university" | "name" | "status";

const STATUS_ORDER = ["open", "closing", "upcoming", "unannounced", "closed"];

function sortItems(items: AccountShortlistItem[], sort: SortKey) {
  const rows = [...items];
  rows.sort((a, b) => {
    if (sort === "saved") return b.savedAt.localeCompare(a.savedAt);
    if (sort === "university") return (a.programme?.universityName || "zzz").localeCompare(b.programme?.universityName || "zzz");
    if (sort === "name") return (a.programme?.name || a.slug).localeCompare(b.programme?.name || b.slug);
    if (sort === "status") {
      const left = STATUS_ORDER.indexOf(a.programme?.finderStatus || "closed");
      const right = STATUS_ORDER.indexOf(b.programme?.finderStatus || "closed");
      return (left < 0 ? 9 : left) - (right < 0 ? 9 : right);
    }
    const left = a.programme?.deadline || "9999-99-99";
    const right = b.programme?.deadline || "9999-99-99";
    return left.localeCompare(right);
  });
  return rows;
}

export function ShortlistBoard({ programmes }: { programmes: CatalogueCard[] }) {
  const [slugs, setSlugs] = useState<string[] | null>(null);
  const [account, setAccount] = useState(getAccountSnapshot());
  const [sort, setSort] = useState<SortKey>("saved");

  useEffect(() => {
    const sync = () => {
      const stored = readShortlist();
      const resolved = dedupeResolvedSlugs(programmes, stored);
      if (resolved.join("|") !== stored.join("|")) {
        replaceStored(SHORTLIST_KEY, resolved);
        return;
      }
      setSlugs(resolved);
      setAccount(getAccountSnapshot());
    };
    sync();
    void refreshAccountShortlist().then(sync);
    const stop = subscribeAccount(sync);
    window.addEventListener(STORE_EVENT, sync);
    return () => {
      stop();
      window.removeEventListener(STORE_EVENT, sync);
    };
  }, [programmes]);

  const localItems = useMemo<AccountShortlistItem[]>(() => {
    if (!slugs) return [];
    return slugs.map((slug) => {
      const resolved = resolveCatalogueSlug(programmes, slug);
      return {
        slug: resolved,
        savedAt: "",
        programme: programmes.find((item) => item.slug === resolved) ?? null,
      };
    });
  }, [programmes, slugs]);

  if (!slugs || !account.ready) return <div className="panel h-40 rounded-3xl" aria-busy="true" />;

  const source = account.loggedIn ? account.items : [...localItems].reverse();
  const rows = sortItems(source, sort);

  return (
    <div className="space-y-4">
      <ShortlistSyncPrompt />
      {!account.loggedIn ? (
        <p className="text-sm text-[var(--ink-soft)]">
          This list stays on this device.{" "}
          <Link href="/login" className="font-semibold text-[var(--sea-deep)] hover:underline">Log in</Link>
          {" "}or{" "}
          <Link href="/register" className="font-semibold text-[var(--sea-deep)] hover:underline">register</Link>
          {" "}to keep it on your account.
        </p>
      ) : null}
      {rows.length === 0 ? (
        account.loggedIn && slugs.length > 0 ? null : (
          <div className="panel rounded-3xl p-6 md:p-8">
            <h2 className="display text-3xl">You haven&apos;t saved any programmes yet.</h2>
            <Link href="/programs/find" className="btn btn-sea mt-5">Explore Programmes</Link>
          </div>
        )
      ) : (
        <>
          <label className="block max-w-xs text-sm font-semibold">
            Sort
            <select className="select mt-1" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              <option value="saved">Recently saved</option>
              <option value="deadline">Deadline</option>
              <option value="university">University</option>
              <option value="name">Programme name</option>
              <option value="status">Status</option>
            </select>
          </label>
          {rows.map((item) => {
            return (
              <div key={item.slug} className="space-y-2">
                {item.programme ? (
                  <ProgrammeResult programme={item.programme} />
                ) : (
                  <article className="panel rounded-3xl p-5">
                    <h2 className="display text-2xl">Programme no longer listed</h2>
                    <p className="mt-2 text-sm text-[var(--ink-soft)]">This saved programme is no longer in the catalogue.</p>
                  </article>
                )}
                {item.savedAt ? <p className="text-xs text-[var(--ink-soft)]">Saved {item.savedAt.slice(0, 10)}</p> : null}
                <button
                  type="button"
                  className="text-sm font-bold text-[var(--coral)]"
                  onClick={() => {
                    if (account.loggedIn) {
                      void fetch("/api/portal/shortlist", {
                        method: "DELETE",
                        credentials: "same-origin",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ slug: item.slug }),
                      }).then(async (res) => {
                        const json = (await res.json()) as { items?: AccountShortlistItem[] };
                        if (res.ok && json.items) applyAccountItems(json.items);
                      });
                      return;
                    }
                    toggleStored(SHORTLIST_KEY, item.slug, 40);
                  }}
                >
                  Remove from shortlist
                </button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
