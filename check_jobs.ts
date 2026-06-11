import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { reportPlatformJobs } from './packages/api/src/db/schema/pipeline.ts';

const connectionString = process.env.CONNECTION_STRING || '';
const pool = new pg.Pool({ connectionString });
const db = drizzle(pool);

try {
  const jobs = await db
    .select()
    .from(reportPlatformJobs)
    .limit(5);
  
  console.log('Recent jobs:', JSON.stringify(jobs, null, 2));
  process.exit(0);
} catch (e) {
  console.error('Error:', e);
  process.exit(1);
}
