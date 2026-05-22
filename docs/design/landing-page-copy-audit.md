# Landing Page Copy Audit — RivalEye

**Date:** 2026-05-22  
**Status:** Ready for update  
**Scope:** Realign landing page copy from pain-focused to user-perception-layer positioning

---

## Current Page Structure & Copy Issues

### 1. Navigation (Nav.astro)

**Current CTA:** "Run a scan"

**Issue:** Generic, doesn't communicate value.

**Proposed Direction:** Keep "Run a scan" or update to "Get early access" depending on product stage.

**Structure:** Keep as-is.

---

### 2. Hero Section (Hero.astro)

**Current Headline:** "Find what your competitor's users hate — before you build."

**Current Subheadline:** "RivalEye scrapes every complaint about any competitor across Reddit, G2, Capterra, Product Hunt, X, the App Store, Play Store, and Google Maps. AI clusters them into a Pain Report so you ship what users actually want — not what you assume."

**Current CTAs:** "Run a free scan" + "See a sample report"

**Issues:**
- Headline focuses only on "hate" — sounds negative, doesn't communicate full value.
- Subheadline says "complaints" and "Pain Report" — misses love signals, gaps, switch intent.
- Doesn't communicate "user perception layer" — sounds like a complaint tool.
- Doesn't position against traditional competitor research.

**Proposed Direction:**
- **New Headline:** "See what users really think about your competitors."
- **New Subheadline:** "RivalEye scans public conversations, reviews, communities, and competitor websites to uncover what users love, hate, want, and switch for — then turns those signals into decisions for your product, marketing, and growth teams."
- **New CTAs:** "Get early access" (primary), "See how it works" (secondary).
- **Trust stat descriptions:** Keep but update focus from "complaints" to "signals" language.

**Structure:** Keep visual layout (left copy + right terminal), hero spacing, animations.

---

### 3. Problem Section (Problem.astro)

**Current Headline:** "You're building on a hunch."

**Current Copy:** 
- "Three Twitter quotes. Two G2 reviews. A Slack thread... That's the research most teams do..."
- "Real signal lives in thousands of complaints scattered across eight platforms..."
- "RivalEye does. In an afternoon."

**Current Stats:** "47 avg complaints read" (insufficient) vs "2,417 avg complaints available per scan"

**Issues:**
- Headline is solid, but framing is too narrow (complaints only).
- Copy heavily emphasizes "complaints" — should position as "missing the user perception layer."
- Stats are complaint-focused, not signal-focused.

**Proposed Direction:**
- **Keep Headline:** "You're building on a hunch." — Good.
- **Reframe Copy:** 
  - "Your team can study competitor websites, pricing, features, ads, and design. But that still doesn't answer the most important question: what do their users actually think?"
  - "Users already talk in public. They praise what works. They complain about what breaks. They ask for missing features. They compare tools. They look for alternatives."
  - "Most teams find those signals too late — or not at all."
  - "RivalEye changes that. In an afternoon."
- **Reframe Stats:** Move from "complaints" framing to "signals" and "perception layer."

**Structure:** Keep left/right layout, wall-of-complaints visual, animations.

---

### 4. How It Works (HowItWorks.astro)

**Current Headline:** "Three steps. No integrations."

**Current Steps:**
1. "Drop in a competitor."
2. "We read every complaint, everywhere." (says reads complaints, scrapes 8 sources, most scans < 5min)
3. "Get the Pain Report." (clusters into 6 lenses, cites sources)

**Issues:**
- Step 2 says "read every complaint" — too narrow.
- All three steps refer to "Pain Report" — should be "Competitor Perception Report" or "Report."
- Doesn't mention love signals, gaps, switch intent — sounds complaint-only.

**Proposed Direction:**
- **Keep Headline:** "Three steps. No integrations." — Good.
- **Update Steps:**
  1. "Drop in a competitor." ✓ (Keep)
  2. "Scan public conversations across 8 sources." (Remove "complaint" framing; add sources list: Reddit, App Store, Play Store, Hacker News, Product Hunt, Dev.to, competitor websites)
  3. "Get your Competitor Perception Report." (Instead of "Pain Report"; show all four signal types, not just pain)

**Structure:** Keep alternating left/right layout, terminal visuals, step numbers, bullets.

---

