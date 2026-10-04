import { existsSync, readFileSync, writeFileSync } from "fs";
import http from "node:http";
import path from "path";
import { loadLocalEnv } from "./load-env";
import { createSessionToken, hashPassword, verifyPassword } from "@/lib/auth";

loadLocalEnv();

const mode = process.argv[2] || "inspect";
const markerPath = path.join(process.cwd(), "data", "pg", "restart-marker.json");
const email = "phase2a5-restart@example.com";
const password = "RestartCheck1";
const slug = "roma-tre-bachelor-international-studies";

function connectionTarget() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) throw new Error("DATABASE_URL is missing.");
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: url.port,
    database: url.pathname.replace(/^\//, ""),
    user: decodeURIComponent(url.username),
  };
}

function request(method: string, urlPath: string, body?: string, cookie?: string) {
  return new Promise<{ status: number; body: string; cookie: string }>((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 43127,
        path: urlPath,
        method,
        headers: {
          Connection: "close",
          Origin: "http://127.0.0.1:43127",
          "Content-Type": "application/json",
          "X-Forwarded-For": "203.0.113.60",
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const setCookie = res.headers["set-cookie"]?.find((value) => value.startsWith("ks_student_session=")) ?? "";
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
            cookie: setCookie.split(";")[0] ?? "",
          });
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const target = connectionTarget();
  const clusterVersion = path.join(process.cwd(), "data", "pg", "cluster", "PG_VERSION");
  const rootVersion = path.join(process.cwd(), "data", "pg", "PG_VERSION");
  const { sql, closeDatabase, ensureSchema } = await import("@/lib/portal-store/db");
  await ensureSchema();
  const identity = await sql()<{ db: string; dir: string; port: number }[]>`
    SELECT current_database() AS db, current_setting('data_directory') AS dir, inet_server_port() AS port
  `;
  const tables = await sql()<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `;
  const counts = await sql()<Record<string, string>[]>`
    SELECT
      (SELECT count(*) FROM students)::text AS students,
      (SELECT count(*) FROM applications)::text AS applications,
      (SELECT count(*) FROM consultancy_cases)::text AS consultancy_cases,
      (SELECT count(*) FROM shortlist_items)::text AS shortlist_items,
      (SELECT count(*) FROM unresolved_records)::text AS unresolved_records
  `;
  const identityRow = identity[0];
  if (!identityRow) throw new Error("Database did not return its identity.");
  if (identityRow.db !== target.database) {
    throw new Error(`Connected to ${identityRow.db}, expected ${target.database}.`);
  }
  if (String(identityRow.port) !== target.port) {
    throw new Error(`Connected to port ${identityRow.port}, expected ${target.port}.`);
  }

  const base = {
    configured: target,
    connectedDatabase: identityRow.db,
    serverPort: identityRow.port,
    dataDirectory: identityRow.dir,
    clusterFile: existsSync(clusterVersion),
    rootDataDirIsCluster: existsSync(rootVersion),
    tables: tables.map((row) => row.table_name),
    counts: counts[0],
  };

  if (mode === "inspect") {
    console.log(JSON.stringify(base, null, 2));
    await closeDatabase();
    return;
  }

  const { upsertStudent, getStudentByEmail, getStudentById, removeStudent, toPublic } = await import("@/lib/students");
  const { addShortlistItem, listShortlist } = await import("@/lib/portal-store/shortlist");
  const { createCase, getCasesForStudent } = await import("@/lib/consultancy");
  const { insertApplication, listApplicationsForStudent } = await import("@/lib/portal-store/applications");
  const { getDatasetFresh } = await import("@/lib/data");
  const { EMPTY_PROFILE } = await import("@/lib/student-types");

  if (mode === "write") {
    const existing = await getStudentByEmail(email);
    if (existing) await removeStudent(existing.id);
    const now = new Date().toISOString();
    const student = await upsertStudent({
      id: crypto.randomUUID(),
      email,
      passwordHash: await hashPassword(password),
      name: "Restart",
      surname: "Check",
      dateOfBirth: "2001-02-03",
      placeOfBirth: "Lahore",
      passportOrCnic: "RESTART-CHECK",
      phone: "+920000000099",
      currentCity: "Lahore",
      address: "Restart check",
      createdAt: now,
      profile: { ...EMPTY_PROFILE, field: "Economics" },
      documents: [],
      shortlist: [],
    });
    const first = await addShortlistItem(student.id, slug);
    const second = await addShortlistItem(student.id, slug);
    if (!first || !("entries" in first) || first.entries.length !== 1) {
      throw new Error("Shortlist create failed.");
    }
    if (!second || !("duplicate" in second) || !second.duplicate) {
      throw new Error("Duplicate shortlist save was not rejected.");
    }
    const opened = await createCase({
      studentId: student.id,
      type: "private-case",
      topic: "Restart check",
      message: "Persist this case.",
    });
    const dataset = await getDatasetFresh();
    const uni = dataset.universities.find((row) => row.id === "university-of-cassino");
    if (!uni) throw new Error("Catalogue university missing.");
    const applicationId = crypto.randomUUID();
    await insertApplication({
      id: applicationId,
      studentId: student.id,
      universityId: uni.id,
      universityName: uni.name,
      programName: "Economics and Business",
      level: "bachelor",
      portalUrl: uni.admissionPortal,
      consultancyCaseId: opened.id,
      status: "requested",
      staffNote: "",
      createdAt: now,
      updatedAt: now,
      history: [{ at: now, status: "requested", by: "student", note: "Restart check" }],
    });
    writeFileSync(
      markerPath,
      JSON.stringify({ studentId: student.id, applicationId, caseId: opened.id, slug }, null, 2),
    );
    console.log(JSON.stringify({ ...base, wrote: true, studentId: student.id }, null, 2));
    await closeDatabase();
    return;
  }

  if (mode === "read" || mode === "api") {
    const marker = JSON.parse(readFileSync(markerPath, "utf8")) as {
      studentId: string;
      applicationId: string;
      caseId: string;
      slug: string;
    };
    const student = await getStudentById(marker.studentId);
    if (!student || student.email !== email) throw new Error("Student did not survive restart.");
    if (!(await verifyPassword(password, student.passwordHash))) {
      throw new Error("Stored password no longer verifies.");
    }
    if ("passwordHash" in toPublic(student)) throw new Error("Public profile leaked the password hash.");
    const shortlist = await listShortlist(student.id);
    if (shortlist?.length !== 1 || shortlist[0]?.slug !== marker.slug) {
      throw new Error("Shortlist did not survive restart as a single slug.");
    }
    const cases = await getCasesForStudent(student.id);
    if (cases.length !== 1 || cases[0]?.id !== marker.caseId) {
      throw new Error("Consultancy case did not survive restart.");
    }
    const apps = await listApplicationsForStudent(student.id);
    if (apps.length !== 1 || apps[0]?.id !== marker.applicationId) {
      throw new Error("Application did not survive restart.");
    }
    const other = await listShortlist(crypto.randomUUID());
    if (other !== null) throw new Error("Unknown student id must not return a shortlist.");

    let api: Record<string, unknown> | undefined;
    if (mode === "api") {
      const login = await request(
        "POST",
        "/api/auth/login",
        JSON.stringify({ email, password }),
      );
      if (login.status !== 200 || !login.cookie) {
        throw new Error(`Login failed: ${login.status} ${login.body}`);
      }
      const listed = await request("GET", "/api/portal/shortlist", undefined, login.cookie);
      const listedJson = JSON.parse(listed.body) as { items?: Array<{ slug: string }> };
      if (listed.status !== 200 || listedJson.items?.length !== 1) {
        throw new Error(`Authenticated shortlist read failed: ${listed.status} ${listed.body}`);
      }
      const removed = await request(
        "DELETE",
        "/api/portal/shortlist",
        JSON.stringify({ slug: marker.slug }),
        login.cookie,
      );
      const removedJson = JSON.parse(removed.body) as { items?: unknown[] };
      if (removed.status !== 200 || (removedJson.items?.length ?? 1) !== 0) {
        throw new Error(`Shortlist delete failed: ${removed.status} ${removed.body}`);
      }
      const again = await request(
        "POST",
        "/api/portal/shortlist",
        JSON.stringify({ slug: marker.slug }),
        login.cookie,
      );
      const duplicate = await request(
        "POST",
        "/api/portal/shortlist",
        JSON.stringify({ slug: marker.slug }),
        login.cookie,
      );
      const duplicateJson = JSON.parse(duplicate.body) as { duplicate?: boolean; items?: unknown[] };
      if (again.status !== 200 || duplicate.status !== 200 || duplicateJson.duplicate !== true || duplicateJson.items?.length !== 1) {
        throw new Error(`Duplicate API save failed: ${duplicate.status} ${duplicate.body}`);
      }
      const anonymous = await request("GET", "/api/portal/shortlist");
      const forged = await request(
        "GET",
        "/api/portal/shortlist",
        undefined,
        `ks_student_session=${createSessionToken(crypto.randomUUID())}`,
      );
      api = {
        login: login.status,
        shortlistAfterRestart: listed.status,
        remove: removed.status,
        duplicate: duplicateJson.duplicate === true && duplicateJson.items?.length === 1,
        anonymous: anonymous.status,
        forgedSession: forged.status,
      };
      if (anonymous.status !== 401 || forged.status !== 401) {
        throw new Error(`Isolation failed: anonymous ${anonymous.status}, forged ${forged.status}`);
      }
    }

    if (mode === "read") {
      await removeStudent(marker.studentId);
    }
    console.log(JSON.stringify({ ...base, survived: true, api }, null, 2));
    await closeDatabase();
    return;
  }

  throw new Error(`Unknown mode ${mode}`);
}

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    const { closeDatabase } = await import("@/lib/portal-store/db");
    await closeDatabase().catch(() => undefined);
    process.exit(1);
  });
