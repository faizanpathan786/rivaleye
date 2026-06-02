// Quick test — run with: bun --env-file=.env packages/scrapers/src/twitter/test.ts
import { TwitterScraper } from "./index";

const competitor = process.argv[2] ?? "vercel";
const scraper = new TwitterScraper();
console.log(`Scraping Twitter for "${competitor}" (profile posts + mentions + replies)...`);

const posts = await scraper.fetch({ competitor, category: "developer tools", limit: 8 });

const raw = posts.map((p) => p.raw as any);
const profileTweets = raw.filter((p) => p.type === "tweet" && posts.find(x => (x.raw as any) === p)?.author?.toLowerCase().includes(competitor.toLowerCase().slice(0, 4)));
const mentionTweets = raw.filter((p) => p.type === "tweet");
const replies = raw.filter((p) => p.type === "reply");

console.log(`\nTotal: ${posts.length} posts`);
console.log(`  Tweets: ${mentionTweets.length}`);
console.log(`  Replies: ${replies.length}`);
console.log("\n── Sample tweets ──");
mentionTweets.slice(0, 5).forEach((p, i) => console.log(`[${i}] @${p.author}: ${p.text.slice(0, 120)}`));
console.log("\n── Sample replies ──");
replies.slice(0, 10).forEach((p, i) => console.log(`[${i}] @${p.author} → tweet ${p.parentId?.slice(0, 10)}: ${p.text.slice(0, 120)}`));
