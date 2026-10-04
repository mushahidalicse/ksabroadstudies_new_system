"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CRM_PRIORITIES } from "@/lib/crm-attention";

type Directory = {
  counts: Record<string, number>;
  rows: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    caseOfficer: string;
    priority: string;
    nextAction: string;
    nextActionDue: string | null;
    openTasks: number;
    consultancy: number;
    applications: number;
    reasons: string[];
  }>;
};

type Detail = {
  student: { id: string; name: string; surname: string; email: string; phone: string; currentCity: string };
  completeness: { percent: number; prompts: string[] };
  workflow: { caseOfficer: string; priority: string; nextAction: string; nextActionDue: string | null };
  notes: Array<{ id: string; body: string; createdAt: string }>;
  tasks: Array<{ id: string; title: string; dueDate: string | null; priority: string; status: string }>;
  cases: Array<{ id: string; topic: string; status: string; type: string; message: string }>;
  applications: Array<{ id: string; universityName: string; programName: string; status: string; statusLabel: string; staffNote: string }>;
  documents: { readyCount: number; requiredCount: number; complete: boolean; items: Array<{ label: string; required: boolean; present: boolean }> };
  shortlist: Array<{ slug: string; name: string; universityName: string }>;
  matches: Array<{ slug: string; name: string; universityName: string; category: string; englishLine: string | null }>;
  timeline: Array<{ at: string; kind: string; summary: string }>;
  communication: Array<{ at: string; audience: string; category: string; title: string; message: string }>;
  statuses: Array<{ id: string; label: string }>;
};

