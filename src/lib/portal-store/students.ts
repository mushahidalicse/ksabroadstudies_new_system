import { EMPTY_PROFILE, type StudentDocument, type StudentProfile, type StudentRecord, type StudentConsent } from "@/lib/student-types";
import { ensureSchema, sql } from "@/lib/portal-store/db";

type StudentRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  surname: string;
  date_of_birth: string;
  place_of_birth: string;
  passport_or_cnic: string;
  phone: string;
  current_city: string;
  address: string;
  profile: StudentProfile | string;
  consent: StudentConsent | string | null;
  created_at: Date | string;
};

type DocumentRow = {
  id: string;
  student_id: string;
  kind: StudentDocument["kind"];
  original_name: string;
  stored_name: string;
  uploaded_at: Date | string;
};

type ShortlistRow = {
  student_id: string;
  programme_slug: string;
  saved_at: Date | string;
};

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function asObject<T>(value: T | string | null | undefined): T | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return JSON.parse(value) as T;
  return value;
}

function mapDocument(row: DocumentRow): StudentDocument {
  return {
    id: row.id,
    kind: row.kind,
    originalName: row.original_name,
    storedName: row.stored_name,
    uploadedAt: iso(row.uploaded_at),
  };
}

function assemble(
  row: StudentRow,
  documents: DocumentRow[],
  shortlist: ShortlistRow[],
): StudentRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    name: row.name,
    surname: row.surname ?? "",
    dateOfBirth: row.date_of_birth ?? "",
    placeOfBirth: row.place_of_birth ?? "",
    passportOrCnic: row.passport_or_cnic ?? "",
    phone: row.phone ?? "",
    currentCity: row.current_city ?? "",
    address: row.address ?? "",
    createdAt: iso(row.created_at),
    profile: { ...EMPTY_PROFILE, ...asObject<StudentProfile>(row.profile) },
    documents: documents.map(mapDocument),
    shortlist: shortlist.map((item) => ({
      slug: item.programme_slug,
      savedAt: iso(item.saved_at),
    })),
    consent: asObject<StudentConsent>(row.consent),
  };
}

async function loadChildren(ids: string[]) {
  const db = sql();
  if (ids.length === 0) {
    return { documents: [] as DocumentRow[], shortlist: [] as ShortlistRow[] };
  }
  const documents = await db<DocumentRow[]>`
    SELECT id, student_id, kind, original_name, stored_name, uploaded_at
    FROM student_documents
    WHERE student_id IN ${db(ids)}
    ORDER BY uploaded_at ASC
  `;
  const shortlist = await db<ShortlistRow[]>`
    SELECT student_id, programme_slug, saved_at
    FROM shortlist_items
    WHERE student_id IN ${db(ids)}
    ORDER BY saved_at ASC
  `;
  return { documents, shortlist };
}

function withChildren(rows: StudentRow[], documents: DocumentRow[], shortlist: ShortlistRow[]) {
  return rows.map((row) =>
    assemble(
      row,
      documents.filter((doc) => doc.student_id === row.id),
      shortlist.filter((item) => item.student_id === row.id),
    ),
  );
}

const STUDENT_COLUMNS = `
  id, email, password_hash, name, surname, date_of_birth, place_of_birth,
  passport_or_cnic, phone, current_city, address, profile, consent, created_at
`;

export async function listStudents(): Promise<StudentRecord[]> {
  await ensureSchema();
  const rows = await sql()<StudentRow[]>`
    SELECT ${sql().unsafe(STUDENT_COLUMNS)}
    FROM students
    ORDER BY created_at ASC
  `;
  const children = await loadChildren(rows.map((row) => row.id));
  return withChildren(rows, children.documents, children.shortlist);
}

export async function findStudentById(id: string) {
  await ensureSchema();
  const rows = await sql()<StudentRow[]>`
    SELECT ${sql().unsafe(STUDENT_COLUMNS)}
    FROM students
    WHERE id = ${id}
  `;
  const row = rows[0];
  if (!row) return undefined;
  const children = await loadChildren([row.id]);
  return assemble(row, children.documents, children.shortlist);
}

