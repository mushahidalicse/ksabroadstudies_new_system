"use client";

import { Bookmark, GitCompare, Scale } from "lucide-react";
import { useEffect, useState } from "react";
import {
  applyAccountItems,
  COMPARE_KEY,
  getAccountSnapshot,
  readCompare,
  readShortlist,
  refreshAccountShortlist,
  SHORTLIST_KEY,
  STORE_EVENT,
  subscribeAccount,
  toggleStored,
  type AccountShortlistItem,
} from "@/lib/programme-store";

function useLocalSlugs(read: () => string[]) {
  const [slugs, setSlugs] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setSlugs(read());
    sync();
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [read]);
  return slugs;
}

export function ProgrammeActions({
  slug,
  compact = false,
  saveLabel = "Save",
}: {
  slug: string;
  compact?: boolean;
  saveLabel?: string;
}) {
  const localSaved = useLocalSlugs(readShortlist);
  const compared = useLocalSlugs(readCompare);
  const [account, setAccount] = useState(getAccountSnapshot());
  const [note, setNote] = useState("");

  useEffect(() => {
    const sync = () => setAccount(getAccountSnapshot());
    sync();
    void refreshAccountShortlist();
    const stop = subscribeAccount(sync);
    return () => stop();
  }, []);

  const isSaved = account.loggedIn ? account.items.some((item) => item.slug === slug) : localSaved.includes(slug);
  const isCompared = compared.includes(slug);

  async function toggleSave() {
    setNote("");
    if (account.loggedIn) {
      const res = await fetch("/api/portal/shortlist", {
        method: isSaved ? "DELETE" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const json = (await res.json().catch(() => ({}))) as { items?: AccountShortlistItem[]; error?: string };
      if (res.status === 401) {
        toggleStored(SHORTLIST_KEY, slug, 40);
        return;
      }
      if (!res.ok || !json.items) {
        setNote(json.error || "Could not update the shortlist.");
        return;
      }
      applyAccountItems(json.items);
      return;
    }
    toggleStored(SHORTLIST_KEY, slug, 40);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={`btn text-sm py-2 px-3 ${isSaved ? "btn-sea" : "btn-outline"}`}
        aria-pressed={isSaved}
        onClick={() => void toggleSave()}
      >
        <Bookmark size={14} aria-hidden /> {isSaved ? "Saved" : saveLabel}
      </button>
      <button
        type="button"
        className={`btn text-sm py-2 px-3 ${isCompared ? "btn-sea" : "btn-outline"}`}
        aria-pressed={isCompared}
        onClick={() => {
          const result = toggleStored(COMPARE_KEY, slug, 4);
          setNote(result.ok ? "" : result.error);
        }}
      >
        {compact ? <Scale size={14} aria-hidden /> : <GitCompare size={14} aria-hidden />}
        {isCompared ? "In compare" : "Compare"}
      </button>
      {note ? <p className="text-xs font-semibold text-[var(--coral)]">{note}</p> : null}
    </div>
  );
}