### 5. Report Lenses / Features (Features.astro)

**Current Headline:** "Six ways to read the signal."

**Current Lenses:**
1. "Top pain points" — severity-ranked complaints
2. "Feature gaps" — wish-list features
3. "Pricing pain" — pricing objections
4. "Switching signals" — migration intent
5. "Positioning angles" — user language describing competitor
6. "Product opportunities" — derived wedge opportunities

**Issues:**
- Title is good, but first lens is still "pain points" not inclusive of love.
- Missing "Love Signals" — what users praise.
- Should frame as "Love, Pain, Gap, Switch" + supporting signals.
- Lenses map to current product, but should be reordered to lead with love + balanced pain.

**Proposed Direction:**
- **Update Headline:** "What each signal reveals." or keep "Six ways to read the signal."
- **Reorder/Rename Lenses:**
  1. "Love Signals" — What users praise, value, choose, and stay for.
  2. "Pain Signals" — What users complain about, struggle with, or find frustrating.
  3. "Gap Signals" — What users ask for, hack around, or say is missing.
  4. "Switch Signals" — Where users show alternative-seeking, churn risk, or buying intent.
  5. "Pricing Signals" — How users talk about value, plans, limits, and upgrades.
  6. "Positioning Signals" — The exact language users use to describe the product, category, and alternatives.
- **Remove "Product Opportunities" lens** from primary six, or rename to "Evidence" (sourced quotes, links, confidence scores).

**Structure:** Keep 6-column grid, card hover effects, per-lens micro-vizs, but update text.

---

### 6. Sample Report (SampleReport.astro)

**Current Section Label:** "The deliverable"

**Current Headline:** "A live sample. Notion, scanned today."

**Current Copy:** "Every report includes a featured cluster, sourced evidence, a heatmap of all detected clusters, and an action recommendation for each."

**Current Report Title:** "Pain Report"

**Issues:**
- Title says "Pain Report" — should be "Competitor Perception Report."
- Headline focuses on one cluster — doesn't show balanced love/pain/gap/switch view.
- Copy says "featured cluster" + "action recommendation" but doesn't frame as role-based insight.

**Proposed Direction:**
- **Keep Section Label:** "The deliverable" — Good.
- **Rewrite Headline:** "A competitor report your team can actually use."
- **Rewrite Copy:** "Users praise AcmeCRM for integrations and fast setup, but repeatedly complain about pricing, reporting limits, and complexity as teams grow. Here's the full perception breakdown."
- **Update Report Title:** "Competitor Perception Report" (not "Pain Report").
- **Show Evidence:** Keep source quotes, links, confidence scores.

**Structure:** Keep report mock layout (left featured cluster + evidence, right heatmap + lens index), terminal framing.

---

### 7. FAQ (FAQ.astro)

**Current Section Heading:** "The honest answers."

**Current Q&A Topics:**
- What sources do you scan? ✓
- How long does a scan take? ✓
- How accurate are the clusters? ✓
- Is this legal? Privacy? ✓
- How fresh is the data? ✓
- Can I export? ✓
- Pricing? ✓
- How is this different from Google Alerts? ✗ (outdated answer)

**Issues:**
- Q8 answer says "manual research" vs "RivalEye reads thousands, clusters by pain..." — should mention all four signals.
- No FAQ addresses "Is this only for complaints?" or "What is user perception layer?"
- Answers don't emphasize love signals, switch intent, role-based insights.

**Proposed Direction:**
- **Keep all Q&A structure** — Good topics.
- **Update Q6 answer** to replace "manual research" framing with signal types.
- **Add New FAQ:**
  - Q: "Is RivalEye only for finding competitor complaints?"  
    A: "No. RivalEye is balanced. It shows what users love and why they stay, along with pain, gaps, pricing signals, and switch intent."
  - Q: "Who is RivalEye built for?"  
    A: "RivalEye is built for B2B SaaS founders, product teams, marketers, and growth teams that compete in active categories."
- **Reword existing FAQs** to mention love/pain/gap/switch, not just pain/complaints.

**Structure:** Keep sticky left sidebar, Q&A list, expandable details design.

---

### 8. CTA Section (CTA.astro)

**Current Headline:** "Stop guessing. Start scanning."

**Current Subline:** "Your competitor's users are leaving evidence right now. Give us four minutes — we'll hand you the dossier."

