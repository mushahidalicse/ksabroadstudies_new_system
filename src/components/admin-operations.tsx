"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { STAFF_ROLES } from "@/lib/staff-roles";

const PASSWORD_KEY = "ks-admin-password";

type Doc = {
  id: string;
  studentId: string;
  studentName: string;
  email: string;
  kind: string;
  originalName: string;
  uploadedAt: string;
  status: string;
  note: string;
};

type Service = {
  id: string;
  kicker: string;
  title: string;
  detail: string;
  consultancyType: string;
  active: boolean;
};

type Staff = { id: string; email: string; name: string; role: string; active: boolean };

async function call(path: string, init?: RequestInit) {
  const password = localStorage.getItem(PASSWORD_KEY) || "";
  const headers = new Headers(init?.headers);
  if (password) headers.set("x-admin-password", password);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(path, { ...init, headers, credentials: "include" });
}

export function AdminOperations() {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [payments, setPayments] = useState<Doc[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [access, setAccess] = useState({ documents: false, payments: false, services: false });
  const [tab, setTab] = useState<"documents" | "payments" | "services" | "team">("documents");
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const load = useCallback(async () => {
    const [docs, pays, catalog, team] = await Promise.all([
      call("/api/admin/operations?queue=documents"),
      call("/api/admin/operations?queue=payments"),
      call("/api/admin/operations?queue=services"),
      call("/api/admin/staff"),
    ]);
    setLocked(docs.status === 401 && pays.status === 401 && catalog.status === 401 && team.status === 401);
    setAccess({ documents: docs.ok, payments: pays.ok, services: catalog.ok });
    if (docs.ok) setDocuments(((await docs.json()) as { documents: Doc[] }).documents);
    if (pays.ok) setPayments(((await pays.json()) as { documents: Doc[] }).documents);
    if (catalog.ok) setServices(((await catalog.json()) as { services: Service[] }).services);
    if (team.ok) setStaff(((await team.json()) as { staff: Staff[] }).staff);
    else setStaff(null);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function login() {
    setMessage("");
    const res = await call("/api/admin/staff", {
      method: "POST",
      body: JSON.stringify({ action: "login", email, password }),
    });
    if (!res.ok) {
      setMessage("Email or password is not recognised.");
      return;
    }
    setPassword("");
    await load();
  }

  async function review(documentId: string, status: string, note: string) {
    setMessage("");
    const res = await call("/api/admin/operations", {
      method: "POST",
      body: JSON.stringify({ action: "review", documentId, status, note }),
    });
    setMessage(res.ok ? "Review saved." : "Could not save that review.");
    if (res.ok) await load();
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Staff desk</p>
          <h1 className="display text-4xl">Documents, services, and payment proof</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--ink-soft)]">The shared admin password remains a legacy local admin fallback. A named owner account is preferred.</p>
        </div>
        <Link className="btn btn-outline text-sm" href="/admin">Admin home</Link>
      </div>
      {locked ? (
        <section className="panel rounded-3xl p-6 space-y-3">
          <h2 className="display text-2xl">Team login</h2>
          <p className="text-sm text-[var(--ink-soft)]">Use a staff email, or open this desk from Admin home with the existing password.</p>
          <input className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
          <input className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
          <button type="button" className="btn btn-sea" onClick={() => void login()}>Sign in</button>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {(["documents", "payments", "services", "team"] as const).map((item) => (
              <button key={item} type="button" className={tab === item ? "btn btn-sea text-sm" : "btn btn-outline text-sm"} onClick={() => setTab(item)}>
                {item}
              </button>
            ))}
          </div>
          {message ? <p className="text-sm font-semibold">{message}</p> : null}
          {tab === "documents" ? access.documents ? <Queue rows={documents} onReview={review} /> : <p className="panel rounded-3xl p-6 text-sm">This role does not review vault documents.</p> : null}
          {tab === "payments" ? access.payments ? <Queue rows={payments} onReview={review} payment /> : <p className="panel rounded-3xl p-6 text-sm">This role does not review payment proof.</p> : null}
          {tab === "services" ? access.services ? <Services rows={services} onSaved={load} onMessage={setMessage} /> : <p className="panel rounded-3xl p-6 text-sm">This role does not edit services.</p> : null}
          {tab === "team" ? <Team rows={staff} onSaved={load} onMessage={setMessage} /> : null}
        </>
      )}
    </main>
  );
}

function Queue({ rows, onReview, payment = false }: { rows: Doc[]; onReview: (id: string, status: string, note: string) => Promise<void>; payment?: boolean }) {
  return (
    <section className="space-y-3">
      <p className="text-sm text-[var(--ink-soft)]">
        {payment
          ? "This checks an uploaded first-installment screenshot. It does not take a card payment."
          : "Accept, ask for a replacement, or reject a file already in the student vault."}
      </p>
      {rows.length === 0 ? <p className="panel rounded-3xl p-6 text-sm">Nothing in this queue.</p> : null}
      {rows.map((row) => (
        <article key={row.id} className="panel rounded-3xl p-5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{row.originalName}</h2>
              <p className="text-sm text-[var(--ink-soft)]">{row.studentName} · {row.email} · {row.kind} · {row.status.replaceAll("_", " ")}</p>
            </div>
            <a className="btn btn-outline text-sm" href={`/api/admin/operations/file?id=${encodeURIComponent(row.id)}`}>Open file</a>
          </div>
          <ReviewForm initialNote={row.note} onSave={(status, note) => onReview(row.id, status, note)} />
          <StudentFileMessage studentId={row.studentId} channel={payment ? "payment" : "document"} />
        </article>
      ))}
    </section>
  );
}

function ReviewForm({ initialNote, onSave }: { initialNote: string; onSave: (status: string, note: string) => void }) {
  const [status, setStatus] = useState("accepted");
  const [note, setNote] = useState(initialNote);
  return (
    <div className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
      <select className="rounded-2xl border border-[var(--line)] px-3 py-2" value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="accepted">Accepted</option>
        <option value="needs_replacement">Needs replacement</option>
        <option value="rejected">Rejected</option>
        <option value="pending">Pending</option>
      </select>
      <input className="rounded-2xl border border-[var(--line)] px-3 py-2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note for the file" />
      <button type="button" className="btn btn-sea text-sm" onClick={() => onSave(status, note)}>Save review</button>
    </div>
  );
}

function Services({ rows, onSaved, onMessage }: { rows: Service[]; onSaved: () => Promise<void>; onMessage: (value: string) => void }) {
  return (
    <section className="space-y-3">
      <p className="text-sm text-[var(--ink-soft)]">These are the services a student can choose. Turning one off does not close an existing consultancy case.</p>
      {rows.map((service) => (
        <ServiceRow key={service.id} service={service} onSaved={onSaved} onMessage={onMessage} />
      ))}
    </section>
  );
}

function ServiceRow({ service, onSaved, onMessage }: { service: Service; onSaved: () => Promise<void>; onMessage: (value: string) => void }) {
  const [title, setTitle] = useState(service.title);
  const [detail, setDetail] = useState(service.detail);
  const [active, setActive] = useState(service.active);
  return (
    <article className="panel rounded-3xl p-5 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--sea-deep)]">{service.kicker} · {service.consultancyType}</p>
      <input className="w-full rounded-2xl border border-[var(--line)] px-3 py-2" value={title} onChange={(event) => setTitle(event.target.value)} />
      <textarea className="w-full rounded-2xl border border-[var(--line)] px-3 py-2" value={detail} onChange={(event) => setDetail(event.target.value)} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active for new cases</label>
      <button
        type="button"
        className="btn btn-sea text-sm"
        onClick={() => {
          void call("/api/admin/operations", {
            method: "POST",
            body: JSON.stringify({ action: "service", id: service.id, kicker: service.kicker, title, detail, active }),
          }).then(async (res) => {
            onMessage(res.ok ? "Service saved." : "Could not save that service.");
            if (res.ok) await onSaved();
          });
        }}
      >
        Save service
      </button>
    </article>
  );
}

function Team({ rows, onSaved, onMessage }: { rows: Staff[] | null; onSaved: () => Promise<void>; onMessage: (value: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof STAFF_ROLES)[number]>("case_officer");
  if (!rows) return <p className="panel rounded-3xl p-6 text-sm">Only an owner can manage staff accounts.</p>;
  return (
    <section className="space-y-4">
      <article className="panel rounded-3xl p-5 space-y-3">
        <h2 className="display text-2xl">New staff account</h2>
        <input className="w-full rounded-2xl border border-[var(--line)] px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />
        <input className="w-full rounded-2xl border border-[var(--line)] px-3 py-2" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
        <input className="w-full rounded-2xl border border-[var(--line)] px-3 py-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
        <select className="rounded-2xl border border-[var(--line)] px-3 py-2" value={role} onChange={(event) => setRole(event.target.value as (typeof STAFF_ROLES)[number])}>
          {STAFF_ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button
          type="button"
          className="btn btn-sea text-sm"
          onClick={() => {
            void call("/api/admin/staff", {
              method: "POST",
              body: JSON.stringify({ action: "create", name, email, password, role }),
            }).then(async (res) => {
              onMessage(res.ok ? "Staff account created." : "Could not create that account.");
              if (res.ok) {
                setPassword("");
                await onSaved();
              }
            });
          }}
        >
          Create account
        </button>
      </article>
      {rows.map((member) => (
        <article key={member.id} className="panel rounded-3xl p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{member.name || member.email}</h2>
            <p className="text-sm text-[var(--ink-soft)]">{member.email} · {member.role} · {member.active ? "active" : "inactive"}</p>
          </div>
          <button
            type="button"
            className="btn btn-outline text-sm"
            onClick={() => {
              void call("/api/admin/staff", {
                method: "POST",
                body: JSON.stringify({ action: "active", id: member.id, active: !member.active }),
              }).then(async (res) => {
                onMessage(res.ok ? "Staff access updated." : "Could not update that account.");
                if (res.ok) await onSaved();
              });
            }}
          >
            {member.active ? "Deactivate" : "Activate"}
          </button>
        </article>
      ))}
    </section>
  );
}

function StudentFileMessage({ studentId, channel }: { studentId: string; channel: "document" | "payment" }) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  return (
    <form className="grid gap-2 md:grid-cols-[1fr_auto]" onSubmit={(event) => {
      event.preventDefault();
      void call("/api/admin/communications", {
        method: "POST",
        body: JSON.stringify({
          action: "message",
          studentId,
          channel,
          templateCategory: channel,
          title: channel === "payment" ? "Payment update" : "Document update",
          message,
          link: "/portal",
          confirmMissing: true,
        }),
      }).then(async (res) => {
        setStatus(res.ok ? "Portal message saved." : "Could not send that message.");
        if (res.ok) setMessage("");
      });
    }}>
      <input className="rounded-2xl border border-[var(--line)] px-3 py-2" value={message} onChange={(event) => setMessage(event.target.value)} placeholder={channel === "payment" ? "Message about this payment proof" : "Message about this document"} />
      <button className="btn btn-outline text-sm" type="submit">Send to portal</button>
      {status ? <p className="text-sm md:col-span-2">{status}</p> : null}
    </form>
  );
}
