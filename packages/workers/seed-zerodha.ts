import { db, competitors, mentions, ingestionJobs } from "@rivaleye/db";
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

console.log(`Database URL: ${process.env.DATABASE_URL?.substring(0, 50)}...`);

async function seedZerodhaVarsity() {
  console.log("🌱 Seeding Zerodha Varsity...\n");

  try {
    // Create competitor
    const [competitor] = await db
      .insert(competitors)
      .values({
        name: "Zerodha Varsity",
        website: "https://zerodha.com/varsity",
      })
      .returning();

    console.log(`✅ Created competitor: ${competitor.name} (ID: ${competitor.id})`);

    // Create sample mentions
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

    const insertedMentions = await db
      .insert(mentions)
      .values(
        sampleMentions.map((m) => ({
          competitorId: competitor.id,
          content: m.content,
          author: m.author,
          subreddit: m.subreddit,
          score: m.score,
          source: "reddit" as const,
        }))
      )
      .returning();

    console.log(`✅ Created ${insertedMentions.length} sample mentions`);

    // Create ingestion job to track classification
    const [job] = await db
      .insert(ingestionJobs)
      .values({
        competitorId: competitor.id,
        status: "in_progress",
        mentionsFetched: insertedMentions.length,
        mentionsClassified: 0,
      })
      .returning();

    console.log(
      `✅ Created ingestion job (ID: ${job.id}) - ready for classification`
    );
    console.log(`\n📊 Summary:`);
    console.log(`   Competitor ID: ${competitor.id}`);
    console.log(`   Mentions: ${insertedMentions.length}`);
    console.log(`   Status: Ready for classification pipeline`);
    console.log(`\n💡 Next: Run the classification processor for this competitor`);
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
}

seedZerodhaVarsity();
