import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.CONNECTION_STRING;
if (!connectionString) throw new Error("CONNECTION_STRING is required");

// prepare: false is required for Supabase's port-6543 PgBouncer transaction-mode
// pooler — prepared statements are tied to one backend connection, which transaction
// pooling doesn't guarantee across consecutive statements.
const queryClient = postgres(connectionString, { max: 5, prepare: false });
export const db = drizzle(queryClient, { schema });
export type DB = typeof db;
