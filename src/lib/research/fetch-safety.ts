export type OfficialFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type SafeBody = {
  ok: boolean;
  status: number;
  url: string;
  body: string;
  contentType: string;
  rejected: "scheme" | "host" | "redirect" | "tls" | null;
};

const PRIVATE_HOSTS = new Set(["localhost", "localhost.localdomain", "0.0.0.0", "::1", "[::1]"]);

function ipv4Private(host: string) {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return true;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function officialTargetBlock(value: string, domains: string[]): "scheme" | "host" | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "scheme";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "scheme";
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (PRIVATE_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal") || ipv4Private(host)) return "host";
  const trusted = domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  return trusted ? null : "host";
}

const TLS_CODES = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "CERT_SIGNATURE_FAILURE",
  "CERT_UNTRUSTED",
]);

export function tlsFailureCode(error: unknown) {
  const cause = error instanceof Error ? (error as Error & { cause?: { code?: string } }).cause : undefined;
  const code = cause?.code || (error as { code?: string }).code || "";
  if (TLS_CODES.has(code)) return code;
  const message = `${error instanceof Error ? error.message : ""} ${cause && "message" in (cause as object) ? String((cause as { message?: string }).message ?? "") : ""}`;
  if (/unable to verify the first certificate|certificate/i.test(message) && /verify|certificate|altname/i.test(message)) return code || "TLS_VERIFY_FAILED";
  return null;
}

export async function safeFetch(input: string, domains: string[], fetchImpl: OfficialFetch, redirects = 0): Promise<SafeBody> {
  const blocked = officialTargetBlock(input, domains);
  if (blocked) return { ok: false, status: 0, url: input, body: "", contentType: "", rejected: blocked };
  try {
    const response = await fetchImpl(input, {
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "KSAbroadResearch/1.0" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects >= 3) return { ok: false, status: response.status, url: input, body: "", contentType: "", rejected: "redirect" };
      const next = new URL(location, input).toString();
      if (officialTargetBlock(next, domains)) return { ok: false, status: response.status, url: input, body: "", contentType: "", rejected: "redirect" };
      return safeFetch(next, domains, fetchImpl, redirects + 1);
    }
    const contentType = response.headers.get("content-type") || "";
    const body = response.ok ? (await response.text()).slice(0, 200000) : "";
    return { ok: response.ok, status: response.status, url: input, body, contentType, rejected: null };
  } catch (error) {
    return { ok: false, status: 0, url: input, body: "", contentType: "", rejected: tlsFailureCode(error) ? "tls" : null };
  }
}