export async function findStudentByEmail(email: string) {
  await ensureSchema();
  const rows = await sql()<StudentRow[]>`
    SELECT ${sql().unsafe(STUDENT_COLUMNS)}
    FROM students
    WHERE lower(email) = lower(${email.trim()})
  `;
  const row = rows[0];
  if (!row) return undefined;
  const children = await loadChildren([row.id]);
  return assemble(row, children.documents, children.shortlist);
}

export async function saveStudent(next: StudentRecord) {
  await ensureSchema();
  const db = sql();
  const updatedAt = new Date().toISOString();
  await db.begin(async (tx) => {
    const clash = await tx<{ id: string }[]>`
      SELECT id FROM students
      WHERE lower(email) = lower(${next.email}) AND id <> ${next.id}
    `;
    if (clash.length) {
      throw new Error("This email is already registered.");
    }
    await tx`
      INSERT INTO students (
        id, email, password_hash, name, surname, date_of_birth, place_of_birth,
        passport_or_cnic, phone, current_city, address, profile, consent, created_at, updated_at
      ) VALUES (
        ${next.id},
        ${next.email.trim().toLowerCase()},
        ${next.passwordHash},
        ${next.name},
        ${next.surname ?? ""},
        ${next.dateOfBirth ?? ""},
        ${next.placeOfBirth ?? ""},
        ${next.passportOrCnic ?? ""},
        ${next.phone ?? ""},
        ${next.currentCity ?? ""},
        ${next.address ?? ""},
        ${db.json(asObject(next.profile) ?? EMPTY_PROFILE)},
        ${next.consent ? db.json(next.consent) : null},
        ${next.createdAt},
        ${updatedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        surname = EXCLUDED.surname,
        date_of_birth = EXCLUDED.date_of_birth,
        place_of_birth = EXCLUDED.place_of_birth,
        passport_or_cnic = EXCLUDED.passport_or_cnic,
        phone = EXCLUDED.phone,
        current_city = EXCLUDED.current_city,
        address = EXCLUDED.address,
        profile = EXCLUDED.profile,
        consent = EXCLUDED.consent,
        updated_at = EXCLUDED.updated_at
    `;
    await tx`DELETE FROM student_documents WHERE student_id = ${next.id}`;
    for (const doc of next.documents ?? []) {
      await tx`
        INSERT INTO student_documents (id, student_id, kind, original_name, stored_name, uploaded_at)
        VALUES (
          ${doc.id},
          ${next.id},
          ${doc.kind},
          ${doc.originalName},
          ${doc.storedName},
          ${doc.uploadedAt}
        )
      `;
    }
    await tx`DELETE FROM shortlist_items WHERE student_id = ${next.id}`;
    for (const item of next.shortlist ?? []) {
      await tx`
        INSERT INTO shortlist_items (id, student_id, programme_slug, saved_at)
        VALUES (${crypto.randomUUID()}, ${next.id}, ${item.slug}, ${item.savedAt})
        ON CONFLICT (student_id, programme_slug) DO NOTHING
      `;
    }
  });
  return findStudentById(next.id);
}

export async function deleteStudent(id: string) {
  await ensureSchema();
  const db = sql();
  await db.begin(async (tx) => {
    await tx`
      DELETE FROM application_events
      WHERE application_id IN (SELECT id FROM applications WHERE student_id = ${id})
    `;
    await tx`DELETE FROM applications WHERE student_id = ${id}`;
    await tx`
      DELETE FROM consultancy_replies
      WHERE case_id IN (SELECT id FROM consultancy_cases WHERE student_id = ${id})
    `;
    await tx`DELETE FROM consultancy_cases WHERE student_id = ${id}`;
    await tx`DELETE FROM shortlist_items WHERE student_id = ${id}`;
    await tx`DELETE FROM student_documents WHERE student_id = ${id}`;
    await tx`DELETE FROM students WHERE id = ${id}`;
  });
}
