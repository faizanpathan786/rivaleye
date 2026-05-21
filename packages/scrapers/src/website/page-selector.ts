const HIGH_VALUE_KEYWORDS: Record<string, number> = {
  pricing: 120,
  features: 95,
  product: 90,
  products: 85,
  solutions: 85,
  customers: 82,
  integrations: 78,
  security: 76,
  "case-studies": 72,
  "case-study": 72,
  compare: 70,
  comparison: 70,
  alternatives: 70,
  "use-cases": 60,
  usecases: 60,
  docs: 55,
  documentation: 55,
  blog: 35,
};

const EXACT_PATH_BONUS: Record<string, number> = {
  pricing: 140,
  features: 115,
  product: 115,
  products: 110,
  solutions: 110,
  customers: 105,
  integrations: 100,
  security: 98,
  docs: 90,
  documentation: 90,
  blog: 65,
};

const LOW_VALUE_KEYWORDS: Record<string, number> = {
  changelog: -20,
  events: -25,
  press: -30,
  news: -30,
  community: -35,
  contact: -35,
  partners: -20,
};

export function scoreUrl(url: string, homepageUrl: string): number {
  try {
    const parsed = new URL(url);
    const homepage = new URL(homepageUrl);

    const path = (parsed.pathname ?? "/").replace(/^\/|\/$/g, "").toLowerCase();

    if (parsed.hostname === homepage.hostname && path === "") return 110;

    let score = 0;
    const pathForMatching = path.replace(/_/g, "-");
    const parts = pathForMatching.split("/").filter(Boolean);

    const lastPart = parts[parts.length - 1];
    if (lastPart !== undefined) {
      score += EXACT_PATH_BONUS[lastPart] ?? 0;
    }

    for (const [keyword, weight] of Object.entries(HIGH_VALUE_KEYWORDS)) {
      if (parts.includes(keyword)) {
        score += weight;
      } else if (pathForMatching.includes(keyword)) {
        score += Math.floor(weight / 2);
      }
    }

    for (const [keyword, penalty] of Object.entries(LOW_VALUE_KEYWORDS)) {
      if (parts.includes(keyword) || pathForMatching.includes(keyword)) {
        score += penalty;
      }
    }

    const depth = parts.length;
    score -= Math.max(0, depth - 1) * 28;

    if (parsed.search) score -= 90;

    return score;
  } catch {
    return -999;
  }
}

export function selectTopUrls(urls: string[], homepageUrl: string, limit = 15): string[] {
  const unique = [...new Map([homepageUrl, ...urls].map((u) => [u, u])).values()];
  return unique
    .sort((a, b) => {
      const diff = scoreUrl(b, homepageUrl) - scoreUrl(a, homepageUrl);
      if (diff !== 0) return diff;
      const lenDiff = a.length - b.length;
      if (lenDiff !== 0) return lenDiff;
      return a.localeCompare(b);
    })
    .slice(0, limit);
}
