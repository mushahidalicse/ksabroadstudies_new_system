import { promises as fs } from "fs";
import path from "path";

const source = path.join(process.cwd(), "src/data/programme-enrichment.json");
const dir = path.join(process.cwd(), "data/enrichment-backups");
const raw = await fs.readFile(source, "utf8");
await fs.mkdir(dir, { recursive: true });
const file = path.join(dir, `programme-enrichment-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
await fs.writeFile(file, raw, "utf8");
console.log(file);
process.exit(0);
