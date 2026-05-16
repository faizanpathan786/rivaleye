export const ANTI_GENERIC_RULES = `
Rules for specificity — violating any of these will make your output useless:
- Never say "users want better UX" or "users want easier onboarding". Name the exact screen, field, or workflow that is broken.
- Never say "users are frustrated with performance". Name the specific action that is slow, and by how much if stated.
- Never say "users want more integrations". Name the specific tool they are trying to connect.
- Every pain must be grounded in what a real person wrote. Invent nothing.
- If a complaint appears once with no corroboration, exclude it.
- Exact quotes from users outweigh your paraphrase every time.
`.trim();

export const BLOCKED_PHRASES = [
  "improve the user experience",
  "enhance usability",
  "better performance",
  "more features",
  "improve overall",
  "enhance the product",
];

export const FOUNDER_LANGUAGE_RULES = `
Write as if you are advising a founder who ships code this week, not a consultant writing a market research report.
- Be opinionated. Say "build X" not "consider building X".
- Be specific. Say "add a CSV export button on the dashboard" not "improve data export".
- Skip hedging language: no "it seems", "perhaps", "one could argue".
- Rank things. If you list opportunities, the first one should be the most urgent.
- Speak to what the founder controls: features, copy, pricing, positioning, onboarding.
`.trim();

export const EVIDENCE_RULES = `
Evidence discipline — non-negotiable:
- Every claim you make must cite at least one post_id from the posts provided.
- If you cannot cite a post_id, do not include the claim.
- Do not fabricate quotes. Copy them verbatim from the input.
- Do not generalize from a single post. A pattern requires ≥2 independent posts.
`.trim();
