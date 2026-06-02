// bun --env-file=.env packages/worker/src/trigger-fanin.ts
import { fanInCheck } from "./pg-runner/fan-in";

const REPORT_ID = process.argv[2] ?? "3d412886-2b8f-485a-ae6b-cb20571700bc";
console.log(`Triggering fan-in for report ${REPORT_ID}...`);
await fanInCheck(REPORT_ID);
console.log("Done.");
process.exit(0);
