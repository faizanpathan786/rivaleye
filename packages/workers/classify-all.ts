import { processClassification } from "./src/processors/classification.processor.js";

(async () => {
  console.log("Classifying Zerodha...");
  await processClassification("be6bf0f6-a8a6-4b7b-a33f-e80a61212146");
  console.log("✓ Zerodha complete\n");

  console.log("Classifying Zerodha Varsity...");
  await processClassification("a1ac6b18-04df-4b48-a81e-174749e7f0e0");
  console.log("✓ Varsity complete");

  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
