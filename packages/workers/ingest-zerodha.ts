import { processIngestion } from "./src/processors/ingestion.processor.js";

const competitorId = "be6bf0f6-a8a6-4b7b-a33f-e80a61212146"; // Zerodha

console.log("Starting ingestion for Zerodha...");

processIngestion(competitorId)
  .then(() => {
    console.log("✓ Ingestion completed");
    process.exit(0);
  })
  .catch(err => {
    console.error("✗ Ingestion failed:", err);
    process.exit(1);
  });
