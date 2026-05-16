import { ScraperError } from "../types";

const BASE = "https://api.trustpilot.com/v1";

export interface RawTrustpilotBusiness {
  id: string;
  displayName: string;
  websiteUrl: string;
  trustScore: number;
  stars: number;
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
  country: string;
  name: { identifying: string };
}

export interface RawTrustpilotReview {
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
  reviewReply: { message: string; createdAt: string; authorBusinessUserId: string } | null;
  companyReply: { text: string; createdAt: string } | null;
  labels: string[];
  source: string;
  referralEmail: string | null;
}

async function tpFetch<T>(apiKey: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ apikey: apiKey, ...params });
  const res = await fetch(`${BASE}${path}?${qs}`);
  if (!res.ok)
    throw new ScraperError("trustpilot", `API ${res.status} at ${path}`);
  return res.json() as Promise<T>;
}

export async function findBusiness(
  apiKey: string,
  query: string,
): Promise<RawTrustpilotBusiness | null> {
  try {
    const data = await tpFetch<{ businesses: RawTrustpilotBusiness[] }>(
      apiKey,
      "/business-units/search/find",
      { name: query, country: "" },
    );
    return data.businesses[0] ?? null;
  } catch {
    return null;
  }
}

export async function getReviews(
  apiKey: string,
  businessId: string,
  pages: number,
): Promise<RawTrustpilotReview[]> {
  const all: RawTrustpilotReview[] = [];
  for (let page = 1; page <= pages; page++) {
    try {
      const data = await tpFetch<{ reviews: RawTrustpilotReview[] }>(
        apiKey,
        `/business-units/${businessId}/reviews`,
        { perPage: "20", page: String(page), orderBy: "createdat.desc", stars: "", language: "all" },
      );
      if (!data.reviews?.length) break;
      all.push(...data.reviews);
    } catch {
      break;
    }
  }
  return all;
}
