/**
 * Trustpilot Scraper
 * Uses Trustpilot Consumer API v1 (free tier)
 * Requires: TRUSTPILOT_API_KEY env var (get from https://developers.trustpilot.com/)
 *
 * Usage: ts-node trustpilot.ts "<domain or business name>" [reviewPages]
 * Example: ts-node trustpilot.ts "spotify.com" 5
 */

const QUERY = process.argv[2] || "spotify.com";
const REVIEW_PAGES = parseInt(process.argv[3] || "5", 10);
const API_KEY = process.env.TRUSTPILOT_API_KEY;
const BASE = "https://api.trustpilot.com/v1";

if (!API_KEY) {
  console.error("ERROR: Set TRUSTPILOT_API_KEY env var.");
  console.error("Get one at: https://developers.trustpilot.com/");
  process.exit(1);
}

interface BusinessUnit {
  id: string;
  displayName: string;
  name: { identifying: string };
  websiteUrl: string;
  country: string;
  stars: number;
  trustScore: number;
  numberOfReviews: {
    total: number;
    usedForTrustScoreCalculation: number;
    oneStar: number;
    twoStars: number;
    threeStars: number;
    fourStars: number;
    fiveStars: number;
  };
  status: string;
  claimed: boolean;
  categories: { categoryId: string; displayName: string }[];
  profileUrl: string;
  logoUrl: string | null;
}

interface Review {
  id: string;
  stars: number;
  title: string;
  text: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  experiencedAt: string;
  verificationLevel: string;
  isVerified: boolean;
  consumer: {
    displayName: string;
    numberOfReviews: number;
    countryCode: string;
  };
  reviewReply: {
    message: string;
    createdAt: string;
    authorBusinessUserId: string;
  } | null;
  companyReply: { text: string; createdAt: string } | null;
  labels: string[];
  source: string;
  referralEmail: string | null;
}

interface ReviewsResponse {
  reviews: Review[];
  links: { rel: string; href: string; method: string }[];
}

interface BusinessSummary {
  id: string;
  name: string;
  websiteUrl: string;
  trustScore: number;
  stars: number;
  reviewDistribution: BusinessUnit["numberOfReviews"];
  claimed: boolean;
  categories: BusinessUnit["categories"];
  profileUrl: string;
  country: string;
}

interface TrustpilotResult {
  query: string;
  fetchedAt: string;
  business: BusinessSummary | null;
  totalReviewsFetched: number;
  reviews: Review[];
}

async function tpFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ apikey: API_KEY!, ...params });
  const res = await fetch(`${BASE}${path}?${qs}`);
  if (!res.ok) throw new Error(`Trustpilot API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function findBusiness(query: string): Promise<BusinessUnit | null> {
  try {
    const data = await tpFetch<{ businesses: BusinessUnit[] }>("/business-units/search/find", {
      name: query,
      country: "",
    });
    return data.businesses?.[0] ?? null;
  } catch {
    return null;
  }
}

async function getReviews(businessId: string, pages: number): Promise<Review[]> {
  const all: Review[] = [];
  for (let page = 1; page <= pages; page++) {
    try {
      const data = await tpFetch<ReviewsResponse>(`/business-units/${businessId}/reviews`, {
        perPage: "20",
        page: String(page),
        orderBy: "createdat.desc",
        stars: "",
        language: "all",
      });
      if (!data.reviews?.length) break;
      all.push(...data.reviews);
    } catch {
      break;
    }
  }
  return all;
}

async function main() {
  console.error(`Searching Trustpilot for: "${QUERY}"`);

  const business = await findBusiness(QUERY);

  if (!business) {
    console.error("No business found. Try a domain like 'spotify.com' or exact brand name.");
    const output: TrustpilotResult = {
      query: QUERY,
      fetchedAt: new Date().toISOString(),
      business: null,
      totalReviewsFetched: 0,
      reviews: [],
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.error(`Found: ${business.displayName} (score: ${business.trustScore}, ${business.numberOfReviews.total} reviews)`);
  console.error(`Fetching up to ${REVIEW_PAGES * 20} reviews...`);

  const reviews = await getReviews(business.id, REVIEW_PAGES);

  const output: TrustpilotResult = {
    query: QUERY,
    fetchedAt: new Date().toISOString(),
    business: {
      id: business.id,
      name: business.displayName,
      websiteUrl: business.websiteUrl,
      trustScore: business.trustScore,
      stars: business.stars,
      reviewDistribution: business.numberOfReviews,
      claimed: business.claimed,
      categories: business.categories,
      profileUrl: business.profileUrl,
      country: business.country,
    },
    totalReviewsFetched: reviews.length,
    reviews,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch(console.error);
