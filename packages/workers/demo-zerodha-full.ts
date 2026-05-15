import Anthropic from "@anthropic-ai/sdk";
import { classificationBatchOutputSchema } from "@rivaleye/shared";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env
const envPath = resolve("../../.env");
const envContent = readFileSync(envPath, "utf-8");
const envVars = envContent.split("\n").filter((line) => line && !line.startsWith("#"));
for (const line of envVars) {
  const [key, value] = line.split("=");
  if (key && value) {
    process.env[key.trim()] = value.trim();
  }
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Comprehensive sample data about Zerodha Varsity
const sampleMentions = [
  {
    id: "m1",
    content:
      "Just started learning options trading with Zerodha Varsity. The free courses are really comprehensive and well-structured. Love how they explain complex concepts in simple terms.",
    author: "user123",
    subreddit: "IndianStreetBets",
    score: 45,
  },
  {
    id: "m2",
    content:
      "Zerodha Varsity is good but the mobile app experience is terrible. It's not responsive and often crashes when loading multiple modules. Thinking of switching to Investopedia for learning.",
    author: "trader456",
    subreddit: "investing",
    score: 32,
  },
  {
    id: "m3",
    content:
      "The new AI-powered quiz feature in Zerodha Varsity is a game changer. Personalized learning paths now available. Competitors like Udemy should take note.",
    author: "financeGeek",
    subreddit: "finance",
    score: 78,
  },
  {
    id: "m4",
    content:
      "Can someone recommend alternatives to Zerodha Varsity? Looking for a platform that covers derivative strategies better. Considering Udacity or Coursera.",
    author: "options_trader",
    subreddit: "stocks",
    score: 23,
  },
  {
    id: "m5",
    content:
      "Zerodha Varsity mentioned in today's market news - seems they're expanding content to include crypto trading basics.",
    author: "news_bot",
    subreddit: "cryptocurrency",
    score: 12,
  },
  {
    id: "m6",
    content:
      "Anyone else using Zerodha Varsity for learning? I think the course structure is excellent compared to other platforms like Udemy or Skillshare. Very impressed!",
    author: "learner789",
    subreddit: "investing",
    score: 56,
  },
  {
    id: "m7",
    content:
      "Zerodha Varsity's latest update includes interactive charts and real-time market data integration. Finally matching feature parity with more expensive platforms.",
    author: "tech_analyst",
    subreddit: "finance",
    score: 67,
  },
  {
    id: "m8",
    content:
      "Seriously considering dropping Investopedia premium and switching to Zerodha Varsity. Better content and it's free. This is a game-changer for retail traders.",
    author: "budget_trader",
    subreddit: "stocks",
    score: 89,
  },
  {
    id: "m9",
    content:
      "The UX is still clunky for beginners on Zerodha Varsity. Would be better if they invested more in design. Platform like Khan Academy sets a better standard.",
    author: "ux_critic",
    subreddit: "investing",
    score: 34,
  },
  {
    id: "m10",
    content:
      "Just completed the options course on Zerodha Varsity. Thoroughly impressed with the depth and practical examples. Highly recommend!",
    author: "options_guru",
    subreddit: "options",
    score: 102,
  },
];

interface ClassificationResult {
  mentionId: string;
  sentiment: string;
  category: string;
  switchIntent: boolean;
  switchIntentTarget: string | null;
  featureShipped: string | null;
  urgency: string;
  competitorMentions: string[];
  summary: string;
  confidence: number;
  relevanceScore: number;
}

async function demonstrateAnalytics() {
  console.log("\n" + "=".repeat(70));
  console.log("🎯 ZERODHA VARSITY - COMPETITIVE INTELLIGENCE ANALYSIS");
  console.log("=".repeat(70));

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
  - competitor_update: use ONLY when the post is discussing or reacting to something Zerodha Varsity recently shipped, announced, or changed
  - feature_request: user is asking for a feature Zerodha Varsity does NOT yet have
  - complaint: user is frustrated with an existing Zerodha Varsity feature or experience
- switchIntent: true if the user is actively looking to switch AWAY from Zerodha Varsity
- switchIntentTarget: if switchIntent is true, the SPECIFIC named product they want to switch to (e.g. "Investopedia") — use null if no specific product is named
- featureShipped: if category is competitor_update, a concise name for the feature/update (e.g. "AI-powered quiz") — null for all other categories
- urgency: low | medium | high
- competitorMentions: array of SPECIFIC named products mentioned (e.g. ["Udemy", "Investopedia"])
- summary: one sentence summarizing the key point (max 150 chars)
- confidence: 0.0–1.0 confidence in your classification
- relevanceScore: 0–100 score for relevance to Zerodha Varsity's product experience and user sentiment

Input items:
${JSON.stringify(items, null, 2)}

Return a JSON array with one object per item. Each object must have: mentionId, sentiment, category, switchIntent, switchIntentTarget, featureShipped, urgency, competitorMentions, summary, confidence, relevanceScore.
Respond ONLY with the JSON array. No markdown, no explanation.`;

  try {
    console.log("\n📤 Classifying mentions with Claude Haiku...");
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0];
    if (text?.type !== "text") throw new Error("Unexpected response type");

    const cleaned = text.text
      .replace(/^```json\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    const parsed = JSON.parse(cleaned) as unknown;
    const validated = classificationBatchOutputSchema.parse(parsed);

    // ────────── GROWTH TAB ANALYTICS ──────────────────────────────────────────

    console.log("\n" + "─".repeat(70));
    console.log("📊 GROWTH TAB ANALYTICS");
    console.log("─".repeat(70));

    // 1. Sentiment Health Score
    const sentimentBreakdown: Record<string, number> = {
      positive: 0,
      negative: 0,
      neutral: 0,
      mixed: 0,
    };

    validated.forEach((r) => {
      sentimentBreakdown[r.sentiment]++;
    });

    const total = Object.values(sentimentBreakdown).reduce((a, b) => a + b, 0);
    const healthScore = Math.round(
      ((sentimentBreakdown.positive + sentimentBreakdown.mixed * 0.5) / total) *
        100
    );

    console.log("\n🎯 SENTIMENT HEALTH SCORE");
    console.log(`   Overall Score: ${healthScore}/100`);

    const healthStatus =
      healthScore >= 70
        ? "✅ Healthy"
        : healthScore >= 40
          ? "⚠️  Mixed"
          : "❌ Struggling";
    console.log(`   Status: ${healthStatus}`);

    console.log("\n   Breakdown:");
    for (const [sentiment, count] of Object.entries(sentimentBreakdown)) {
      const pct = Math.round((count / total) * 100);
      const bar = "█".repeat(Math.round(pct / 5));
      console.log(`      ${sentiment.padEnd(8)}: ${count} (${pct}%) ${bar}`);
    }

    // 2. Products Winning Users Away
    const competitors: Record<string, number> = {};
    validated.forEach((r) => {
      if (r.switchIntentTarget) {
        const key = r.switchIntentTarget.trim();
        if (key) competitors[key] = (competitors[key] || 0) + 1;
      }
      r.competitorMentions.forEach((mention) => {
        const key = mention.trim();
        if (key) competitors[key] = (competitors[key] || 0) + 1;
      });
    });

    const topCompetitors = Object.entries(competitors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    console.log("\n🔴 PRODUCTS WINNING USERS AWAY");
    const maxCount = topCompetitors[0]?.[1] ?? 1;
    topCompetitors.forEach(([name, count], idx) => {
      const pct = Math.round((count / maxCount) * 100);
      const bar = "▄".repeat(Math.round(pct / 10));
      console.log(`   ${idx + 1}. ${name.padEnd(15)} ${count} ${bar}`);
    });

    // 3. Category Breakdown
    const categoryBreakdown: Record<string, number> = {};
    validated.forEach((r) => {
      categoryBreakdown[r.category] = (categoryBreakdown[r.category] || 0) + 1;
    });

    const categories = Object.entries(categoryBreakdown)
      .sort((a, b) => b[1] - a[1]);

    console.log("\n💬 WHAT PEOPLE ARE TALKING ABOUT");
    const maxCategoryCount = categories[0]?.[1] ?? 1;
    const categoryLabels: Record<string, string> = {
      complaint: "Complaints",
      praise: "Praises",
      feature_request: "Feature Requests",
      comparison: "Comparisons",
      pricing: "Pricing",
      ux: "UX Issues",
      performance: "Performance",
      support: "Support",
      competitor_update: "Product Updates",
      other: "Other",
    };

    categories.forEach(([key, count]) => {
      const pct = Math.round((count / maxCategoryCount) * 100);
      const bar = "▓".repeat(Math.round(pct / 10));
      const label = categoryLabels[key] || key;
      console.log(`   ${label.padEnd(18)}: ${count} ${bar}`);
    });

    // 4. Switch Intent Analysis
    const switchIntentCount = validated.filter((r) => r.switchIntent).length;
    const switchIntentRate = Math.round((switchIntentCount / total) * 100);

    console.log("\n⚡ SWITCH INTENT LEADS");
    console.log(`   Total: ${switchIntentCount} users (${switchIntentRate}%)`);

    // 5. Detailed Leads View
    console.log("\n" + "─".repeat(70));
    console.log("📋 DETAILED LEADS (Switch Intent Detected)");
    console.log("─".repeat(70));

    const leads = validated
      .filter((r) => r.switchIntent)
      .sort((a, b) => b.confidence - a.confidence);

    if (leads.length === 0) {
      console.log("   No switch intent leads found.");
    } else {
      leads.forEach((lead, idx) => {
        const mention = sampleMentions.find((m) => m.id === lead.mentionId);
        console.log(`\n   ${idx + 1}. ${mention?.author} (Score: ${mention?.score})`);
        console.log(`      Content: ${mention?.content.substring(0, 60)}...`);
        console.log(
          `      Switching to: ${lead.switchIntentTarget || "Unspecified"}`
        );
        console.log(
          `      Confidence: ${(lead.confidence * 100).toFixed(0)}% | Relevance: ${lead.relevanceScore}/100`
        );
      });
    }

    // 6. Key Insights
    console.log("\n" + "─".repeat(70));
    console.log("💡 KEY INSIGHTS");
    console.log("─".repeat(70));

    const insights: string[] = [];

    if (healthScore >= 70) {
      insights.push(
        `✅ Strong sentiment: ${healthScore}% health score indicates positive user perception`
      );
    } else if (healthScore >= 40) {
      insights.push(
        `⚠️  Mixed feedback: ${healthScore}% health score - address negative concerns`
      );
    } else {
      insights.push(
        `❌ Declining sentiment: ${healthScore}% health score - urgent attention needed`
      );
    }

    const complaints = categoryBreakdown.complaint || 0;
    if (complaints > 0) {
      insights.push(`🚨 ${complaints} complaint(s) detected - focus on UX/stability`);
    }

    if (topCompetitors.length > 0) {
      insights.push(
        `🏆 Top alternative: Users switching to ${topCompetitors[0][0]} (${topCompetitors[0][1]} mentions)`
      );
    }

    const updates = validated.filter((r) => r.category === "competitor_update");
    if (updates.length > 0) {
      insights.push(
        `📢 ${updates.length} product update(s) generating positive buzz`
      );
    }

    const featureGaps = validated.filter(
      (r) => r.category === "feature_request"
    );
    if (featureGaps.length > 0) {
      insights.push(`🔍 ${featureGaps.length} feature gap(s) identified by users`);
    }

    insights.forEach((insight) => {
      console.log(`   ${insight}`);
    });

    // 7. Recommendations
    console.log("\n" + "─".repeat(70));
    console.log("📌 RECOMMENDATIONS");
    console.log("─".repeat(70));

    const recommendations: string[] = [];

    const topComplaints = validated
      .filter((r) => r.category === "complaint")
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    if (topComplaints.length > 0) {
      recommendations.push(
        `🔧 Address mobile app stability (${topComplaints.length} complaints)`
      );
    }

    if (switchIntentRate > 15) {
      recommendations.push(
        `🛑 High churn risk (${switchIntentRate}%) - increase retention focus`
      );
    }

    if (topCompetitors.length > 0) {
      recommendations.push(
        `📈 Differentiate from ${topCompetitors[0][0]} - analyze their strengths`
      );
    }

    if (featureGaps.length > 0) {
      const topFeature = validated
        .filter((r) => r.category === "feature_request")
        .sort((a, b) => b.confidence - a.confidence)[0];
      if (topFeature) {
        recommendations.push(
          `⭐ Prioritize: ${topFeature.summary.substring(0, 50)}...`
        );
      }
    }

    recommendations.forEach((rec, idx) => {
      console.log(`   ${idx + 1}. ${rec}`);
    });

    // Summary Stats
    console.log("\n" + "=".repeat(70));
    console.log("📈 SUMMARY STATISTICS");
    console.log("=".repeat(70));
    console.log(`   Total Mentions Analyzed: ${total}`);
    console.log(`   Average Relevance Score: ${(validated.reduce((sum, r) => sum + r.relevanceScore, 0) / total).toFixed(1)}/100`);
    console.log(`   Average Confidence: ${(validated.reduce((sum, r) => sum + r.confidence, 0) / total * 100).toFixed(1)}%`);
    console.log(`   Switch Intent Rate: ${switchIntentRate}%`);
    console.log(`   Unique Competitors Mentioned: ${topCompetitors.length}`);
    console.log("\n" + "=".repeat(70));
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

demonstrateAnalytics();