function password() {
  return localStorage.getItem("ks-admin-password") || "";
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", "x-admin-password": password(), ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

export function AdminCrm({ studentId }: { studentId?: string }) {
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("");
  const [attention, setAttention] = useState(false);
  const [message, setMessage] = useState("");
  const [officer, setOfficer] = useState("");
  const [level, setLevel] = useState("normal");
  const [nextAction, setNextAction] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [note, setNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [seen, setSeen] = useState("");

  const load = useCallback(async () => {
    if (studentId) {
      const body = await api(`/api/admin/crm?student=${encodeURIComponent(studentId)}`);
      setDetail(body);
      return;
    }
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (priority) params.set("priority", priority);
    if (attention) params.set("attention", "1");
    setDirectory(await api(`/api/admin/crm?${params}`));
  }, [attention, priority, query, studentId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load().catch((error: Error) => setMessage(error.message));
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  if (detail && seen !== detail.student.id) {
    setSeen(detail.student.id);
    setOfficer(detail.workflow.caseOfficer);
    setLevel(detail.workflow.priority);
    setNextAction(detail.workflow.nextAction);
    setNextDue(detail.workflow.nextActionDue ?? "");
  }

  async function send(body: Record<string, unknown>) {
    setMessage("");
    await api("/api/admin/crm", { method: "POST", body: JSON.stringify(body) });
    await load();
  }

  if (!studentId) {
    return (
      <div className="stack">
        <p className="eyebrow">Student CRM</p>
        <h1>Cases</h1>
        <p className="lead">Staff workflow for the students already stored in the local database. Notes here stay off the student portal.</p>
        {directory ? (
          <div className="grid grid-3">
            {Object.entries(directory.counts).map(([key, value]) => (
              <article className="panel" key={key}><strong>{value}</strong><p>{key}</p></article>
            ))}
          </div>
        ) : null}
        <div className="panel row wrap">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, or case officer" />
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="">Priority</option>
            {CRM_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <label><input type="checkbox" checked={attention} onChange={(event) => setAttention(event.target.checked)} /> Needs attention</label>
        </div>
        {message ? <p role="status">{message}</p> : null}
        <div className="stack">
          {directory?.rows.map((row) => (
            <Link className="panel" key={row.id} href={`/admin/crm/${row.id}`}>
              <strong>{row.name || row.email}</strong>
              <p>{row.email}{row.phone ? ` · ${row.phone}` : ""} · {row.caseOfficer || "No case officer"} · {row.priority}</p>
              <p>{row.nextAction || "No next action"}{row.nextActionDue ? ` · due ${row.nextActionDue}` : ""}</p>
              <p>{row.consultancy} active cases · {row.applications} applications · {row.openTasks} open tasks</p>
              {row.reasons.length ? <p>{row.reasons.join(" · ")}</p> : null}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (!detail) return <p>{message || "Loading student case."}</p>;

  return (
    <div className="stack">
      <p><Link href="/admin/crm">All students</Link></p>
      <h1>{`${detail.student.name} ${detail.student.surname}`.trim() || detail.student.email}</h1>
      <p>{detail.student.email} · {detail.student.phone || "No phone"} · {detail.student.currentCity || "City not set"}</p>
      <p>Profile completeness: {detail.completeness.percent}%</p>
      {detail.completeness.prompts.map((prompt) => <p key={prompt}>{prompt}</p>)}
      {message ? <p role="status">{message}</p> : null}
      <form className="panel stack" onSubmit={(event) => {
        event.preventDefault();
        void send({ action: "workflow", studentId, caseOfficer: officer, priority: level, nextAction, nextActionDue: nextDue }).catch((error: Error) => setMessage(error.message));
      }}>
        <h2>Next action</h2>
        <label>Case officer<input value={officer} onChange={(event) => setOfficer(event.target.value)} /></label>
        <label>Priority
          <select value={level} onChange={(event) => setLevel(event.target.value)}>
            {CRM_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>Next action<input value={nextAction} onChange={(event) => setNextAction(event.target.value)} /></label>
        <label>Due date<input type="date" value={nextDue} onChange={(event) => setNextDue(event.target.value)} /></label>
        <button className="btn btn-sea" type="submit">Save workflow</button>
      </form>
      <section className="panel stack">
        <h2>Tasks</h2>
        {detail.tasks.map((task) => (
          <p key={task.id}>
            {task.title} · {task.priority} · {task.status}{task.dueDate ? ` · due ${task.dueDate}` : ""}
            {task.status === "open" ? <button className="btn btn-line" type="button" onClick={() => void send({ action: "complete-task", studentId, taskId: task.id }).catch((error: Error) => setMessage(error.message))}>Mark done</button> : null}
          </p>
        ))}
        <form className="row wrap" onSubmit={(event) => {
          event.preventDefault();
          void send({ action: "task", studentId, title: taskTitle, dueDate: taskDue, priority: "normal" }).then(() => setTaskTitle("")).catch((error: Error) => setMessage(error.message));
        }}>
          <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Task" />
          <input type="date" value={taskDue} onChange={(event) => setTaskDue(event.target.value)} />
          <button className="btn btn-line" type="submit">Add task</button>
        </form>
      </section>
      <section className="panel stack">
        <h2>Student message</h2>
        <p>This is sent to the student portal. It is separate from internal notes. Email and WhatsApp are not used.</p>
        <StudentMessage studentId={studentId} />
      </section>
      <section className="panel stack">
        <h2>Communication with the student</h2>
        {detail.communication.length === 0 ? <p>No student-visible messages yet.</p> : null}
        {detail.communication.map((item) => (
          <p key={`${item.at}-${item.title}`}>
            <strong>{item.category}</strong> · {item.title} · {item.at.slice(0, 16).replace("T", " ")}
            <br />{item.message}
          </p>
        ))}
      </section>
      <section className="panel stack">
        <h2>Internal notes</h2>
        {detail.notes.map((item) => <p key={item.id}>{item.body}</p>)}
        <form onSubmit={(event) => {
          event.preventDefault();
          void send({ action: "note", studentId, body: note }).then(() => setNote("")).catch((error: Error) => setMessage(error.message));
        }}>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Staff only. This is not sent to the student." />
          <button className="btn btn-line" type="submit">Add note</button>
        </form>
      </section>
      <section className="panel stack">
        <h2>Consultancy</h2>
        {detail.cases.length === 0 ? <p>No consultancy case yet.</p> : null}
        {detail.cases.map((item) => (
          <form key={item.id} className="stack" onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void send({ action: "case-reply", caseId: item.id, reply: String(data.get("reply") || "") }).catch((error: Error) => setMessage(error.message));
          }}>
            <p><strong>{item.topic}</strong> · {item.type} · {item.status}</p>
            <p>{item.message}</p>
            <select defaultValue={item.status} onChange={(event) => void send({ action: "case-status", caseId: item.id, status: event.target.value }).catch((error: Error) => setMessage(error.message))}>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="closed">Closed</option>
            </select>
            <textarea name="reply" placeholder="Staff reply. This is visible to the student." />
            <button className="btn btn-line" type="submit">Send reply</button>
          </form>
        ))}
      </section>
      <section className="panel stack">
        <h2>Applications</h2>
        {detail.applications.length === 0 ? <p>No application yet.</p> : null}
        {detail.applications.map((item) => (
          <form key={item.id} className="stack" onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void send({
              action: "application-status",
              applicationId: item.id,
              status: String(data.get("status") || item.status),
              staffNote: String(data.get("staffNote") || ""),
            }).catch((error: Error) => setMessage(error.message));
          }}>
            <p><strong>{item.programName}</strong> · {item.universityName} · {item.statusLabel}</p>
            <select name="status" defaultValue={item.status}>
              {detail.statuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
            </select>
            <textarea name="staffNote" defaultValue={item.staffNote} />
            <button className="btn btn-line" type="submit">Update application</button>
          </form>
        ))}
      </section>
      <section className="panel stack">
        <h2>Documents</h2>
        <p>{detail.documents.readyCount} of {detail.documents.requiredCount} required documents are on file.{detail.documents.complete ? " The required set is complete." : ""}</p>
        {detail.documents.items.filter((item) => item.required || item.present).map((item) => (
          <p key={item.label}>{item.label}: {item.present ? "On file" : "Missing"}</p>
        ))}
      </section>
      <section className="panel stack">
        <h2>Shortlist</h2>
        {detail.shortlist.length === 0 ? <p>No saved programmes.</p> : null}
        {detail.shortlist.map((item) => <p key={item.slug}>{item.name} · {item.universityName}</p>)}
      </section>
      <section className="panel stack">
        <h2>Programme matches</h2>
        {detail.matches.map((item) => (
          <p key={item.slug}>{item.name} · {item.universityName} · {item.category}{item.englishLine ? ` · ${item.englishLine}` : ""}</p>
        ))}
      </section>
      <section className="panel stack">
        <h2>Activity</h2>
        {detail.timeline.map((item) => <p key={`${item.at}-${item.summary}`}>{item.at.slice(0, 16).replace("T", " ")} · {item.summary}</p>)}
      </section>
    </div>
  );
}

function StudentMessage({ studentId }: { studentId: string }) {
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; category: string; title: string; body: string }>>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState("general");
  const [templateCategory, setTemplateCategory] = useState("");
  const [confirmMissing, setConfirmMissing] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void api("/api/admin/communications").then((body) => setTemplates(body.templates ?? [])).catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <form className="stack" onSubmit={(event) => {
      event.preventDefault();
      setStatus("");
      void api("/api/admin/communications", {
        method: "POST",
        body: JSON.stringify({ action: "message", studentId, channel, title, message, templateCategory, confirmMissing, link: "/portal" }),
      }).then(() => {
        setStatus("Message saved in the student portal.");
        setTitle("");
        setMessage("");
        setConfirmMissing(false);
      }).catch((error: Error) => setStatus(error.message));
    }}>
      <select value="" onChange={(event) => {
        const template = templates.find((item) => item.id === event.target.value);
        if (!template) return;
        setTitle(template.title);
        setMessage(template.body);
        setTemplateCategory(template.category);
        setChannel(template.category === "payment" ? "payment" : template.category === "document" ? "document" : "general");
      }}>
        <option value="">Choose a template, then edit it</option>
        {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
      </select>
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
      <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message for the student" />
      <label><input type="checkbox" checked={confirmMissing} onChange={(event) => setConfirmMissing(event.target.checked)} /> Send even if a placeholder is blank</label>
      <button className="btn btn-sea" type="submit">Send to portal</button>
      {status ? <p role="status">{status}</p> : null}
    </form>
  );
}
