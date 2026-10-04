"use client";

import type { CatalogueCard } from "@/lib/programme-catalogue";

export const SHORTLIST_KEY = "ks-programme-shortlist";
export const COMPARE_KEY = "ks-programme-compare";
export const STORE_EVENT = "ks-programme-store";

function read(key: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string").slice(0, key === COMPARE_KEY ? 4 : 40);
  } catch {
    return [];
  }
}

function write(key: string, slugs: string[]) {
  localStorage.setItem(key, JSON.stringify(slugs));
  window.dispatchEvent(new Event(STORE_EVENT));
}

export function readShortlist() {
  return read(SHORTLIST_KEY);
}

export function readCompare() {
  return read(COMPARE_KEY);
}

export function replaceStored(key: string, slugs: string[]) {
  const max = key === COMPARE_KEY ? 4 : 40;
  write(key, slugs.slice(0, max));
}

export function toggleStored(key: string, slug: string, max = 40) {
  const current = read(key);
  if (current.includes(slug)) {
    write(key, current.filter((item) => item !== slug));
    return { ok: true as const, slugs: current.filter((item) => item !== slug) };
  }
  if (current.length >= max) {
    return {
      ok: false as const,
      slugs: current,
      error: max <= 4 ? `You can compare ${max} programmes at a time.` : `You can save ${max} programmes.`,
    };
  }
  const next = [...current, slug];
  write(key, next);
  return { ok: true as const, slugs: next };
}

export function clearLocalShortlist() {
  write(SHORTLIST_KEY, []);
}

export type AccountShortlistItem = {
  slug: string;
  savedAt: string;
  programme: CatalogueCard | null;
};

type AccountSnapshot = {
  ready: boolean;
  loggedIn: boolean;
  items: AccountShortlistItem[];
};

let accountSnapshot: AccountSnapshot = { ready: false, loggedIn: false, items: [] };
let accountLoad: Promise<AccountSnapshot> | null = null;
const accountListeners = new Set<() => void>();

function publish(next: AccountSnapshot) {
  accountSnapshot = next;
  accountListeners.forEach((listener) => listener());
  window.dispatchEvent(new Event(STORE_EVENT));
}

export function subscribeAccount(listener: () => void) {
  accountListeners.add(listener);
  return () => {
    accountListeners.delete(listener);
  };
}

export function getAccountSnapshot() {
  return accountSnapshot;
}

export async function refreshAccountShortlist() {
  if (!accountLoad) {
    accountLoad = fetch("/api/portal/shortlist", { credentials: "same-origin" })
      .then(async (res) => {
        if (res.status === 401) return { ready: true, loggedIn: false, items: [] as AccountShortlistItem[] };
        if (!res.ok) return accountSnapshot.loggedIn ? accountSnapshot : { ready: true, loggedIn: false, items: [] as AccountShortlistItem[] };
        const json = (await res.json()) as { items?: AccountShortlistItem[] };
        return { ready: true, loggedIn: true, items: json.items ?? [] };
      })
      .catch(() => ({ ready: true, loggedIn: false, items: [] as AccountShortlistItem[] }))
      .then((next) => {
        accountLoad = null;
        publish(next);
        return next;
      });
  }
  return accountLoad;
}

export function applyAccountItems(items: AccountShortlistItem[]) {
  publish({ ready: true, loggedIn: true, items });
}

