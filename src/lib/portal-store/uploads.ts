import path from "path";

/**
 * Local development keeps document bytes in data/uploads.
 * Production refuses /tmp. Metadata lives in PostgreSQL either way.
 */
export function uploadDir() {
  const onVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  const configured = process.env.UPLOAD_DIR?.trim();
  if (onVercel) {
    if (
      !configured ||
      configured === "/tmp" ||
      configured.startsWith("/tmp/") ||
      configured.includes(`${path.sep}tmp${path.sep}`)
    ) {
      throw new Error(
        "UPLOAD_DIR must be persistent storage. Document files are not written to /tmp. Metadata is stored in PostgreSQL.",
      );
    }
    return configured;
  }
  return path.join(process.cwd(), "data", "uploads");
}
