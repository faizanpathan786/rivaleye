import type { NormalizedPost } from "../types";
import type { RawTrustpilotBusiness, RawTrustpilotReview } from "./client";

function safeDate(s: string): Date {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function normalizeTrustpilotPayload(
  business: RawTrustpilotBusiness,
  reviews: RawTrustpilotReview[],
): NormalizedPost[] {
  return reviews.map((review) => normalizeReview(business, review));
}

function normalizeReview(
  business: RawTrustpilotBusiness,
  review: RawTrustpilotReview,
): NormalizedPost {
  const stars = Number.isNaN(review.stars) ? null : review.stars;
  return {
    platform: "trustpilot",
    externalId: `trustpilot:${review.id}`,
    url: `${business.profileUrl}#review-${review.id}`,
    author: review.consumer.displayName || null,
    title: review.title || null,
    body: `${review.text}\n\n— ${stars ?? "?"}/5 by ${review.consumer.displayName}`,
    score: stars,
    numComments: null,
    createdAt: safeDate(review.createdAt),
    raw: { business, review },
  };
}
