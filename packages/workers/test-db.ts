import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve("../../.env");
const envContent = readFileSync(envPath, "utf-8");
const envVars = envContent.split("\n").filter((line) => line && !line.startsWith("#"));

console.log("📋 Env variables loaded:");
for (const line of envVars) {
  const [key, value] = line.split("=");
  if (key) {
    const masked = value?.substring(0, 30) + (value?.length! > 30 ? "..." : "");
    console.log(`   ${key}: ${masked}`);
    process.env[key.trim()] = value?.trim();
  }
}

console.log("\n🔍 DATABASE_URL:");
console.log(`   ${process.env.DATABASE_URL}`);

console.log("\n📡 Testing connection...");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

console.log(`\n🔗 Connection: ${connectionString.substring(0, 80)}...`);

(async () => {
  try {
    // Try to import and use the db
    const { db, competitors } = await import("@rivaleye/db");

    console.log("\n⏳ Querying database...");
    const result = await db.select().from(competitors).limit(1);

    console.log("\n✅ Connection successful!");
    console.log(`   Found ${result.length} competitors`);
    process.exit(0);
  } catch (err: any) {
    console.error("\n❌ Connection failed:");
    console.error("   Error:", err.message);
    console.error("   Code:", err.code);
    console.error("\n📍 Full error:");
    console.error(err);
    process.exit(1);
  }
})();