**Current CTA:** "Get early access" with email form.

**Trust Badges:** "First scan free, no card" + "Setup time < 30 seconds" + "Cancel anytime"

**Issues:**
- "Stop guessing" is good, but framing is still pain-centric.
- "Give us four minutes" doesn't communicate what they'll learn.
- No mention of role-based value (what Founder/PM/Marketer gets).

**Proposed Direction:**
- **Rewrite Headline:** "Find out what users really think about your competitors."
- **Rewrite Subline:** "Join early access and generate your first competitor perception report. No sales call required. Start with one competitor."
- **Keep CTA:** "Get early access" ✓
- **Update Trust Badges:** 
  - "First scan free, no card" ✓
  - "< 30s to start" ✓
  - "Cancel from settings" ✓

**Structure:** Keep terminal-framed email form, trust badges, atmospheric effects.

---

### 9. Footer (Footer.astro)

**Current Status:** Not read yet — will check in next pass.

---

## Update Priority & Dependencies

| Section | Priority | Dependency | Notes |
|---------|----------|-----------|-------|
| Hero | P0 | None | First impression, must align to user-perception-layer positioning |
| Problem | P0 | None | Sets up the gap RivalEye solves |
| CTA | P0 | None | Conversion goal, must align to hero |
| HowItWorks | P1 | Hero | Updates step 2 + 3 to remove "Pain Report" language |
| Features/Lenses | P1 | Hero | Reorder/rename to Love/Pain/Gap/Switch + supporting signals |
| SampleReport | P1 | HowItWorks | Update report title + copy to reflect balanced signals |
| FAQ | P2 | Hero | Update answers to reflect full signal positioning |
| Nav | P2 | None | Minor: consider updating "Run a scan" to "Get early access" depending on stage |

---

## Copy Style Rules (Per Brief)

- ✓ Use "user perception layer" language
- ✓ Lead with Love/Pain/Gap/Switch signals
- ✓ Emphasize "evidence-backed insights"
- ✓ Show role-based value (Founder, PM, Marketing, Growth)
- ✓ Avoid "complaints" or "pain" as the primary descriptor
- ✗ DO NOT use: "unlock insights," "AI-powered," "revolutionize," "leverage," "synergy," etc.
- ✓ Be specific: sources (Reddit, App Store, etc.), not vague
- ✓ Direct-response SaaS copywriting style (Bly/Ogilvy inspired)

---

## Sections That Do NOT Require Copy Changes

- **Layout, spacing, animations**: Unchanged
- **Component structure**: No new components
- **Navigation flow**: Same sections in same order
- **Terminal/scanlines aesthetic**: Keep intact
- **Stat visualizations**: Keep intact
- **Hero terminal animation**: Keep intact
- **Problem-section complaints marquee**: Keep intact
- **How-It-Works step visuals**: Keep intact
- **Report mock**: Keep intact, just update label copy
- **FAQ interactive behavior**: Keep intact
- **CTA email form**: Keep intact

---

## Success Criteria

When complete, the landing page will:

1. ✓ Explain RivalEye as "user perception layer of competitor research" in hero
2. ✓ Lead with Love/Pain/Gap/Switch signal types (not just pain)
3. ✓ Show balanced user perception, not just complaints
4. ✓ Emphasize evidence-backed insights
5. ✓ Show role-based decision value (Founder → Product, PM → Roadmap, Marketer → Positioning, Growth → Switch intent)
6. ✓ Remove "Pain Report" language, replace with "Competitor Perception Report"
7. ✓ Remove vague SaaS buzzwords
8. ✓ Maintain premium, sharp, direct-response tone
9. ✓ Pass typecheck/lint
10. ✓ No design changes, layout preserved

---

## Next Steps

1. Update all component copy files in `packages/landing/src/components/`
2. Update Hero.astro main headline, subheadline, CTAs
3. Update Problem.astro headline, copy, stats
4. Update HowItWorks.astro step titles + descriptions
5. Update Features.astro lens titles + descriptions
6. Update SampleReport.astro report title + section copy
7. Update FAQ.astro questions + answers
8. Update CTA.astro headline + subline + trust badges
9. Update Footer.astro (if needed)
10. Run typecheck + lint
11. Create landing-page-copy-update-report.md with final summary
