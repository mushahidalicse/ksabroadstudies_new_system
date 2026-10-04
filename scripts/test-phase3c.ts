import http from "node:http";
import { createSessionToken, COOKIE } from "../src/lib/auth";
import { addNote } from "../src/lib/portal-store/crm";
import { listNotifications } from "../src/lib/portal-store/notifications";
import { createStaff, deleteStaff } from "../src/lib/portal-store/staff";
import { setPortalPreference } from "../src/lib/portal-store/preferences";
import { listAudit } from "../src/lib/portal-store/audit";
import { emailNotificationProvider, whatsappNotificationProvider } from "../src/lib/notifications/provider";
import { fillTemplate } from "../src/lib/notifications/placeholders";
import { communicationHistory } from "../src/lib/notifications/history";
import { deadlineThreshold, generateReminders } from "../src/lib/reminders/generate";
import { canSendMessage } from "../src/lib/staff-roles";
import { EMPTY_PROFILE } from "../src/lib/student-types";
import { removeStudent, upsertStudent } from "../src/lib/students";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(!emailNotificationProvider.enabled && !whatsappNotificationProvider.enabled, "email and WhatsApp providers stay off");
assert(canSendMessage("case_officer", "general") && !canSendMessage("finance", "document"), "roles stay narrow");
assert(!canSendMessage("document_reviewer", "payment") && canSendMessage("finance", "payment"), "finance is limited to payment messages");
assert(deadlineThreshold(10) === 14 && deadlineThreshold(7) === 7 && deadlineThreshold(3) === 3 && deadlineThreshold(1) === 1 && deadlineThreshold(40) === null, "deadline windows are 14, 7, 3, and 1");
const blank = fillTemplate("Hello {{student_name}} about {{programme_name}} {{not_code}}", { student_name: "Amina" });
assert(blank.text === "Hello Amina about  " && blank.missing.includes("programme_name") && blank.missing.includes("not_code"), "missing placeholders are blank and reported");
assert(!blank.text.includes("not_code"), "unknown placeholders are not executed");

