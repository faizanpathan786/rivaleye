import { callLLM } from "./packages/shared/src/llm-client.js";

// Sample mention to classify
const testMention = {
  content: "Zerodha Varsity is great for learning but the interface is clunky compared to Interactive Brokers. Thinking of switching.",
  author: "trader_john",
  subreddit: "investing",
  score: 42,
};

// Sample discovery prompt
const discoveryPrompt = `Find Reddit communities discussing "Zerodha Varsity".

Return JSON:
{"subreddits": [5-8 relevant subreddit names], "searchTerms": [6-10 search queries]}

Include product's own sub, category subs, competitor subs, tech communities.
Search terms: reviews, alternatives, complaints, pricing, switching intent.

JSON only, no explanation.`;

// Classification prompt
const classificationPrompt = `Classify this Reddit post about Zerodha Varsity:

Content: "${testMention.content}"
Author: ${testMention.author}
Subreddit: ${testMention.subreddit}

Return JSON only:
{"sentiment":"positive|negative|neutral|mixed", "switchIntent":true|false, "category":"complaint|praise|feature_request|comparison|pricing|ux|performance|support|competitor_update|other"}`;

async function benchmark(modelName: string) {
  console.log(`\n🧪 Testing ${modelName}...`);
  console.log("═".repeat(60));

  const startTime = Date.now();
  let tokenCount = 0;

  try {
    // Test 1: Discovery
    console.log("\n1️⃣  Discovery Task:");
    const t1 = Date.now();
    const discovery = await callLLM(discoveryPrompt);
    const discoveryTime = Date.now() - t1;
    tokenCount += discovery.usage.outputTokens;
    console.log(`   ✅ Time: ${discoveryTime}ms`);
    console.log(`   ✅ Output tokens: ${discovery.usage.outputTokens}`);

    // Test 2: Classification
    console.log("\n2️⃣  Classification Task:");
    const t2 = Date.now();
    const classification = await callLLM(classificationPrompt);
    const classificationTime = Date.now() - t2;
    tokenCount += classification.usage.outputTokens;
    console.log(`   ✅ Time: ${classificationTime}ms`);
    console.log(`   ✅ Output tokens: ${classification.usage.outputTokens}`);

    // Summary
    const totalTime = Date.now() - startTime;
    console.log(`\n📊 Summary for ${modelName}:`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Total tokens: ${tokenCount}`);
    console.log(`   Tokens/second: ${(tokenCount / (totalTime / 1000)).toFixed(1)}`);

    return {
      model: modelName,
      totalTime,
      tokenCount,
      tokensPerSecond: tokenCount / (totalTime / 1000),
    };
  } catch (err) {
    console.error(`   ❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function main() {
  console.log("🏁 MODEL BENCHMARKING SUITE");
  console.log("═".repeat(60));
  console.log("\nThis will test different models on your machine.");
  console.log("Make sure Ollama is running: ollama serve\n");

  const models = [
    "mistral",
    "neural-chat",
    "llama2",
    "zephyr",
  ];

  const results: any[] = [];

  for (const model of models) {
    process.env.LOCAL_LLM_MODEL = model;
    const result = await benchmark(model);
    if (result) results.push(result);
  }

  // Ranking
  console.log("\n\n🏆 RESULTS RANKING");
  console.log("═".repeat(60));

  const bySpeed = [...results].sort((a, b) => a.totalTime - b.totalTime);
  const byThroughput = [...results].sort((a, b) => b.tokensPerSecond - a.tokensPerSecond);

  console.log("\n⚡ Fastest Models:");
  bySpeed.forEach((r, i) => {
    console.log(`${i + 1}. ${r.model} - ${r.totalTime}ms`);
  });

  console.log("\n🚀 Best Throughput (tokens/sec):");
  byThroughput.forEach((r, i) => {
    console.log(`${i + 1}. ${r.model} - ${r.tokensPerSecond.toFixed(1)} tokens/sec`);
  });

  console.log("\n💡 Recommendation for RivalEye:");
  const fastest = bySpeed[0];
  const bestThroughput = byThroughput[0];
  console.log(`   Use ${fastest.model} for speed (${fastest.totalTime}ms per batch)`);
  console.log(`   Use ${bestThroughput.model} for throughput (${bestThroughput.tokensPerSecond.toFixed(1)} tokens/sec)`);
}

main().catch(console.error);
