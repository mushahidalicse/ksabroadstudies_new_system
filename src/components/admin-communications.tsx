"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const PASSWORD_KEY = "ks-admin-password";

type Template = { id: string; name: string; category: string; title: string; body: string; active: boolean };
type Recent = { id: string; studentName: string; type: string; title: string; message: string; isRead: boolean; createdAt: string; actor: string };
type Reminders = {
  overdueTasks: number;
  followUpsDueToday: number;
  documentsNeedingReview: number;
  paymentReviewsPending: number;
  programmesClosingWithin7Days: number;
  unreadNotifications: number;
};

async function call(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const password = localStorage.getItem(PASSWORD_KEY) || "";
  if (password) headers.set("x-admin-password", password);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "include" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

export function AdminCommunications() {
  const [reminders, setReminders] = useState<Reminders | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [legacy, setLegacy] = useState(false);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Template | null>(null);

  const load = useCallback(async () => {
    const body = await call("/api/admin/communications");
    setReminders(body.reminders);
    setRecent(body.recent);
    setTemplates(body.templates);
    setLegacy(body.legacyFallback);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((error: Error) => setMessage(error.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Staff</p>
          <h1 className="display text-4xl">Communications</h1>
        </div>
        <Link className="btn btn-outline text-sm" href="/admin">Admin home</Link>
      </div>
      {legacy ? <p className="text-sm">Legacy local admin fallback is signed in. A named owner account is preferred for audit history.</p> : null}
      <p className="text-sm text-[var(--ink-soft)]">Messages stay in the student portal. Email and WhatsApp are not connected.</p>
      {message ? <p className="text-sm font-semibold">{message}</p> : null}
      {reminders ? (
        <div className="grid gap-3 md:grid-cols-3">
          <article className="panel rounded-3xl p-4"><strong>{reminders.overdueTasks}</strong><p>overdue tasks</p></article>
          <article className="panel rounded-3xl p-4"><strong>{reminders.followUpsDueToday}</strong><p>follow-ups due today</p></article>
          <article className="panel rounded-3xl p-4"><strong>{reminders.documentsNeedingReview}</strong><p>documents waiting for review</p></article>
          <article className="panel rounded-3xl p-4"><strong>{reminders.paymentReviewsPending}</strong><p>payment proofs waiting</p></article>
          <article className="panel rounded-3xl p-4"><strong>{reminders.programmesClosingWithin7Days}</strong><p>shortlisted programmes close within 7 days</p></article>
          <article className="panel rounded-3xl p-4"><strong>{reminders.unreadNotifications}</strong><p>unread student notifications</p></article>
        </div>
      ) : null}
      <section className="space-y-3">
        <h2 className="display text-2xl">Recent portal messages</h2>
        {recent.length === 0 ? <p className="text-sm">No portal messages yet.</p> : null}
        {recent.map((item) => (
          <article key={item.id} className="panel rounded-3xl p-4 text-sm">
            <p className="font-semibold">{item.title}</p>
            <p>{item.message}</p>
            <p className="text-[var(--ink-soft)]">{item.studentName} · {item.type} · {item.isRead ? "read" : "unread"} · {item.actor || "system"} · {item.createdAt.slice(0, 16).replace("T", " ")}</p>
          </article>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="display text-2xl">Templates</h2>
        <p className="text-sm text-[var(--ink-soft)]">Templates are drafts. Nothing is sent until a staff member edits and sends it from a student case.</p>
        {templates.map((template) => (
          <article key={template.id} className="panel rounded-3xl p-4 text-sm space-y-2">
            <p className="font-semibold">{template.name}</p>
            <p className="text-[var(--ink-soft)]">{template.category} · {template.active ? "active" : "inactive"}</p>
            <p>{template.title}</p>
            <p>{template.body}</p>
            <button type="button" className="btn btn-outline text-sm" onClick={() => setDraft(template)}>Edit</button>
          </article>
        ))}
        {draft ? (
          <form className="panel rounded-3xl p-4 space-y-2" onSubmit={(event) => {
            event.preventDefault();
            void call("/api/admin/communications", { method: "POST", body: JSON.stringify({ action: "template", ...draft }) })
              .then(async () => {
                setMessage("Template saved.");
                setDraft(null);
                await load();
              })
              .catch((error: Error) => setMessage(error.message));
          }}>
            <input className="w-full rounded-2xl border border-[var(--line)] px-3 py-2" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            <input className="w-full rounded-2xl border border-[var(--line)] px-3 py-2" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            <textarea className="w-full rounded-2xl border border-[var(--line)] px-3 py-2" value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /> Active</label>
            <button className="btn btn-sea text-sm" type="submit">Save template</button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
