import { redditDiscoveryOutputSchema } from "@rivaleye/shared";
import { RedditClient } from "@rivaleye/reddit-client";
import { config } from "../config.js";
import Anthropic from "@anthropic-ai/sdk";

const reddit = new RedditClient({
  clientId: config.reddit.clientId,
  clientSecret: config.reddit.clientSecret,
  userAgent: config.reddit.userAgent,
});

reddit.start();

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

export async function discoverRedditSources(
  productName: string,
): Promise<{ subreddits: string[]; searchTerms: string[] }> {
  const startTime = Date.now();
  console.error(`🔍 [${new Date().toISOString()}] Discovering Reddit sources for: ${productName}`);

  try {
    // ─── Step 1: Search Reddit for competitor mentions ─────────────────────────
    console.error(`📡 Searching Reddit for "${productName}" mentions...`);

    const redditTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Reddit search timeout (30s)")), 30000)
    );

    const searchResults = await Promise.race([
      reddit.searchPosts(productName, {
        limit: 100,
        sort: "relevance",
        time: "year",
      }),
      redditTimeout,
    ]);

    console.error(`Found ${searchResults.length} posts mentioning "${productName}"`);

  // ─── Step 2: Extract subreddits from search results ────────────────────────
  const subredditCounts = new Map<string, number>();

  for (const post of searchResults) {
    const subreddit = post.subreddit.toLowerCase();
    subredditCounts.set(subreddit, (subredditCounts.get(subreddit) ?? 0) + 1);
  }

  // Sort by mention count, take top communities
  const discoveredSubreddits = Array.from(subredditCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5) // Top 5 active communities
    .map(([name]) => name);

  console.log(
    `✓ Discovered active communities: ${discoveredSubreddits.join(", ")}`
  );

  // ─── Step 3: Generate smart search terms using Claude ────────────────────────
  console.log(`🧠 Generating search terms with Claude...`);

  const searchTermPrompt = `For the product "${productName}", generate 8-10 specific Reddit search queries that would find discussions, comparisons, complaints, and praise.

Examples of good search terms:
- "${productName} vs [competitor]"
- "${productName} complaints"
- "${productName} switching from"
- "${productName} alternatives"
- "${productName} review"
- "best ${productName} features"

Return JSON with single key "searchTerms": [array of 8-10 search queries]
Return ONLY valid JSON, no markdown.`;

  console.error(`🧠 Calling Claude for search terms...`);
  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: searchTermPrompt,
      },
    ],
  });

  const responseText =
    message.content[0]?.type === "text" ? message.content[0].text : "";
  console.error(`✓ Claude response received`);
  const cleanedTerms = responseText
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  let searchTerms: string[] = [];
  try {
    const parsed = JSON.parse(cleanedTerms) as any;
    searchTerms = parsed.searchTerms || [];
  } catch (err) {
    console.warn("Failed to parse search terms, using fallback");
    searchTerms = [
      `${productName} vs`,
      `${productName} complaints`,
      `switching from ${productName}`,
      `${productName} alternatives`,
      `${productName} features`,
    ];
  }

    console.error(`✓ Generated search terms: ${searchTerms.slice(0, 3).join(", ")}...`);

    // ─── Step 4: Validate and combine ──────────────────────────────────────────
    const finalSubreddits = discoveredSubreddits.length > 0
      ? discoveredSubreddits
      : ["investing", "stocks", "finance"]; // Fallback if no mentions found

    // Validate with schema
    const validated = redditDiscoveryOutputSchema.parse({
      subreddits: finalSubreddits,
      searchTerms: searchTerms.slice(0, 10),
    });

    const elapsed = Date.now() - startTime;
    console.error(
      `✓ Discovery complete in ${elapsed}ms: ${validated.subreddits.length} subreddits, ${validated.searchTerms.length} search terms`
    );

    return validated;
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error(`✗ Discovery failed after ${elapsed}ms for "${productName}":`, err instanceof Error ? err.message : err);
    throw err;
  }
}
