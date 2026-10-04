import { spawn } from "child_process";
import { randomBytes } from "crypto";
import { createRequire } from "module";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import path from "path";
import postgres from "postgres";

const root = process.cwd();
const parentDir = path.join(root, "data", "pg");
const clusterDir = path.join(parentDir, "cluster");
const passwordFile = path.join(parentDir, "password");
const logFile = path.join(parentDir, "server.log");
const port = 54329;
const host = "127.0.0.1";
const database = "ks_abroad";
const user = "postgres";
const require = createRequire(import.meta.url);

function platformPackage() {
  const name = process.platform === "win32" ? "windows" : process.platform;
  return `@embedded-postgres/${name}-${process.arch}`;
}

function binary(name) {
  const entry = require.resolve(platformPackage());
  const pkgRoot = path.resolve(path.dirname(entry), "..");
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  return path.join(pkgRoot, "native", "bin", exe);
}

function fail(kind, message) {
  console.error(`${kind}: ${message}`);
  process.exit(1);
}

function pgctl(args) {
  return new Promise((resolve) => {
    const child = spawn(binary("pg_ctl"), args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => resolve({ code: 1, output: error.message }));
    child.on("exit", (code) => resolve({ code: code ?? 1, output }));
  });
}

function readPassword() {
  if (!existsSync(passwordFile)) return "";
  return readFileSync(passwordFile, "utf8").trim();
}

function localUrl(dbName) {
  const password = readPassword();
  if (!password) fail("STARTUP FAILURE", "data/pg/password is missing, so the local database cannot be opened.");
  return `postgres://${user}:${encodeURIComponent(password)}@${host}:${port}/${dbName}`;
}

function sameDirectory(left, right) {
  return path.resolve(left).replaceAll("\\", "/").toLowerCase() === path.resolve(right).replaceAll("\\", "/").toLowerCase();
}

async function describeServer(connectionString) {
  const sql = postgres(connectionString, { max: 1, connect_timeout: 5, idle_timeout: 1 });
  try {
    const rows = await sql`
      SELECT current_database() AS db, current_setting('data_directory') AS dir, inet_server_port() AS port
    `;
    return rows[0] ?? null;
  } finally {
    await sql.end({ timeout: 2 });
  }
}

function syncEnv() {
  const envPath = path.join(root, ".env");
  const env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const match = /^DATABASE_URL=(.*)$/m.exec(env);
  const expected = localUrl(database);
  if (!match) {
    const next = `${env}${env.endsWith("\n") || env.length === 0 ? "" : "\n"}DATABASE_URL=${expected}\n`;
    writeFileSync(envPath, next, "utf8");
    return;
  }
  let current;
  try {
    current = new URL(match[1].trim());
  } catch {
    fail("STARTUP FAILURE", "DATABASE_URL in .env is not a valid URL.");
  }
  const currentDb = current.pathname.replace(/^\//, "");
  if (current.hostname === host && current.port === String(port) && currentDb === database) return;
  fail(
    "STARTUP FAILURE",
    `DATABASE_URL points at ${current.hostname}:${current.port || "5432"}/${currentDb}. This project uses ${host}:${port}/${database}.`,
  );
}

async function ensureDatabases() {
  const admin = postgres(localUrl("postgres"), { max: 1, connect_timeout: 5, idle_timeout: 1 });
  try {
    for (const name of [database, "ks_abroad_test"]) {
      const existing = await admin`SELECT 1 FROM pg_database WHERE datname = ${name}`;
      if (existing.length === 0) await admin.unsafe(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await admin.end({ timeout: 2 });
  }
}

async function verifyIntendedServer() {
  let info;
  try {
    info = await describeServer(localUrl(database));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail("DATABASE CONNECTION FAILURE", message.split("\n")[0]);
  }
  if (!info) fail("DATABASE CONNECTION FAILURE", "The database did not return its identity.");
  if (info.db !== database || String(info.port) !== String(port) || !sameDirectory(info.dir, clusterDir)) {
    fail(
      "STARTUP FAILURE",
      `Connected to ${info.db} on port ${info.port} at ${info.dir}, not ${database} on ${port} at ${clusterDir}.`,
    );
  }
  return info;
}

async function initialiseCluster() {
  if (existsSync(path.join(clusterDir, "PG_VERSION"))) return;
  if (existsSync(clusterDir) && readdirSync(clusterDir).length > 0) {
    fail(
      "STARTUP FAILURE",
      `${clusterDir} is not empty and is not a PostgreSQL data directory. It was left untouched.`,
    );
  }
  mkdirSync(clusterDir, { recursive: true });
  if (!readPassword()) writeFileSync(passwordFile, `${randomBytes(18).toString("hex")}\n`, "utf8");
  const imported = await import("embedded-postgres");
  const EmbeddedPostgres = imported.default;
  const pg = new EmbeddedPostgres({
    databaseDir: clusterDir,
    user,
    password: readPassword(),
    port,
    persistent: true,
  });
  await pg.initialise();
}

async function start() {
  mkdirSync(parentDir, { recursive: true });
  const status = await pgctl(["status", "-D", clusterDir]);
  if (status.code !== 0) {
    await initialiseCluster();
    const started = await pgctl([
      "start",
      "-D",
      clusterDir,
      "-w",
      "-l",
      logFile,
      "-o",
      `-p ${port}`,
    ]);
    if (started.code !== 0) {
      fail("STARTUP FAILURE", started.output.trim() || "pg_ctl start failed.");
    }
  }
  syncEnv();
  await ensureDatabases();
  await verifyIntendedServer();
  console.log(`PostgreSQL accepting connections at ${host}:${port}, database ${database}`);
  process.exit(0);
}

async function stop() {
  if (!existsSync(path.join(clusterDir, "PG_VERSION"))) {
    console.log("SUCCESSFUL SHUTDOWN: PostgreSQL data directory is not running.");
    process.exit(0);
  }
  const status = await pgctl(["status", "-D", clusterDir]);
  if (status.code !== 0) {
    console.log("SUCCESSFUL SHUTDOWN: PostgreSQL was already stopped.");
    process.exit(0);
  }
  const stopped = await pgctl(["stop", "-D", clusterDir, "-m", "fast", "-w"]);
  if (stopped.code !== 0) fail("STARTUP FAILURE", stopped.output.trim() || "pg_ctl stop failed.");
  console.log("SUCCESSFUL SHUTDOWN");
  process.exit(0);
}

async function status() {
  const info = await verifyIntendedServer();
  console.log(
    JSON.stringify(
      {
        host,
        port: Number(info.port),
        database: info.db,
        dataDirectory: info.dir,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const command = process.argv[2];
const action = command === "stop" ? stop : command === "status" ? status : command === "start" ? start : null;
if (!action) fail("STARTUP FAILURE", "Use start, stop, or status.");
action().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  fail("STARTUP FAILURE", message.split("\n")[0]);
});
