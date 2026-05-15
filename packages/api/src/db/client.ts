import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.CONNECTION_STRING;
if (!connectionString) throw new Error("CONNECTION_STRING is required");

const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });
export type DB = typeof db;
