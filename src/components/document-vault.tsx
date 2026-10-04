"use client";

import { useState } from "react";
import {
  checklistForLevel,
  filesForSlot,
  levelVaultTitle,
  slotReady,
  VISA_FILE_SLOTS,
  type VaultSlot,
} from "@/lib/document-vault";
import { DOCUMENT_KINDS, type DocumentKind, type PublicStudent } from "@/lib/student-types";

function kindLabel(kind: DocumentKind) {
  return DOCUMENT_KINDS.find((item) => item.id === kind)?.label ?? kind;
}

export function DocumentVault({
  student,
  onUpload,
  onRemove,
  uploading,
  mode = "admission",
  reviews,
}: {
  student: PublicStudent;
  onUpload: (kind: DocumentKind, file: File) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  uploading: boolean;
  mode?: "admission" | "visa";
  reviews?: Record<string, string>;
}) {
  const [busyKind, setBusyKind] = useState<DocumentKind | null>(null);
  const level = student.profile.studyLevel;
  const slots = mode === "visa" ? VISA_FILE_SLOTS : checklistForLevel(level);
  const required = slots.filter((slot) => slot.required);
  const ready = required.filter((slot) => slotReady(student, slot)).length;

  async function pick(slot: VaultSlot, file: File | undefined) {
    if (!file) return;
    setBusyKind(slot.id);
    try {
      await onUpload(slot.id, file);
    } finally {
      setBusyKind(null);
    }
  }

  return (
    <div className="panel rounded-3xl p-6 md:p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{mode === "visa" ? "Stage 7 · Visa file" : "Stage 2 · Documents"}</p>
          <h2 className="display mt-2 text-3xl">
            {mode === "visa" ? "Visa file" : "Document vault"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--ink-soft)]">
            {mode === "visa"
              ? "Pre-enrolment is done. Add the visa-file papers: FBR tax returns, health insurance, hotel booking, and the flight ticket for submission."
              : `${levelVaultTitle(level)}. A star means required. Everything else is optional. PDF, JPG, PNG, or WebP · 8 MB each.`}
          </p>
        </div>
        {mode === "admission" && required.length > 0 ? (
          <p className="text-sm font-bold text-[var(--sea-deep)]">
            {ready}/{required.length} required in the vault
          </p>
        ) : mode === "admission" ? (
          <p className="text-sm font-semibold text-[var(--coral)]">
            Save your current study level above to open the checklist.
          </p>
        ) : null}
      </div>

      {slots.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {slots.map((slot) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              student={student}
              busy={uploading && busyKind === slot.id}
              onPick={(file) => void pick(slot, file)}
              onRemove={onRemove}
              reviews={reviews}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SlotRow({
  slot,
  student,
  busy,
  onPick,
  onRemove,
  reviews,
}: {
  slot: VaultSlot;
  student: PublicStudent;
  busy: boolean;
  onPick: (file: File | undefined) => void;
  onRemove: (id: string) => Promise<void>;
  reviews?: Record<string, string>;
}) {
  const files = filesForSlot(student, slot);
  const badge = files.length > 0 ? "Uploaded" : "Pending";
  return (
    <li className="rounded-2xl border border-dashed border-[var(--line)] p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold">
            {slot.label}
            {slot.required ? " *" : ""}
          </div>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">{slot.detail}</p>
        </div>
        <span
          className={
            files.length > 0
              ? "text-xs font-bold uppercase tracking-wide text-[var(--sea-deep)]"
              : "text-xs font-bold uppercase tracking-wide text-[var(--coral)]"
          }
        >
          {badge}
        </span>
      </div>
      <label className="btn btn-outline text-sm w-fit cursor-pointer">
        {busy ? "Uploading…" : files.length ? "Add another file" : "Choose file · 8 MB"}
        <input
          className="sr-only"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            onPick(file);
          }}
        />
      </label>
      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span>
                <span className="font-semibold">{doc.originalName}</span>
                <span className="ml-2 text-xs uppercase tracking-wide text-[var(--ink-soft)]">
                  {kindLabel(doc.kind)} · {doc.uploadedAt.slice(0, 10)}
                  {reviews?.[doc.id] ? ` · ${reviews[doc.id].replaceAll("_", " ")}` : ""}
                </span>
              </span>
              <button
                type="button"
                className="font-semibold text-[var(--coral)]"
                onClick={() => void onRemove(doc.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
