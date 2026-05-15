import Anthropic from "@anthropic-ai/sdk";
import { redditDiscoveryOutputSchema } from "@rivaleye/shared";

console.log(`ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY?.substring(0, 20)}...`);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "sk-ant-",
});

async function testDiscovery() {
  console.log("🔍 Testing discovery for 'Linear'...\n");

  const productName = "Linear";

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a Reddit research expert. Given a software product name, identify ALL the Reddit communities where users discuss this product and its alternatives.

Product: "${productName}"

Return a JSON object with:
- "subreddits": array of 5-8 subreddit names (no r/ prefix) where users genuinely discuss this product. Include: the product's own subreddit (if it exists), subreddits for the product category, subreddits for common alternative products, and general tech/startup communities. Order by relevance — most relevant first.
- "searchTerms": array of 6-10 search queries to find posts about this product across Reddit.

Think broadly — users discuss ${productName} on subreddits about competitors, their job role, and general software communities.

Respond ONLY with valid JSON. No markdown, no explanation.

Example for "ClickUp":
{"subreddits":["clickup","projectmanagement","productivity","notion","Asana","mondaydotcom","smallbusiness","startups"],"searchTerms":["clickup review","clickup alternative","switching from clickup","clickup vs notion","clickup pricing","clickup problems","clickup vs asana","best clickup alternative","clickup too complex","leaving clickup"]}`,
      },
    ],
  });

  const text = message.content[0];
  if (text?.type !== "text") throw new Error("Unexpected Claude response type");

  console.log("📝 Raw response:");
  console.log(text.text.substring(0, 200) + "...\n");

  const cleaned = text.text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

  console.log("🔧 Cleaned JSON:");
  console.log(cleaned.substring(0, 200) + "...\n");

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    const validated = redditDiscoveryOutputSchema.parse(parsed);

    console.log("✅ Discovery successful!\n");
    console.log("📍 Subreddits:");
    validated.subreddits.forEach((s) => console.log(`   • r/${s}`));

    console.log("\n🔎 Search terms:");
    validated.searchTerms.forEach((t) => console.log(`   • "${t}"`));
  } catch (err) {
    console.error("❌ Validation failed:");
    console.error(err);
  }
}

testDiscovery();
