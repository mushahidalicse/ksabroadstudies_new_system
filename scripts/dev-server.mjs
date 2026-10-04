import { spawn, spawnSync } from "child_process";
import net from "net";
import path from "path";

const port = 43127;
const host = "127.0.0.1";

function portOpen() {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

function health() {
  return fetch(`http://${host}:${port}/api/health`, { signal: AbortSignal.timeout(8000) })
    .then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) }))
    .catch(() => null);
}

const postgres = spawnSync(process.execPath, [path.join(process.cwd(), "scripts", "dev-postgres.mjs"), "start"], {
  cwd: process.cwd(),
  stdio: "inherit",
});
if (postgres.status !== 0) process.exit(postgres.status ?? 1);

if (await portOpen()) {
  const result = await health();
  if (result?.body?.ok === true && result.body.database === "up") {
    console.log(`Next.js already running at http://localhost:${port}`);
  } else {
    console.error(
      `APPLICATION FAILURE: port ${port} is already in use, and it is not this project's development server.`,
    );
    process.exit(1);
  }
} else {
  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "--hostname", "0.0.0.0", "--port", String(port)], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  function shutdown() {
    if (!child.killed) child.kill();
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  child.on("exit", (code, signal) => {
    if (signal || code === 0 || code === null) process.exit(0);
    console.error(`APPLICATION FAILURE: Next.js exited with code ${code}.`);
    process.exit(code);
  });
}