function request(path: string, method: string, headers: Record<string, string>, body?: string) {
  return new Promise<{ status: number; raw: string; cookie: string }>((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 43127,
        path,
        method,
        headers: { Connection: "close", ...headers, ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}) },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const match = /ks_staff_session=([^;]+)/.exec(String(res.headers["set-cookie"] ?? ""));
          resolve({ status: res.statusCode ?? 0, raw: Buffer.concat(chunks).toString("utf8"), cookie: match?.[1] ?? "" });
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const stamp = crypto.randomUUID().slice(0, 8);
  const studentA = crypto.randomUUID();
  const studentB = crypto.randomUUID();
  const passportId = crypto.randomUUID();
  const proofId = crypto.randomUUID();
  const now = new Date(2026, 8, 26);
  const deadline = "2026-10-03";
  const base = {
    passwordHash: "test-hash-not-used",
    dateOfBirth: "",
    placeOfBirth: "",
    passportOrCnic: "",
    phone: "",
    currentCity: "",
    address: "",
    createdAt: new Date().toISOString(),
    profile: { ...EMPTY_PROFILE },
  };
  await upsertStudent({
    ...base,
    id: studentA,
    email: `phase3c-a-${stamp}@example.com`,
    name: "Amina",
    surname: "Khan",
    documents: [
      { id: passportId, kind: "passport", originalName: "passport.pdf", storedName: "passport.pdf", uploadedAt: new Date().toISOString() },
      { id: proofId, kind: "payment-proof", originalName: "proof.png", storedName: "proof.png", uploadedAt: new Date().toISOString() },
    ],
    shortlist: [
      { slug: "phase3c-open", savedAt: now.toISOString() },
      { slug: "phase3c-closed", savedAt: now.toISOString() },
      { slug: "phase3c-estimated", savedAt: now.toISOString() },
    ],
  });
  await upsertStudent({
    ...base,
    id: studentB,
    email: `phase3c-b-${stamp}@example.com`,
    name: "Bilal",
    surname: "Raza",
    documents: [],
    shortlist: [],
  });
  const finance = await createStaff({ email: `phase3c-finance-${stamp}@example.com`, name: "Finance", password: "Phase3cStaff1", role: "finance" });
  const reviewer = await createStaff({ email: `phase3c-docs-${stamp}@example.com`, name: "Reviewer", password: "Phase3cStaff1", role: "document_reviewer" });
  const officer = await createStaff({ email: `phase3c-officer-${stamp}@example.com`, name: "Officer", password: "Phase3cStaff1", role: "case_officer" });
  if (!finance || !reviewer || !officer) throw new Error("staff accounts were created");

  try {
    await addNote(studentA, "INTERNAL ONLY phase3c secret note");
    const programmes = [
      { slug: "phase3c-open", name: "Open Studies", universityName: "Test University", deadline, estimatedDeadline: false, finderStatus: "open" },
      { slug: "phase3c-closed", name: "Closed Studies", universityName: "Test University", deadline, estimatedDeadline: false, finderStatus: "closed" },
      { slug: "phase3c-estimated", name: "Estimated Studies", universityName: "Test University", deadline: "estimated autumn", estimatedDeadline: true, finderStatus: "open" },
    ];
    const first = await generateReminders({ now, programmes, onlyStudentIds: [studentA] });
    const second = await generateReminders({ now, programmes, onlyStudentIds: [studentA] });
    assert(first.created === 1 && second.created === 0, "the same deadline reminder is not created twice");
    await setPortalPreference(studentA, false);
    await upsertStudent({
      ...base,
      id: studentA,
      email: `phase3c-a-${stamp}@example.com`,
      name: "Amina",
      surname: "Khan",
      documents: [
        { id: passportId, kind: "passport", originalName: "passport.pdf", storedName: "passport.pdf", uploadedAt: new Date().toISOString() },
        { id: proofId, kind: "payment-proof", originalName: "proof.png", storedName: "proof.png", uploadedAt: new Date().toISOString() },
      ],
      shortlist: [{ slug: "phase3c-later", savedAt: now.toISOString() }, { slug: "phase3c-open", savedAt: now.toISOString() }],
    });
    const muted = await generateReminders({
      now,
      programmes: [...programmes, { slug: "phase3c-later", name: "Later Studies", universityName: "Test University", deadline: "2026-10-10", estimatedDeadline: false, finderStatus: "open" }],
      onlyStudentIds: [studentA],
    });
    assert(muted.created === 0, "portal reminders can be paused");
    const own = await listNotifications(studentA);
    assert(own.some((item) => item.message.includes("Open Studies")) && !own.some((item) => item.message.includes("Closed Studies") || item.message.includes("Estimated Studies")), "only a real open deadline is reminded");
    assert(!own.some((item) => item.message.includes("INTERNAL ONLY")), "an internal note is not a notification");
    assert(!(await communicationHistory(studentA)).some((item) => item.message.includes("INTERNAL ONLY")), "communication history hides internal notes");
    assert((await listNotifications(studentB)).every((item) => item.studentId === studentB), "student B has no borrowed notifications");

    const anonymous = await request("/api/portal/notifications", "GET", {});
    assert(anonymous.status === 401, `anonymous notifications returned ${anonymous.status}`);
    const tokenA = createSessionToken(studentA);
    const tokenB = createSessionToken(studentB);
    const asA = await request("/api/portal/notifications", "GET", { Cookie: `${COOKIE}=${tokenA}` });
    const asB = await request("/api/portal/notifications", "GET", { Cookie: `${COOKIE}=${tokenB}` });
    assert(asA.status === 200 && asA.raw.includes("Open Studies") && !asB.raw.includes("Open Studies"), "a student cannot read another student's notifications");
    const studentAdmin = await request("/api/admin/communications", "GET", { Cookie: `${COOKIE}=${tokenA}` });
    assert(studentAdmin.status === 401, `a student session on communications returned ${studentAdmin.status}`);

    async function login(email: string) {
      const response = await request("/api/admin/staff", "POST", { "Content-Type": "application/json" }, JSON.stringify({ action: "login", email, password: "Phase3cStaff1" }));
      assert(response.status === 200 && response.cookie, `login failed for ${email}`);
      return { Cookie: `ks_staff_session=${response.cookie}` };
    }
    const financeCookie = await login(finance.email);
    const blockedPassport = await request("/api/admin/operations", "POST", { "Content-Type": "application/json", ...financeCookie }, JSON.stringify({ action: "review", documentId: passportId, status: "accepted", note: "no" }));
    assert(blockedPassport.status === 401, `finance reviewing a passport returned ${blockedPassport.status}`);
    const paymentMessage = await request("/api/admin/communications", "POST", { "Content-Type": "application/json", ...financeCookie }, JSON.stringify({ action: "message", studentId: studentA, channel: "payment", templateCategory: "payment", title: "Payment proof", message: "Please upload a clearer screenshot.", confirmMissing: true }));
    assert(paymentMessage.status === 200, `finance payment message returned ${paymentMessage.status}`);
    const financeDocument = await request("/api/admin/communications", "POST", { "Content-Type": "application/json", ...financeCookie }, JSON.stringify({ action: "message", studentId: studentA, channel: "document", templateCategory: "document", title: "Passport", message: "Please replace the passport.", confirmMissing: true }));
    assert(financeDocument.status === 401, `finance document message returned ${financeDocument.status}`);

    const reviewerCookie = await login(reviewer.email);
    const documentMessage = await request("/api/admin/communications", "POST", { "Content-Type": "application/json", ...reviewerCookie }, JSON.stringify({ action: "message", studentId: studentA, channel: "document", templateCategory: "document", title: "Transcript", message: "Please upload your final transcript.", confirmMissing: true }));
    assert(documentMessage.status === 200, `document reviewer message returned ${documentMessage.status}`);
    const reviewerPayment = await request("/api/admin/communications", "POST", { "Content-Type": "application/json", ...reviewerCookie }, JSON.stringify({ action: "message", studentId: studentA, channel: "payment", templateCategory: "payment", title: "Payment", message: "Accepted.", confirmMissing: true }));
    assert(reviewerPayment.status === 401, `document reviewer payment message returned ${reviewerPayment.status}`);

    const officerCookie = await login(officer.email);
    const officerMessage = await request("/api/admin/communications", "POST", { "Content-Type": "application/json", ...officerCookie }, JSON.stringify({ action: "message", studentId: studentA, channel: "general", title: "Hello {{student_name}}", message: "Please check {{programme_name}}.", confirmMissing: false }));
    assert(officerMessage.status === 409 && officerMessage.raw.includes("programme_name"), "blank placeholders warn before sending");
    const officerSent = await request("/api/admin/communications", "POST", { "Content-Type": "application/json", ...officerCookie }, JSON.stringify({ action: "message", studentId: studentA, channel: "general", title: "Hello {{student_name}}", message: "This is a portal message.", confirmMissing: true }));
    assert(officerSent.status === 200, `case officer message returned ${officerSent.status}`);
    const visible = await listNotifications(studentA);
    assert(visible.some((item) => item.message === "This is a portal message." && item.title.includes("Amina")), "the staff message reaches the student");
    assert(!visible.some((item) => item.message.includes("INTERNAL ONLY")), "the internal note still stays off the portal");
    const audit = await listAudit({});
    assert(audit.some((row) => row.action === "student_message_sent") && !JSON.stringify(audit).includes("Phase3cStaff1"), "audit records the message and not the password");
  } finally {
    await removeStudent(studentA);
    await removeStudent(studentB);
    if (finance) await deleteStaff(finance.id);
    if (reviewer) await deleteStaff(reviewer.id);
    if (officer) await deleteStaff(officer.id);
  }
  assert((await listNotifications(studentA)).length === 0, "deleting the student removes notifications");
  console.log("phase 3c checks passed");
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
