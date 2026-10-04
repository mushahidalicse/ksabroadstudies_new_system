"use client";

import { useEffect, useState } from "react";
import {
  applyAccountItems,
  clearLocalShortlist,
  getAccountSnapshot,
  readShortlist,
  refreshAccountShortlist,
  STORE_EVENT,
  subscribeAccount,
} from "@/lib/programme-store";

export function ShortlistSyncPrompt({ onSynced }: { onSynced?: () => void }) {
  const [localSlugs, setLocalSlugs] = useState<string[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [serverSlugs, setServerSlugs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    const sync = () => {
      const account = getAccountSnapshot();
      setLoggedIn(account.loggedIn);
      setServerSlugs(account.items.map((item) => item.slug));
      setLocalSlugs(readShortlist());
    };
    sync();
    void refreshAccountShortlist().then(sync);
    const stop = subscribeAccount(sync);
    window.addEventListener(STORE_EVENT, sync);
    return () => {
      stop();
      window.removeEventListener(STORE_EVENT, sync);
    };
  }, []);

  const pending = localSlugs.filter((slug) => !serverSlugs.includes(slug));
  if (!loggedIn || pending.length === 0) {
    return done ? <p className="text-sm font-semibold text-[var(--sea-deep)]">{done}</p> : null;
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[rgba(15,106,111,0.06)] px-4 py-3">
      <p className="text-sm font-semibold">You have saved programmes on this device.</p>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">{pending.length} saved here and not yet on your account.</p>
      <button
        type="button"
        className="btn btn-sea mt-3 text-sm"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError("");
          void fetch("/api/portal/shortlist", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slugs: pending }),
          })
            .then(async (res) => {
              const json = (await res.json()) as { items?: Parameters<typeof applyAccountItems>[0]; error?: string };
              if (!res.ok || !json.items) throw new Error(json.error || "Could not sync.");
              applyAccountItems(json.items);
              clearLocalShortlist();
              setDone("Saved programmes are now on your account.");
              onSynced?.();
            })
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : "Could not sync.");
            })
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "Syncing…" : "Sync to My Account"}
      </button>
      {error ? <p className="mt-2 text-sm font-semibold text-[var(--coral)]">{error}</p> : null}
    </div>
  );
}
