# Landing Page Copy Update Report — RivalEye

**Date Completed:** 2026-05-22  
**Status:** ✅ Complete  
**Branch:** feat/signal-centric-stage-c  

---

## Summary

Updated RivalEye landing page copy to align with new **user-perception-layer** positioning and four-signal model (Love, Pain, Gap, Switch). All changes are copy-only; no design, layout, or component changes were made.

---

## Files Changed

| File | Section | Changes |
|------|---------|---------|
| `packages/landing/src/components/Hero.astro` | Hero headline, subheadline, CTAs | ✅ Updated to user-perception positioning |
| `packages/landing/src/components/Problem.astro` | Problem headline, body copy, stat labels, captions | ✅ Reframed from "complaints" to "user perception layer" |
| `packages/landing/src/components/HowItWorks.astro` | Step 1, 2, 3 titles and descriptions; report title | ✅ Removed "Pain Report", added signal types |
| `packages/landing/src/components/Features.astro` | Lenses section header and all 6 lens titles/descriptions | ✅ Added Love Signals, renamed to signal-centric |
| `packages/landing/src/components/SampleReport.astro` | Report title, section header, evidence captions, lens index | ✅ Changed "Pain Report" → "Perception Report" |
| `packages/landing/src/components/FAQ.astro` | All FAQ questions and answers (8 Q&As updated) | ✅ Aligned to love/pain/gap/switch positioning |
| `packages/landing/src/components/CTA.astro` | CTA headline, subline | ✅ Updated to user-perception language |
| `packages/landing/src/components/Footer.astro` | Footer tagline | ✅ Updated to user-perception positioning |
| `packages/landing/src/components/Nav.astro` | — | No changes needed |

---

## Detailed Changes by Section

### 1. Hero (Hero.astro)

**Before:**
- Headline: "Find what your competitor's users hate — before you build."
- Subheadline: Focused on "complaints" and "Pain Report"
- CTAs: "Run a free scan" + "See a sample report"

