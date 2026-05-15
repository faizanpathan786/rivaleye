# RivalEye MVP Product Scope

**Status:** MVP Specification  
**Target Launch:** June 2026

---

## The Problem We're Solving

Founders and product teams want to know:
- What do customers hate about competitors?
- What features are users asking for?
- Why do people switch to/from alternatives?
- What pricing complaints exist?
- Where are the positioning gaps?

**Current solution:** Manual Reddit browsing, scattered notes, gut instinct.

**RivalEye solution:** Enter a competitor, get a founder-friendly pain report backed by real user data.

---

## Target Users (MVP)

### Primary
- **B2B SaaS founders** building competing products
- **Indie hackers** validating market demand before building
- **AI builders** wanting to know what users hate about existing AI tools
- **Early product teams** (2-10 people) making product/positioning decisions

### NOT for MVP
- Product marketers (too niche)
- Enterprise teams (complex workflows)
- Agencies (white-label, billing complexity)
- Daily monitoring use cases (we're for research, not alerts)

---

## The Main User Journey

```
1. Sign up / Login
   ↓
2. Create a project
   "Find what customers hate about Notion"
   ↓
3. System searches Reddit for Notion discussions
   ↓
4. System collects ~500+ real user comments
   ↓
5. System analyzes and clusters complaints/requests
   ↓
6. System generates report with:
   - What users complain about
   - What features they request
   - Why they switch
   - What they like
   - Positioning opportunities
   - Suggested landing page angles
   ↓
7. User reads report, exports it, shares it
   ↓
8. User makes product/positioning decisions
```

---

## MVP Scope: What We Build

### User Can Do (Product Features)

| Feature | Why | When |
|---------|-----|------|
| **Sign up with email** | Need accounts to save reports | P0 |
| **Create a "Find Pain Report"** | Main product | P0 |
| **Enter competitor name or URL** | User input | P0 |
| **See report generating...** | Show progress | P0 |
| **Read report** | Core deliverable | P0 |
| **View evidence** (click on insight → see raw Reddit quotes + links) | Prove findings are real | P0 |
| **Copy report to clipboard** | Easy sharing | P0 |
| **Save/bookmark report** | For later reference | P1 |
| **View past reports** | Project history | P1 |
| **Download as Markdown** | Backup, blog posts | P1 |
| **Try demo report** | No signup | P2 |

### Report Sections (MVP)

A RivalEye report includes:

1. **Executive Summary** (2-3 sentences)
   - "Most complaints aren't about features. They're about pricing for small teams."

2. **Competitors Analyzed**
   - Which subreddits/sources we checked
   - Volume of mentions found
   - Date range

3. **Signal Strength**
   - Strong / Medium / Weak indicator
   - How confident we are in findings

4. **Top Pain Themes** (3-5 clusters)
   - Each theme with:
     - Title: "Pricing forced small teams away"
     - Mention count: 87
     - Evidence count: 12
     - Key quotes (2-3 anonymized Reddit snippets)
     - Link to full evidence

5. **Feature Requests** (if present)
   - What users keep asking for
   - How many mentioned it
   - Sample requests

6. **Support & Onboarding Complaints** (if present)
   - Learning curve issues
   - Documentation gaps
   - Support responsiveness

7. **Switching Reasons** (if present)
   - Why people left this competitor
   - What they switched to

8. **What Users Like** (if present)
   - The good (balanced perspective)
   - What works well

9. **Positioning Opportunities**
   - Your wedge could be: "pricing for small teams"
   - Supporting evidence
   - Suggested landing page angles

10. **Validation Recommendations**
    - Next steps: "Interview 5 users who mentioned pricing pain"
    - Questions to ask
    - Success criteria

11. **Final Verdict**
    - Is there market demand?
    - Confidence level
    - Next actions

---

## What MVP Does NOT Include

### Deliberately Out of Scope
- **Alerts/monitoring** - Not for daily watching, just research
- **Multiple competitors at once** - One report per search
- **Team collaboration** - No comments, approvals, sharing workflows
- **Integration with other tools** - No Slack, no Zapier, no webhooks
- **Custom research questions** - We generate the report, user doesn't customize
- **Predicted market size** - We avoid claiming "market is $X"
- **Competitive rankings** - We avoid saying "Product A is better than B"
- **Sentiment visualization** - No pie charts, no dashboards
- **Historical trends** - No "complaints increasing over time"
- **White-label/resale** - No agency pricing
- **API for enterprises** - No B2B2C

### Will Add Later (Post-MVP)
- Multiple sources (AppStore, G2, Twitter, Hacker News, etc.)
- Team workspaces with permissions
- Custom reports (user selects sources + questions)
- Comparison (Product A vs Product B vs Product C)
- Trend detection (rising/falling complaints)
- Export to Google Docs
- AI follow-up ("Generate 10 cold DM angles")

---

## Success Criteria for MVP

### Functional Success ✓
- [ ] User can sign up
- [ ] User can create a report request
- [ ] System finds Reddit discussions within 2 minutes
- [ ] System generates report with >5 insights
- [ ] User can read report
- [ ] User can view evidence with Reddit links
- [ ] User can export report

### Product Success
- [ ] Report feels like a founder memo, not a dashboard
- [ ] Evidence is backed by real Reddit quotes
- [ ] Report generates actionable next steps
- [ ] User would recommend to a friend

### Market Success
- [ ] First 10 paid reports within 2 weeks of launch
- [ ] Users quote insights in pitch decks
- [ ] Users pay for second report

---

## How MVP Launches

### Phase 1: Manual + Automated (Week 1-2)
- Build infrastructure (classification fix, report gen, report UI)
- Generate reports automatically
- Launch to 10 beta users (Slack communities, Reddit, Twitter)
- Collect feedback

### Phase 2: Freemium (Week 3-4)
- First 5 reports free
- Next reports $29 each
- Track which competitors are most requested
- Iterate based on feedback

### Phase 3: Scale (June onwards)
- Expand to additional sources
- Add team features
- Build "saved reports" marketplace
- Consider monthly subscription

---

## Report Pricing (Test)

### Suggested MVP Pricing
- **Free tier:** 1 free report, then pay-per-report
- **Pay-per-report:**
  - Basic report (1 competitor): $29
  - Deep report (2 competitors + comparison): $49
  - Premium report (custom questions): $99
- **Later:** Monthly subscription for unlimited reports

### Rationale
- $29 is low-friction for founders testing
- $49-99 works for small teams
- Avoid monthly until we have retention proof

---

## MVP Definition of Done

When we can say "MVP is done":

1. **Setup phase** - User signs up, creates project ✓
2. **Discovery phase** - System finds Reddit sources ✓
3. **Ingestion phase** - System fetches mentions ✓
4. **Classification phase** - System analyzes sentiment/category ✓
5. **Clustering phase** - System groups similar complaints ✓
6. **Report generation** - System converts data into report ✓
7. **Report UI** - User reads formatted report ✓
8. **Evidence access** - User sees Reddit quotes + links ✓
9. **Export** - User copies report or downloads ✓
10. **Payment flow** - User can pay or view free report ✓

---

## How This Differs from Competitors

### Competitor Analysis Tools (Generic)
- Semrush, Ahrefs, SimilarWeb → Traffic/SEO/features
- **RivalEye:** User pain + positioning gaps (not traffic)

### Social Listening (Broad)
- Brandwatch, Sprout Social → Monitor all social media
- **RivalEye:** Focused on finding specific competitor pain (not monitoring)

### Customer Research (Manual)
- Typeform surveys, user interviews → What customers tell you
- **RivalEye:** What customers actually say unprompted (in Reddit)

### Survey Tools
- SurveyMonkey, Qualtrics → You design the questions
- **RivalEye:** We curate the insights (turnkey report)

---

## Non-Goals (Stay Focused)

- ❌ Don't build alerts (not the use case)
- ❌ Don't build dashboards (not the use case)
- ❌ Don't build integrations (adds complexity)
- ❌ Don't collect payment ourselves first (use Stripe)
- ❌ Don't build team approval workflows (unnecessary for MVP)
- ❌ Don't add cosmetic visualizations (focus on insights)
- ❌ Don't claim we can predict anything (we just observe)

---

## Roadmap Beyond MVP

### Q3 2026 (Post-MVP)
- Add App Store/Play Store reviews as source
- Add G2/Capterra reviews
- 2-3 competitor comparison reports

### Q4 2026
- Add Twitter/X as source
- Custom report builder (user picks sources + questions)
- Team collaboration features
- Saved report marketplace

### 2027
- Add Hacker News + Product Hunt
- AI-powered follow-ups ("Generate landing page")
- Trend detection
- Enterprise features

---

## Success Metric Definitions

### User Engagement
- **Report completion:** % of users who read full report
- **Export rate:** % who export or share report
- **Retention:** % who return for 2nd report within 30 days
- **NPS:** Would you recommend RivalEye? (target >50)

### Product Quality
- **Report accuracy:** % of insights backed by 3+ sources
- **Time to report:** <2 min for generation (target 60-90 seconds)
- **Evidence quality:** % of users who click "view evidence"

### Business
- **Conversion:** % of free → paid (target 20%)
- **ARPU:** Average revenue per user (target $50+ per report)
- **Churn:** % of users who try once and leave (target <70%)

---

## Launch Checklist

- [ ] Classification pipeline fixed (Claude API)
- [ ] Report generation logic complete
- [ ] Report UI built and polished
- [ ] Evidence drawer implemented
- [ ] Export functionality working
- [ ] Payment processing working
- [ ] Auth flow complete
- [ ] 5 sample reports generated manually for demo
- [ ] Landing page copy written
- [ ] Beta user list (10-20 people)
- [ ] Monitoring/logging in place
- [ ] Database backups tested
- [ ] Secrets rotation plan
- [ ] Error handling for all happy paths
- [ ] Mobile view (at least readable)
- [ ] Accessibility baseline (WCAG A)
