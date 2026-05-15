import { defineConfig } from "drizzle-kit";

const url = process.env["DATABASE_URL"] ?? "postgresql://rivaleye:rivaleye@localhost:5432/rivaleye";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url, ssl: url.includes("supabase.com") ? "require" : undefined },
  verbose: true,
  strict: true,
});
