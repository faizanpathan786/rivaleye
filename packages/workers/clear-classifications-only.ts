import { db, classifications } from "@rivaleye/db";

async function main() {
  console.log("Clearing classifications...");
  const result = await db.delete(classifications);
  console.log("Cleared all classifications");
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
