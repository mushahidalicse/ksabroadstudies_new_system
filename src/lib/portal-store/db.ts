import postgres from "postgres";
import { PORTAL_SCHEMA_SQL } from "@/lib/portal-store/schema";

let client: ReturnType<typeof postgres> | null = null;
let schemaReady: Promise<void> | null = null;

/** Portal data requires PostgreSQL. Missing configuration fails closed. */
export function databaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Student accounts, shortlists, applications, and consultancy cases are not stored in JSON files or /tmp.",
    );
  }
  if (/^(\/tmp|file:|[a-zA-Z]:\\)/.test(url) || url.includes("students.json")) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection string.");
  }
  return url;
}

export function sql() {
  if (!client) {
    client = postgres(databaseUrl(), {
      max: 8,
      idle_timeout: 20,
      connect_timeout: 15,
      onnotice: () => {},
    });
  }
  return client;
}

export async function ensureSchema() {
  if (!schemaReady) {
    const db = sql();
    schemaReady = db.unsafe(PORTAL_SCHEMA_SQL).then(() => undefined).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

export async function closeDatabase() {
  if (client) {
    await client.end({ timeout: 5 });
    client = null;
    schemaReady = null;
  }
}
