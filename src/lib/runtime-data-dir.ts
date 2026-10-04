import path from "path";

/**
 * Catalogue JSON stays under src/data.
 * Portal accounts no longer use this directory. Calling it on Vercel throws
 * so a future change cannot silently write student data to /tmp.
 */
export function runtimeDataDir() {
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    throw new Error(
      "runtimeDataDir() is disabled on Vercel. Portal data uses PostgreSQL via DATABASE_URL.",
    );
  }
  return path.join(process.cwd(), "data");
}
