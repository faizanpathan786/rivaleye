import { defineConfig } from "drizzle-kit";

const connectionString = process.env.CONNECTION_STRING;
if (!connectionString) throw new Error("CONNECTION_STRING is required");

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: connectionString },
  strict: true,
  verbose: true,
});
