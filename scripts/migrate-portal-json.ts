import { closeDatabase } from "@/lib/portal-store/db";
import { migratePortalJson } from "@/lib/portal-store/migrate";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();
const report = await migratePortalJson();
console.log(JSON.stringify(report, null, 2));
await closeDatabase();
process.exit(0);
