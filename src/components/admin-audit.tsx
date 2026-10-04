"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const PASSWORD_KEY = "ks-admin-password";

type Row = {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  metadata: Record<string, string | number | boolean | null>;
};

async function loadAudit(query: string) {
  const headers = new Headers();
  const password = localStorage.getItem(PASSWORD_KEY) || "";
  if (password) headers.set("x-admin-password", password);
  const response = await fetch(`/api/admin/audit?${query}`, { headers, credentials: "include" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Unauthorized");
  return body as { rows: Row[]; legacyFallback: boolean };
}

export function AdminAudit() {
  const [rows, setRows] = useState<Row[]>([]);
  const [legacy, setLegacy] = useState(false);
  const [message, setMessage] = useState("");
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (action) params.set("action", action);
    if (entity) params.set("entity", entity);
    const body = await loadAudit(params.toString());
    setRows(body.rows);
    setLegacy(body.legacyFallback);
  }, [action, entity, q]);

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
          <p className="eyebrow">Owner</p>
          <h1 className="display text-4xl">Audit log</h1>
        </div>
        <Link className="btn btn-outline text-sm" href="/admin">Admin home</Link>
      </div>
      {legacy ? <p className="text-sm">You are using the legacy local admin fallback. A named owner account is preferred.</p> : null}
      {message ? <p className="text-sm font-semibold">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <input className="rounded-2xl border border-[var(--line)] px-3 py-2" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search action or record" />
        <input className="rounded-2xl border border-[var(--line)] px-3 py-2" value={action} onChange={(event) => setAction(event.target.value)} placeholder="Action" />
        <input className="rounded-2xl border border-[var(--line)] px-3 py-2" value={entity} onChange={(event) => setEntity(event.target.value)} placeholder="Entity type" />
      </div>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="panel rounded-3xl p-4 text-sm">
            <strong>{row.action}</strong> · {row.actor} · {row.entityType} {row.entityId}
            <p className="text-[var(--ink-soft)]">{row.createdAt.slice(0, 16).replace("T", " ")}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