**After:**
- Headline: "See what users really think about your competitors."
- Subheadline: "RivalEye scans public conversations, reviews, communities, and competitor websites to uncover what users love, hate, want, and switch for — then turns those signals into decisions for your product, marketing, and growth teams."
- CTAs: "Get early access" + "See how it works" (links to #cta and #how sections)

**Impact:** Hero now clearly communicates the four-signal model and role-based value upfront.

---

### 2. Problem (Problem.astro)

**Before:**
- Copy focused on "thousands of complaints"
- Stat labels: "complaints read" vs "complaints available"
- Badge: "unread by your team"

**After:**
- Copy reframed: "Your team can study competitor websites... but what do their users actually think?"
- Stat labels: "user signals read" vs "user signals available"  
- Badge: "missing from your research"
- Bottom caption: "Real user feedback" instead of "real-format complaints"

**Impact:** Problem section now positions the gap as "missing user perception layer" rather than "missed complaints."

---

### 3. How It Works (HowItWorks.astro)

**Step 2:**
- Before: "We read every complaint, everywhere." (8 sources: Reddit, G2, Capterra, Product Hunt, X, App Store, Play Store, Maps)
- After: "Scan public conversations." (7 sources: Reddit, app reviews, Product Hunt, Hacker News, Dev.to, competitor websites)
- Bullet: "24/7 refresh" → "daily refresh"

**Step 3:**
- Before: "Get the Pain Report." (clusters into 6 lenses including "pain points, feature gaps, pricing pain, switching signals, positioning angles, product opportunities")
- After: "Get your perception report." (user signals organized into "love, pain, gap, and switch signals — plus pricing and positioning insights")
- Bullets updated to reflect "signal lenses" instead of specific lens names

**Report Visual Title:**
- Before: "Pain Report"
- After: "Perception Report"
- Lens index updated to show: Love, Pain, Gap, Switch, Pricing, Positioning (reordered from original)

**Impact:** How It Works now explains the full four-signal model and uses "perception report" terminology consistently.

---

### 4. Report Lenses / Features (Features.astro)

**Header:**
- Before: "Six ways to read the signal." + "Every Pain Report ships with six lenses..."
- After: "Six signal types." + "Every report includes six lenses..."

**Lens Reordering & Renaming:**
1. "Top pain points" → "Love signals" — What users praise, value, choose, and stay for.
2. "Feature gaps" → "Pain signals" — What users complain about, struggle with, or find frustrating.
3. "Pricing pain" → "Gap signals" — What users ask for, hack around, or say is missing.
4. "Switching signals" → "Switch signals" — (renamed, expanded description)
5. "Positioning angles" → "Pricing signals" — How users talk about value, plans, limits, and upgrades.
6. "Product opportunities" → "Positioning signals" — The exact language users use to describe the product, category, and alternatives.

**Impact:** Features section now leads with Love (not Pain) and clearly shows all four core signals plus supporting dimensions.

---

### 5. Sample Report (SampleReport.astro)

**Section Header:**
- Before: "A live sample. Notion, scanned today."
- After: "A competitor report your team can actually use."
- Subheader: Rewritten to emphasize all four signal types + evidence

**Report Title (in window chrome):**
- Before: "rivaleye / report · notion.so · 2026-Q1"
- After: "rivaleye / perception report · notion.so · 2026-Q1"

**Lens Index:**
- Updated all six lens names to match new signal types (Love → Pain → Gap → Switch → Pricing → Positioning)

**Opportunity Callout:**
- Label: "Build this" → "Opportunity"
- Copy: Clarified that performance is the "wedge" with user signal counts

**Impact:** Sample report now clearly shows a balanced perception view, not just pain-focused analysis.

---

### 6. FAQ (FAQ.astro)

**Replaced all 8 Q&As with new signal-centric questions:**

1. "Is RivalEye just social listening?" → Clarifies it's not sentiment tracking, but decision-ready signals
2. "Is this only for complaints?" → Explains balanced love + pain + gap + switch positioning
3. "Who is RivalEye built for?" → Specifies B2B SaaS founders, PMs, marketers, growth teams
4. "What sources does RivalEye analyze?" → Lists public sources (Reddit, Product Hunt, Hacker News, reviews, Dev.to, websites)
5. "How is this different from manually reading?" → Emphasizes clustering, evidence, role-specific dashboards
6. "How long does a scan take?" → (Kept from original)
7. "Does RivalEye generate leads?" → Explains switch-intent discovery is contextual, not spam
8. "Do insights include evidence?" → Clarifies sourcing, quotes, confidence scores

**Impact:** FAQ now positions RivalEye as a perception layer, not a complaint tool, and addresses role-based value.

---

### 7. CTA Section (CTA.astro)

**Headline:**
- Before: "Stop guessing. Start scanning."
- After: "Find out what users really think about your competitors."

**Subline:**
- Before: "Your competitor's users are leaving evidence right now. Give us four minutes — we'll hand you the dossier."
- After: "Join early access and generate your first competitor perception report. No sales call required. Start with one competitor."

**CTAs & Trust Badges:** Unchanged (already aligned)

**Impact:** CTA now emphasizes user perception discovery and removes time pressure ("four minutes"), replacing with clarity on what they'll get.

---

## Copy Style Adherence

✅ **Clear beats clever** — All headlines and body copy are direct and benefit-focused  
✅ **User perception layer language** — Consistently positions RivalEye as the missing research layer  
✅ **Love/Pain/Gap/Switch positioning** — All four signals mentioned across page  
✅ **Evidence-backed insights** — Sourcing and quotes emphasized  
✅ **Role-based value** — Founder, Product, Marketing, Growth perspectives implied through use cases  
✅ **No generic SaaS buzzwords** — Removed "complaints," avoided "leverage," "synergy," "unlock insights," etc.  
✅ **Specific, not vague** — Sources named (Reddit, Product Hunt, etc.), signal types specified  
✅ **Bly/Ogilvy direct-response style** — Short sentences, benefit-forward, urgency without hype  

**Phrases eliminated:**
- "complaints" → "user signals"
- "Pain Report" → "Perception Report"
- "read every complaint" → "scan public conversations"
- "artificial hedging" removed (was: "AI clusters them...")

---

## Design & Layout Impact

✅ **No layout changes** — All existing grid/flex structures preserved  
✅ **No component changes** — Terminal visuals, animations, scanlines remain  
✅ **No spacing adjustments** — Padding, margins, breakpoints unchanged  
✅ **Text fit** — Copy lengths adjusted to fit existing container widths without overflow  
✅ **No new components** — All changes within existing HTML structure  

---

## Quality Checklist

| Criterion | Status | Notes |
|-----------|--------|-------|
| Hero headline communicates core value | ✅ | "See what users really think" is clear |
| Four signal types mentioned | ✅ | Love, Pain, Gap, Switch appear throughout |
| Role-based value is apparent | ✅ | Product, marketing, growth teams referenced |
| No "Pain Report" language remains | ✅ | Replaced with "Perception Report" |
| No buzzwords or jargon | ✅ | Clean, direct language throughout |
| Copy is evidence-backed, not hype | ✅ | Specific sources, signal types, no superlatives |
| TypeScript typecheck passes | ✅ | Landing package compiles without errors |
| Design/layout preserved | ✅ | All Astro components structurally unchanged |
| CTAs are specific and repeated | ✅ | "Get early access" in hero + CTA section |
| Content reads premium and sharp | ✅ | Bly/Ogilvy style applied throughout |

---

## Acceptance Criteria Met

✅ 1. Design stays intact (no layout changes)  
✅ 2. Page explains RivalEye in < 10 seconds (hero headline + subheadline)  
✅ 3. Copy says "user perception layer of competitor research" (hero, problem, CTA sections)  
✅ 4. Does not sound like negativity finder (love signals added, balanced framing)  
✅ 5. Covers love, pain, gaps, switch, pricing, positioning, evidence (all six lenses + FAQ)  
✅ 6. Founder, Product, Marketing, Growth value is clear (implied in section copy + FAQ)  
✅ 7. CTAs specific and repeated ("Get early access" in hero + CTA section)  
✅ 8. No generic AI SaaS buzzwords (cleaned throughout)  
✅ 9. No unsupported metrics or fake proof (all existing social proof preserved)  
✅ 10. Copy feels premium, sharp, easy to understand (Bly/Ogilvy applied)  

---

## Notes for Future Work

**Light Theme Request:**
The original user request mentioned "also make it light themed." A theme change would require updating CSS variables (`--color-bg-0`, `--color-fg-0`, `--color-lime`, etc.) across all components and global styles. This falls outside the "copy update only" scope defined in the brief. If a light theme is desired, that should be a separate design pass with its own component updates and Tailwind recompile.

**"Early Access" Language:**
The updated copy uses "Get early access" language, which is appropriate if the product is still in pre-launch phase. If the product is already live, consider reverting CTAs to "Start free scan" or "Get started." This depends on the current product stage (still early access vs. generally available).

**FAQ Scope Reduction:**
The original FAQ had 8 questions. The new FAQ also has 8 questions but removes several technical/operational details (pricing, export formats, legal/privacy specifics) that were in the original. If these details are important for conversion, consider re-adding 2–3 more detailed FAQs (e.g., "How does pricing work?" or "Is this legal?").

---

## Files to Commit

```
packages/landing/src/components/Hero.astro
packages/landing/src/components/Problem.astro
packages/landing/src/components/HowItWorks.astro
packages/landing/src/components/Features.astro
packages/landing/src/components/SampleReport.astro
packages/landing/src/components/FAQ.astro
packages/landing/src/components/CTA.astro
packages/landing/src/components/Footer.astro
docs/design/landing-page-copy-audit.md
docs/design/landing-page-copy-update-report.md
```

---

## Next Steps

1. ✅ Copy audit created: `docs/design/landing-page-copy-audit.md`
2. ✅ All component files updated with new copy
3. ✅ Copywriting validation checklist passed
4. ✅ Landing page type-checks successfully
5. 🔄 **User review** — Request approval of copy changes before merging
6. 🔄 **Optional: Light theme** — If needed, file separate design task
7. 🔄 **Optional: FAQ expansion** — If detailed operational FAQs needed, add in follow-up PR
8. ⏳ Merge and deploy once approved

---

## Commit Message Template

```
refactor(landing): update copy to user-perception-layer positioning

- Reposition hero from "find what users hate" to "see what users really think"
- Add four-signal model (Love, Pain, Gap, Switch) across all sections
- Rename "Pain Report" → "Perception Report"
- Update FAQ to emphasize balanced signals, not just complaints
- Remove negative-only framing; emphasize user perception layer
- All changes are copy-only; no layout, design, or component changes

Follows Bly-Ogilvy direct-response copywriting style. Acceptance
criteria met. Landing page type-checks successfully.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

**Status:** Ready for review and merge.
