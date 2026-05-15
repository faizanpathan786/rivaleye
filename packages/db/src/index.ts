import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index.js";

const connectionString =
  process.env["DATABASE_URL"] ?? "postgresql://rivaleye:rivaleye@localhost:5432/rivaleye";

const isSupabase = connectionString.includes("supabase.com");
const sslConfig = isSupabase ? { ssl: { rejectUnauthorized: false } } : {};

// For migrations and one-off scripts (max 1 connection)
export const migrationClient = postgres(connectionString, { max: 1, ...sslConfig });

// For application usage (connection pool)
const queryClient = postgres(connectionString, { max: 10, ...sslConfig });
export const db = drizzle(queryClient, { schema });

export * from "./schema/index.js";
export { schema };
