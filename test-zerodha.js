import Anthropic from "@anthropic-ai/sdk";
import { classificationBatchOutputSchema } from "./packages/shared/src/schemas/index.js";
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});
// Sample Reddit mentions about Zerodha Varsity
const sampleMentions = [
    {
        id: "mention-1",
        content: "Just started learning options trading with Zerodha Varsity. The free courses are really comprehensive and well-structured. Love how they explain complex concepts in simple terms.",
        author: "user123",
        subreddit: "IndianStreetBets",
        score: 45,
    },
    {
        id: "mention-2",
        content: "Zerodha Varsity is good but the mobile app experience is terrible. It's not responsive and often crashes when loading multiple modules. Thinking of switching to Investopedia for learning.",
        author: "trader456",
        subreddit: "investing",
        score: 32,
    },
    {
        id: "mention-3",
        content: "The new AI-powered quiz feature in Zerodha Varsity is a game changer. Personalized learning paths now available. Competitors like Udemy should take note.",
        author: "financeGeek",
        subreddit: "finance",
        score: 78,
    },
    {
        id: "mention-4",
        content: "Can someone recommend alternatives to Zerodha Varsity? Looking for a platform that covers derivative strategies better. Considering Udacity or Coursera.",
        author: "options_trader",
        subreddit: "stocks",
        score: 23,
    },
    {
        id: "mention-5",
        content: "Zerodha Varsity mentioned in today's market news - seems they're expanding content to include crypto trading basics.",
        author: "news_bot",
        subreddit: "cryptocurrency",
        score: 12,
    },
];
async function testClassification() {
    console.log("🧪 Testing Classification with Zerodha Varsity\n");
    console.log(`📝 Sample mentions: ${sampleMentions.length}`);
    console.log("─".repeat(60));
    const items = sampleMentions.map((m) => ({
        mentionId: m.id,
        content: m.content.slice(0, 1000),
        author: m.author,
        subreddit: m.subreddit ?? "unknown",
        score: m.score,
    }));
    const prompt = `You are a competitive intelligence analyst. Classify each Reddit post/comment for research about "Zerodha Varsity".

For each item, determine:
- sentiment: positive | negative | neutral | mixed
- category: complaint | praise | feature_request | comparison | pricing | ux | performance | support | competitor_update | other
  - competitor_update: use ONLY when the post is discussing or reacting to something Zerodha Varsity recently shipped, announced, or changed (new feature, pricing change, UI redesign, acquisition, etc.)
  - feature_request: user is asking for a feature Zerodha Varsity does NOT yet have
  - complaint: user is frustrated with an existing Zerodha Varsity feature or experience
- switchIntent: true if the user is actively looking to switch AWAY from Zerodha Varsity
- switchIntentTarget: if switchIntent is true, the SPECIFIC named product they want to switch to (e.g. "Notion", "Linear", "Asana") — must be a real product name, NOT a generic category like "project management tool" or "something else" — use null if no specific product is named
- featureShipped: if category is competitor_update, a concise name for the feature/update being discussed (e.g. "AI writing assistant", "new mobile redesign", "price increase") — null for all other categories
- urgency: low | medium | high (based on language intensity and problem severity)
- competitorMentions: array of SPECIFIC named products or companies mentioned (e.g. ["Notion", "Jira"]) — exclude generic descriptors like "project management tools", "alternatives", "other apps"
- summary: one sentence summarizing the key point (max 150 chars)
- confidence: 0.0–1.0 confidence in your classification
- relevanceScore: 0–100 score for how relevant this post is to understanding Zerodha Varsity's actual product experience, user sentiment, or feature set. Score 0–30 if it merely name-drops Zerodha Varsity without meaningful product context, 31–59 if tangentially related, 60–100 if it is genuinely about using, evaluating, or discussing Zerodha Varsity as a product.

Input items:
${JSON.stringify(items, null, 2)}

Return a JSON array with one object per item. Each object must have: mentionId, sentiment, category, switchIntent, switchIntentTarget, featureShipped, urgency, competitorMentions, summary, confidence, relevanceScore.
Respond ONLY with the JSON array. No markdown, no explanation.`;
    try {
        console.log("\n📤 Sending to Claude Haiku...\n");
        const message = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 4096,
            messages: [{ role: "user", content: prompt }],
        });
        const text = message.content[0];
        if (text?.type !== "text")
            throw new Error("Unexpected response type");
        // Clean JSON response
        const cleaned = text.text
            .replace(/^```json\n?/, "")
            .replace(/\n?```$/, "")
            .trim();
        const parsed = JSON.parse(cleaned);
        const validated = classificationBatchOutputSchema.parse(parsed);
        console.log("✅ Classification successful!\n");
        console.log("📊 Results Summary:");
        console.log("─".repeat(60));
        // Print results in a nice format
        for (const result of validated) {
            const mention = sampleMentions.find((m) => m.id === result.mentionId);
            console.log(`\n📌 ${mention?.content.substring(0, 60)}...`);
            console.log(`   ID: ${result.mentionId}`);
            console.log(`   Sentiment: ${result.sentiment}`);
            console.log(`   Category: ${result.category}`);
            console.log(`   Switch Intent: ${result.switchIntent}`);
            if (result.switchIntentTarget) {
                console.log(`   → To: ${result.switchIntentTarget}`);
            }
            if (result.competitorMentions.length > 0) {
                console.log(`   Competitors: ${result.competitorMentions.join(", ")}`);
            }
            console.log(`   Relevance: ${result.relevanceScore}/100`);
            console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`);
            console.log(`   Summary: ${result.summary}`);
        }
        // Statistics
        console.log("\n📈 Statistics:");
        console.log("─".repeat(60));
        const sentiments = validated.reduce((acc, r) => {
            acc[r.sentiment] = (acc[r.sentiment] || 0) + 1;
            return acc;
        }, {});
        for (const [sentiment, count] of Object.entries(sentiments)) {
            console.log(`   ${sentiment}: ${count}`);
        }
        const avgConfidence = validated.reduce((sum, r) => sum + r.confidence, 0) / validated.length;
        console.log(`   Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
        const avgRelevance = validated.reduce((sum, r) => sum + r.relevanceScore, 0) /
            validated.length;
        console.log(`   Average Relevance: ${avgRelevance.toFixed(1)}/100`);
        const switchIntentCount = validated.filter((r) => r.switchIntent).length;
        console.log(`   Switch Intent Count: ${switchIntentCount}`);
        console.log("\n✨ Test completed successfully!");
    }
    catch (error) {
        console.error("\n❌ Error during classification:");
        console.error(error);
        process.exit(1);
    }
}
testClassification();
