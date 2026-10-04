import http from "node:http";
import { readFileSync } from "node:fs";

function password() {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const line = env.split(/\r?\n/).find((row) => row.startsWith("ADMIN_PASSWORD="));
  return line ? line.slice("ADMIN_PASSWORD=".length).trim() : "ksabroad2027";
}

function request(method, path, body, auth = true) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 43127,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          ...(auth ? { "x-admin-password": password() } : {}),
          Origin: "http://127.0.0.1:43127",
          Connection: "close",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({ status: res.statusCode, json: text.startsWith("{") || text.startsWith("[") ? JSON.parse(text) : { text: text.slice(0, 180) } });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const denied = await request("GET", "/api/admin/catalogue-review?q=business", null, false);
if (denied.status !== 401) throw new Error(`unauthenticated request was ${denied.status}`);
const list = await request("GET", "/api/admin/catalogue-review?q=business");
if (list.status !== 200 || !list.json.quality || list.json.quality.total !== 1070) {
  throw new Error(`list failed ${list.status}`);
}
const slug = list.json.rows[0]?.slug;
if (!slug) throw new Error("no programme row");
const blocked = await request("PUT", "/api/admin/catalogue-review", {
  slug,
  verificationStatus: "verified",
  english: { ieltsMin: 6.5 },
});
if (blocked.status !== 400) throw new Error(`verified without source was not blocked (${blocked.status})`);
const saved = await request("PUT", "/api/admin/catalogue-review", {
  slug,
  verificationStatus: "verified",
  sourceUrl: "https://example.edu/programme",
  sourceTitle: "Phase 2D local check",
  sourceType: "official_programme_page",
  lastChecked: "2026-09-24",
  academicYear: "2026/27",
  english: { ieltsMin: 6.5, moi: "accepted" },
  tuition: { mode: "single", amount: 2500, currency: "EUR", period: "year" },
});
if (saved.status !== 200) throw new Error(`save failed ${saved.status} ${JSON.stringify(saved.json)}`);
const detail = await request("GET", `/api/admin/catalogue-review?slug=${encodeURIComponent(slug)}`);
if (detail.json.card?.requirements?.english?.ieltsMin !== 6.5) throw new Error("saved IELTS did not override");
if (!String(detail.json.originalEnglish || detail.json.card?.englishRequirement || "").length && detail.json.originalEnglish !== "") {
  throw new Error("original text missing from review payload");
}
const removed = await request("DELETE", "/api/admin/catalogue-review", { slug, confirm: "delete" });
if (removed.status !== 200) throw new Error(`delete failed ${removed.status}`);
const after = await request("GET", `/api/admin/catalogue-review?slug=${encodeURIComponent(slug)}`);
if (after.json.enrichment?.verificationStatus === "verified") throw new Error("delete left a verified record");
console.log(JSON.stringify({ denied: denied.status, listed: list.json.quality.total, blocked: blocked.status, saved: saved.status, override: detail.json.card.requirements.english.ieltsMin, removed: removed.status, slug }));
process.exit(0);
