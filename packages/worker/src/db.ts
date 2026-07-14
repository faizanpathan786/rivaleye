import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../api/src/db/schema/index.js";

const connectionString = process.env.CONNECTION_STRING;
if (!connectionString) throw new Error("CONNECTION_STRING is required");

const queryClient = postgres(connectionString, {
  max: 5,
  idle_timeout: 20,    // release idle connections after 20s (before Supabase kills them at ~30s)
  connect_timeout: 10, // fail fast on bad connections rather than hanging
  // Required for Supabase's port-6543 PgBouncer transaction-mode pooler: prepared
  // statements are tied to one backend connection, but transaction pooling can hop
  // consecutive statements to a different backend, breaking claim atomicity
  // (SELECT ... FOR UPDATE SKIP LOCKED + UPDATE) and causing double-claimed jobs.
  prepare: false,
});
export const db = drizzle(queryClient, { schema });
