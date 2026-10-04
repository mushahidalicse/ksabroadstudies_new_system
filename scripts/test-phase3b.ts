import http from "node:http";
import { canReviewDocument, roleAllows } from "../src/lib/staff-roles";
import { listServices, reviewsForStudent, updateService } from "../src/lib/portal-store/operations";
import { createStaff, deleteStaff } from "../src/lib/portal-store/staff";
import { EMPTY_PROFILE } from "../src/lib/student-types";
import { removeStudent, upsertStudent } from "../src/lib/students";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(roleAllows("owner", "staff") && roleAllows("owner", "payments"), "owner can manage staff and payments");
assert(!roleAllows("finance", "documents") && canReviewDocument("finance", "payment-proof"), "finance reviews payment proof only");
assert(!canReviewDocument("document_reviewer", "payment-proof") && canReviewDocument("document_reviewer", "passport"), "a document reviewer cannot accept payment proof");
assert(!roleAllows("case_officer", "staff"), "a case officer cannot create staff accounts");

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
          const setCookie = String(res.headers["set-cookie"] ?? "");
          const match = /ks_staff_session=([^;]+)/.exec(setCookie);
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
  const studentId = crypto.randomUUID();
  const passportId = crypto.randomUUID();
  const proofId = crypto.randomUUID();
  const finance = await createStaff({
    email: `phase3b-finance-${studentId.slice(0, 8)}@example.com`,
    name: "Finance Test",
    password: "Phase3bStaff1",
    role: "finance",
  });
  const reviewer = await createStaff({
    email: `phase3b-docs-${studentId.slice(0, 8)}@example.com`,
    name: "Docs Test",
    password: "Phase3bStaff1",
    role: "document_reviewer",
  });
  assert(finance && reviewer, "staff accounts can be created");
  await upsertStudent({
    id: studentId,
    email: `phase3b-${studentId.slice(0, 8)}@example.com`,
    passwordHash: "test-hash-not-used",
    name: "Phase",
    surname: "ThreeB",
    dateOfBirth: "",
    placeOfBirth: "",
    passportOrCnic: "",
    phone: "",
    currentCity: "",
    address: "",
    createdAt: new Date().toISOString(),
    profile: { ...EMPTY_PROFILE },
    documents: [
      { id: passportId, kind: "passport", originalName: "passport.pdf", storedName: "passport.pdf", uploadedAt: new Date().toISOString() },
      { id: proofId, kind: "payment-proof", originalName: "proof.png", storedName: "proof.png", uploadedAt: new Date().toISOString() },
    ],
    shortlist: [],
  });
  const original = (await listServices(false)).find((service) => service.id === "one-to-one");
  if (!original) throw new Error("the existing counselling service is in the catalogue");

  try {
    const denied = await request("/api/admin/staff", "GET", {});
    assert(denied.status === 401, `staff list without a login returned ${denied.status}`);
    assert(!denied.raw.includes("password_hash"), "a refused staff response has no password hash");

    const financeLogin = await request(
      "/api/admin/staff",
      "POST",
      { "Content-Type": "application/json" },
      JSON.stringify({ action: "login", email: finance?.email, password: "Phase3bStaff1" }),
    );
    assert(financeLogin.status === 200 && financeLogin.cookie && !financeLogin.raw.includes("passwordHash"), "finance login returns a session and no hash");
    const financeCookie = { Cookie: `ks_staff_session=${financeLogin.cookie}` };
    const blockedPassport = await request(
      "/api/admin/operations",
      "POST",
      { "Content-Type": "application/json", ...financeCookie },
      JSON.stringify({ action: "review", documentId: passportId, status: "accepted", note: "no" }),
    );
    assert(blockedPassport.status === 401, `finance reviewing a passport returned ${blockedPassport.status}`);
    const acceptedProof = await request(
      "/api/admin/operations",
      "POST",
      { "Content-Type": "application/json", ...financeCookie },
      JSON.stringify({ action: "review", documentId: proofId, status: "accepted", note: "screenshot checked" }),
    );
    assert(acceptedProof.status === 200, `finance reviewing payment proof returned ${acceptedProof.status}`);

    const docsLogin = await request(
      "/api/admin/staff",
      "POST",
      { "Content-Type": "application/json" },
      JSON.stringify({ action: "login", email: reviewer?.email, password: "Phase3bStaff1" }),
    );
    const docsCookie = { Cookie: `ks_staff_session=${docsLogin.cookie}` };
    const blockedProof = await request(
      "/api/admin/operations",
      "POST",
      { "Content-Type": "application/json", ...docsCookie },
      JSON.stringify({ action: "review", documentId: proofId, status: "rejected", note: "no" }),
    );
    assert(blockedProof.status === 401, `document reviewer changing payment proof returned ${blockedProof.status}`);
    const acceptedPassport = await request(
      "/api/admin/operations",
      "POST",
      { "Content-Type": "application/json", ...docsCookie },
      JSON.stringify({ action: "review", documentId: passportId, status: "needs_replacement", note: "scan is cut off" }),
    );
    assert(acceptedPassport.status === 200, `document reviewer updating a passport returned ${acceptedPassport.status}`);

    const studentReviews = await reviewsForStudent(studentId);
    assert(studentReviews.some((row) => row.documentId === proofId && row.status === "accepted"), "payment review stays on the existing document");
    assert(studentReviews.some((row) => row.documentId === passportId && row.status === "needs_replacement"), "document review stays on the existing document");

    assert(await updateService({ id: "one-to-one", kicker: original.kicker, title: "Temporary phase 3b title", detail: original.detail, active: false }), "a service can be paused");
    assert(!(await listServices(true)).some((service) => service.id === "one-to-one"), "a paused service is hidden from new cases");
    assert(await updateService({ id: "one-to-one", kicker: original.kicker, title: original.title, detail: original.detail, active: true }), "the service can be restored");

    const owner = await request("/api/admin/staff", "GET", { "x-admin-password": process.env.ADMIN_PASSWORD || "ksabroad2027" });
    assert(owner.status === 200 && !owner.raw.includes("password_hash") && !owner.raw.includes("passwordHash"), "the existing admin password can list staff without hashes");
  } finally {
    if (original) {
      await updateService({ id: "one-to-one", kicker: original.kicker, title: original.title, detail: original.detail, active: true });
    }
    await removeStudent(studentId);
    if (finance) await deleteStaff(finance.id);
    if (reviewer) await deleteStaff(reviewer.id);
  }

  assert((await reviewsForStudent(studentId)).length === 0, "deleting the student removes document reviews");
  const studentApi = await request("/api/portal/document-reviews", "GET", {});
  assert(studentApi.status === 401, `document reviews without a student session returned ${studentApi.status}`);
  console.log("phase 3b checks passed");
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
