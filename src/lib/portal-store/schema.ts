/** Idempotent PostgreSQL schema for portal records. Catalogue programmes stay in JSON. */
export const PORTAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  surname TEXT NOT NULL DEFAULT '',
  date_of_birth TEXT NOT NULL DEFAULT '',
  place_of_birth TEXT NOT NULL DEFAULT '',
  passport_or_cnic TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  current_city TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  consent JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS students_email_lower_idx
  ON students (lower(email));

CREATE TABLE IF NOT EXISTS shortlist_items (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  programme_slug TEXT NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL,
  UNIQUE (student_id, programme_slug)
);

CREATE INDEX IF NOT EXISTS shortlist_items_student_idx
  ON shortlist_items (student_id, saved_at);

CREATE TABLE IF NOT EXISTS student_documents (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS student_documents_student_idx
  ON student_documents (student_id, uploaded_at);

CREATE TABLE IF NOT EXISTS consultancy_cases (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students (id) ON DELETE RESTRICT,
  type TEXT NOT NULL,
  topic TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS consultancy_cases_student_idx
  ON consultancy_cases (student_id, created_at);

CREATE TABLE IF NOT EXISTS consultancy_replies (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES consultancy_cases (id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL,
  from_role TEXT NOT NULL,
  body TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS consultancy_replies_case_idx
  ON consultancy_replies (case_id, at);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students (id) ON DELETE RESTRICT,
  university_id TEXT NOT NULL,
  university_name TEXT NOT NULL,
  program_name TEXT NOT NULL,
  programme_slug TEXT,
  level TEXT NOT NULL DEFAULT '',
  portal_url TEXT NOT NULL DEFAULT '',
  consultancy_case_id TEXT REFERENCES consultancy_cases (id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  staff_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS applications_student_idx
  ON applications (student_id, updated_at);

CREATE TABLE IF NOT EXISTS application_events (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  by_role TEXT NOT NULL,
  note TEXT
);

CREATE INDEX IF NOT EXISTS application_events_application_idx
  ON application_events (application_id, at);

CREATE TABLE IF NOT EXISTS crm_cases (
  student_id TEXT PRIMARY KEY REFERENCES students (id) ON DELETE CASCADE,
  case_officer TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal',
  next_action TEXT NOT NULL DEFAULT '',
  next_action_due DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_notes (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS crm_notes_student_idx
  ON crm_notes (student_id, created_at);

CREATE TABLE IF NOT EXISTS crm_tasks (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS crm_tasks_student_idx
  ON crm_tasks (student_id, status, due_date);

CREATE TABLE IF NOT EXISTS crm_events (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS crm_events_student_idx
  ON crm_events (student_id, at);

CREATE TABLE IF NOT EXISTS research_jobs (
  id TEXT PRIMARY KEY,
  programme_slug TEXT NOT NULL,
  university TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'openai',
  created_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS research_jobs_slug_idx
  ON research_jobs (programme_slug, created_at DESC);

ALTER TABLE research_jobs ALTER COLUMN provider SET DEFAULT 'openai';

CREATE TABLE IF NOT EXISTS research_results (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES research_jobs (id) ON DELETE CASCADE,
  programme_slug TEXT NOT NULL,
  structured_result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  review_status TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS research_results_job_idx
  ON research_results (job_id, created_at DESC);

CREATE TABLE IF NOT EXISTS staff_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_accounts_email_idx
  ON staff_accounts (lower(email));

CREATE TABLE IF NOT EXISTS document_reviews (
  document_id TEXT PRIMARY KEY REFERENCES student_documents (id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  reviewer TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS service_catalog (
  id TEXT PRIMARY KEY,
  kicker TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  consultancy_type TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS student_notifications (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  read_at TIMESTAMPTZ,
  created_by_staff_id TEXT REFERENCES staff_accounts (id) ON DELETE SET NULL,
  dedupe_key TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS student_notifications_student_idx
  ON student_notifications (student_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS student_notifications_dedupe_idx
  ON student_notifications (student_id, dedupe_key)
  WHERE dedupe_key <> '';

CREATE TABLE IF NOT EXISTS notification_preferences (
  student_id TEXT PRIMARY KEY REFERENCES students (id) ON DELETE CASCADE,
  portal_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_audit_log (
  id TEXT PRIMARY KEY,
  staff_id TEXT REFERENCES staff_accounts (id) ON DELETE SET NULL,
  actor_label TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS staff_audit_log_created_idx
  ON staff_audit_log (created_at DESC);

CREATE TABLE IF NOT EXISTS unresolved_records (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  record_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  raw JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, record_id)
);
`;
