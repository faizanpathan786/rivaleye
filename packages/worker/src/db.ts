import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../api/src/db/schema/index.js";

const connectionString = process.env.CONNECTION_STRING;
if (!connectionString) throw new Error("CONNECTION_STRING is required");

const queryClient = postgres(connectionString, { max: 5 });
export const db = drizzle(queryClient, { schema });
