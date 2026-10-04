import { existsSync, readFileSync } from "fs";
import path from "path";

export function loadLocalEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2];
  }
}
