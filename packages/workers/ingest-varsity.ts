import { processIngestion } from "./src/processors/ingestion.processor.js";

const competitorId = "a1ac6b18-04df-4b48-a81e-174749e7f0e0"; // Zerodha Varsity

console.log("Starting ingestion for Zerodha Varsity...");

processIngestion(competitorId)
  .then(() => {
    console.log("✓ Ingestion completed");
    process.exit(0);
  })
  .catch(err => {
    console.error("✗ Ingestion failed:", err);
    process.exit(1);
  });
