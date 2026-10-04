import { generateReminders } from "../src/lib/reminders/generate";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const result = await generateReminders();
  console.log(`reminders created: ${result.created}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
