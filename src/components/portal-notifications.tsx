"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Notice = {
  id: string;
  category: string;
  title: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function noticeDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function PortalNotifications() {
  const [rows, setRows] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [portalEnabled, setPortalEnabled] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [notes, prefs] = await Promise.all([
      fetch("/api/portal/notifications", { credentials: "same-origin" }),
      fetch("/api/portal/notification-preferences", { credentials: "same-origin" }),
    ]);
    if (notes.status === 401) {
      setMessage("Please log in to see your messages.");
      return;
    }
    const body = (await notes.json()) as { notifications: Notice[]; unread: number };
    setRows(body.notifications);
    setUnread(body.unread);
    if (prefs.ok) {
      const preference = (await prefs.json()) as { portalEnabled: boolean };
      setPortalEnabled(preference.portalEnabled);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function mark(id?: string) {
    await fetch("/api/portal/notifications", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    await load();
  }

  async function savePreference(next: boolean) {
    setPortalEnabled(next);
    await fetch("/api/portal/notification-preferences", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portalEnabled: next }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Portal</p>
          <h1 className="display text-4xl">Notifications</h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">{unread} unread</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-outline text-sm" onClick={() => void mark()}>Mark all read</button>
          <Link className="btn btn-sea text-sm" href="/portal">Back to portal</Link>
        </div>
      </div>
      {message ? <p className="text-sm font-semibold">{message}</p> : null}
      <section className="panel rounded-3xl p-5 space-y-2">
        <h2 className="font-semibold">How KS Abroad can reach you</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={portalEnabled} onChange={(event) => void savePreference(event.target.checked)} />
          Portal reminders
        </label>
        <p className="text-sm text-[var(--ink-soft)]">Email — coming later. WhatsApp — coming later. Nothing is sent outside this portal.</p>
        <p className="text-sm text-[var(--ink-soft)]">Turning reminders off hides new deadline and missing-document reminders. Document, application, and staff messages still appear here.</p>
      </section>
      {rows.length === 0 && message !== "Please log in to see your messages." ? <p className="panel rounded-3xl p-6 text-sm">No messages yet.</p> : null}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="panel rounded-3xl p-5 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--sea-deep)]">{row.category}{row.isRead ? "" : " · Unread"}</p>
            <h2 className="font-semibold">{row.title}</h2>
            <p className="text-sm">{row.message}</p>
            <p className="text-sm text-[var(--ink-soft)]">{noticeDate(row.createdAt)}</p>
            <div className="flex flex-wrap gap-2">
              {row.link ? <Link className="btn btn-outline text-sm" href={row.link}>Open</Link> : null}
              {row.isRead ? null : (
                <button type="button" className="btn btn-outline text-sm" onClick={() => void mark(row.id)}>Mark read</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
