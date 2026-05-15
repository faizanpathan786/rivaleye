// Import db AFTER env is loaded (pnpm tsx loads .env automatically with --env-file flag)
import { db, mentions, ingestionJobs } from "@rivaleye/db";
import { eq } from "drizzle-orm";

const COMPETITOR_ID = process.argv[2];

if (!COMPETITOR_ID) {
  console.error("❌ Usage: tsx seed-mentions.ts <competitor-id>");
  process.exit(1);
}

const sampleMentions = [
  {
    content:
      "Just started learning options trading with Zerodha Varsity. The free courses are really comprehensive and well-structured. Love how they explain complex concepts in simple terms.",
    author: "user123",
    subreddit: "IndianStreetBets",
    score: 45,
  },
  {
    content:
      "Zerodha Varsity is good but the mobile app experience is terrible. It's not responsive and often crashes when loading multiple modules. Thinking of switching to Investopedia for learning.",
    author: "trader456",
    subreddit: "investing",
    score: 32,
  },
  {
    content:
      "The new AI-powered quiz feature in Zerodha Varsity is a game changer. Personalized learning paths now available. Competitors like Udemy should take note.",
    author: "financeGeek",
    subreddit: "finance",
    score: 78,
  },
  {
    content:
      "Can someone recommend alternatives to Zerodha Varsity? Looking for a platform that covers derivative strategies better. Considering Udacity or Coursera.",
    author: "options_trader",
    subreddit: "stocks",
    score: 23,
  },
  {
    content:
      "Zerodha Varsity mentioned in today's market news - seems they're expanding content to include crypto trading basics.",
    author: "news_bot",
    subreddit: "cryptocurrency",
    score: 12,
  },
  {
    content:
      "Anyone else using Zerodha Varsity for learning? I think the course structure is excellent compared to other platforms like Udemy or Skillshare. Very impressed!",
    author: "learner789",
    subreddit: "investing",
    score: 56,
  },
  {
    content:
      "Zerodha Varsity's latest update includes interactive charts and real-time market data integration. Finally matching feature parity with more expensive platforms.",
    author: "tech_analyst",
    subreddit: "finance",
    score: 67,
  },
  {
    content:
      "Seriously considering dropping Investopedia premium and switching to Zerodha Varsity. Better content and it's free. This is a game-changer for retail traders.",
    author: "budget_trader",
    subreddit: "stocks",
    score: 89,
  },
  {
    content:
      "The UX is still clunky for beginners on Zerodha Varsity. Would be better if they invested more in design. Platform like Khan Academy sets a better standard.",
    author: "ux_critic",
    subreddit: "investing",
    score: 34,
  },
  {
    content:
      "Just completed the options course on Zerodha Varsity. Thoroughly impressed with the depth and practical examples. Highly recommend!",
    author: "options_guru",
    subreddit: "options",
    score: 102,
  },
];

async function seedMentions() {
  console.log(`\n🌱 Seeding ${sampleMentions.length} mentions for competitor ${COMPETITOR_ID}...\n`);

  try {
    // Insert mentions
    const insertedMentions = await db
      .insert(mentions)
      .values(
        sampleMentions.map((m) => ({
          competitorId: COMPETITOR_ID,
          content: m.content,
          author: m.author,
          subreddit: m.subreddit,
          score: m.score,
          source: "reddit" as const,
        }))
      )
      .returning();

    console.log(`✅ Created ${insertedMentions.length} mentions`);

    // Update ingestion job
    await db
      .update(ingestionJobs)
      .set({
        status: "in_progress",
        mentionsFetched: insertedMentions.length,
        mentionsClassified: 0,
      })
      .where(eq(ingestionJobs.competitorId, COMPETITOR_ID));

    console.log(`✅ Updated ingestion job status to in_progress`);
    console.log(`\n📋 Mentions ready for classification`);
    console.log(`   Total: ${insertedMentions.length}`);
  } catch (error) {
    console.error("❌ Error seeding mentions:", error);
    process.exit(1);
  }
}

seedMentions();
