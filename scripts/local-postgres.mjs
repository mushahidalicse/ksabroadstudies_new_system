import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import EmbeddedPostgres from "embedded-postgres";

const root = process.cwd();
const dir = path.join(root, "data", "pg");
const clusterDir = path.join(dir, "cluster");
const port = 54329;
const user = "postgres";
const passwordFile = path.join(dir, "password");
mkdirSync(dir, { recursive: true });

const clusterReady = existsSync(path.join(clusterDir, "PG_VERSION"));
let password = existsSync(passwordFile) ? readFileSync(passwordFile, "utf8").trim() : "";
if (!password) {
  if (clusterReady) {
    throw new Error("PostgreSQL cluster exists but data/pg/password is missing.");
  }
  password = randomBytes(18).toString("hex");
  writeFileSync(passwordFile, `${password}\n`, { encoding: "utf8" });
}

const pg = new EmbeddedPostgres({
  databaseDir: clusterDir,
  user,
  password,
  port,
  persistent: true,
});

if (!clusterReady) await pg.initialise();
await pg.start();

for (const name of ["ks_abroad", "ks_abroad_test"]) {
  try {
    await pg.createDatabase(name);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message)) throw error;
  }
}

const url = `postgres://${user}:${encodeURIComponent(password)}@127.0.0.1:${port}/ks_abroad`;
const envPath = path.join(root, ".env");
const env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const line = `DATABASE_URL=${url}`;
const next = /^DATABASE_URL=/m.test(env)
  ? env.replace(/^DATABASE_URL=.*$/m, line)
  : `${env}${env.endsWith("\n") || env.length === 0 ? "" : "\n"}${line}\n`;
writeFileSync(envPath, next, { encoding: "utf8" });
console.log(`PostgreSQL listening on 127.0.0.1:${port}, database ks_abroad`);

const shutdown = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
await new Promise(() => {});
