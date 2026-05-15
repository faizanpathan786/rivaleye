import { ingestionQueue } from "./src/queues.js";

async function main() {
  const competitorId = "be6bf0f6-a8a6-4b7b-a33f-e80a61212146"; // Zerodha

  await ingestionQueue.add(
    "ingest",
    { competitorId },
    { attempts: 3, backoff: { type: "exponential", delay: 10_000 } }
  );

  console.log("✓ Ingestion queued for Zerodha");
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
