import http from "node:http";
import { loadLocalEnv } from "./load-env";
import { getStudentByEmail, removeStudent } from "../src/lib/students";

loadLocalEnv();

const email = "phase2c-shortlist@example.com";
const password = "Phase2cShort1";

function request(method: string, path: string, body?: unknown, cookie?: string) {
  return new Promise<{ status: number; json: Record<string, unknown>; cookie: string }>((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 43127,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:43127",
          "X-Forwarded-For": "203.0.113.24",
          Connection: "close",
          ...(cookie ? { Cookie: cookie } : {}),
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const setCookie = res.headers["set-cookie"]?.find((item) => item.startsWith("ks_student_session="));
          const nextCookie = setCookie ? setCookie.split(";")[0] : cookie || "";
          let json: Record<string, unknown> = {};
          if (text && text.trim().startsWith("{")) json = JSON.parse(text) as Record<string, unknown>;
          else if (text) json = { html: text.slice(0, 180) };
          resolve({
            status: res.statusCode || 0,
            json,
            cookie: nextCookie,
          });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function slugs(json: Record<string, unknown>) {
  const items = json.items as Array<{ slug: string }> | undefined;
  return (items ?? []).map((item) => item.slug);
}

async function main() {
  const existing = await getStudentByEmail(email);
  if (existing) await removeStudent(existing.id);

  const registered = await request("POST", "/api/auth/register", {
    name: "Phase",
    surname: "TwoC",
    dateOfBirth: "2000-01-01",
    placeOfBirth: "Lahore",
    passportOrCnic: "PHASE2C123",
    email,
    phone: "+923001112233",
    currentCity: "Lahore",
    address: "Test address",
    password,
    privacyConsent: true,
    termsConsent: true,
  });
  if (registered.status !== 200 || !registered.cookie) {
    throw new Error(`register ${registered.status} ${JSON.stringify(registered.json)}`);
  }

  const matches = await request("GET", "/api/portal/matches?sort=relevance&offset=0", undefined, registered.cookie);
  const first = (matches.json.matches as Array<{ slug: string }> | undefined)?.[0]?.slug;
  if (matches.status !== 200 || !first) throw new Error(`matches ${matches.status}`);

  const saved = await request("POST", "/api/portal/shortlist", { slug: first }, registered.cookie);
  if (saved.status !== 200 || !slugs(saved.json).includes(first)) throw new Error("save did not stick");

  const again = await request("GET", "/api/portal/shortlist", undefined, registered.cookie);
  if (!slugs(again.json).includes(first)) throw new Error("refresh lost the save");

  const page = await request("GET", "/programs/shortlist", undefined, registered.cookie);
  if (page.status !== 200) throw new Error("shortlist page failed");

  const removed = await request("DELETE", "/api/portal/shortlist", { slug: first }, registered.cookie);
  if (removed.status !== 200 || slugs(removed.json).includes(first)) throw new Error("remove failed");

  const after = await request("GET", "/api/portal/shortlist", undefined, registered.cookie);
  if (slugs(after.json).includes(first)) throw new Error("removal did not persist");

  const student = await getStudentByEmail(email);
  if (student) await removeStudent(student.id);
  console.log(JSON.stringify({ saved: first, refreshed: true, removed: true, cleaned: true }));
  process.exit(0);
}

main().catch(async (error) => {
  const student = await getStudentByEmail(email).catch(() => null);
  if (student) await removeStudent(student.id);
  console.error(error);
  process.exit(1);
});
