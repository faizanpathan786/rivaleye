# RivalEye Frontend UX Plan

**Status:** Basic scaffold exists, needs report-centric redesign  
**Goal:** Simple, founder-focused, beautiful report experience

---

## Key Principle

**Don't build a dashboard. Build a research tool.**

The report is the product. UI should get out of the way and let insights shine.

---

## Page Structure

```
/                          → Landing (public)
/auth/signup               → Sign up (public)
/auth/login                → Log in (public)
/dashboard                 → Project list (protected)
/dashboard/new             → Create report (protected)
/dashboard/projects/{id}   → Report detail (protected)
/report/{id}/export        → Download options (protected)
```

---

## Public Landing Page (/)

**Purpose:** Sell the product, show demo report

**Sections:**
1. **Hero**
   - Headline: "Find what customers hate about [competitor] before you build"
   - Subheadline: "Real Reddit data. Real customer pain. Real opportunity."
   - CTA: "See what customers hate about Notion" (demo report link)

2. **Problem**
   - "Before building, you guess"
   - "Spend weeks on surveys"
   - "Miss market signals"

3. **Solution**
   - "Enter a competitor"
   - "Get a pain report in 2 minutes"
   - Show report preview (next section)

4. **Sample Report (Beautiful Preview)**
   - Show actual report structure (see below)
   - Mockup of insights, pain themes, opportunities
   - Screenshot quality high

5. **Pricing**
   - First 5 reports: Free
   - Pay-per-report: $29

6. **Testimonials** (after launch)
   - Founder quotes
   - "Built my entire pitch deck using RivalEye"

7. **CTA**
   - "Try RivalEye Free" → Signup

---

## Authentication Pages

### Signup (/auth/signup)
```
Form:
- Email input
- Password input (show strength meter)
- Sign up button
- "Or log in" link

After signup:
- Create workspace automatically
- Redirect to /dashboard
```

### Login (/auth/login)
```
Form:
- Email input
- Password input
- Log in button
- "Forgot password?" link (future)
- "Sign up" link
```

---

## Main Dashboard (/dashboard)

**Shows:** List of past reports + button to create new

```
┌─────────────────────────────────────────────────┐
│ RivalEye Dashboard                              │
├─────────────────────────────────────────────────┤
│ Welcome back, [User]!                           │
│                                                 │
│ [+ Create New Report]  [Help]  [Settings]      │
│                                                 │
│ Your Reports:                                   │
│ ┌─────────────────────────────────────────┐   │
│ │ Notion (Feb 15, 2026)                   │   │
│ │ 487 mentions, 8 themes found            │   │
│ │ [View] [Export] [Delete]                │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ Slack (Feb 10, 2026)                    │   │
│ │ 312 mentions, 5 themes found            │   │
│ │ [View] [Export] [Delete]                │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ No more reports. [Create one]                  │
└─────────────────────────────────────────────────┘
```

**Components:**
- Page header
- Report list (sortable by date, name)
- Each report: title, date, mention count, quick stats
- Actions: View, Export, Delete
- Create button (prominent)

---

## Create Report (/dashboard/new)

**Single page, simple form:**

```
┌─────────────────────────────────────────────────┐
│ Create Competitor Pain Report                   │
├─────────────────────────────────────────────────┤
│                                                 │
│ What competitor or product do you want to      │
│ understand?                                     │
│                                                 │
│ [Enter competitor name...]                     │
│                                                 │
│ (Hint: "Notion", "Slack", "Copilot", etc)    │
│                                                 │
│ Optional: What's your use case?                 │
│ [Dropdown: B2B SaaS / AI / Productivity]       │
│                                                 │
│ [Generate Report] [Cancel]                     │
│                                                 │
│ This will search Reddit for discussions about  │
│ your competitor and extract customer pain      │
│ points. Takes about 2-3 minutes.               │
│                                                 │
└─────────────────────────────────────────────────┘
```

**After clicking "Generate":**
- Show progress: "Searching Reddit... (1/5)"
- Then: "Analyzing mentions... (2/5)"
- Then: "Grouping themes... (3/5)"
- Then: "Generating report... (4/5)"
- Then: "Almost done... (5/5)"
- Redirect to report page when complete

---

## Report Page (/report/{id})

**This is the main product. Must be beautiful, scannable, actionable.**

```
┌─────────────────────────────────────────────────────────────────┐
│ ◄ Dashboard    Notion Pain Report                 [⋯] [📥]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ EXECUTIVE SUMMARY                                              │
│ ═══════════════════════════════════════════════════════════    │
│                                                                 │
│ Most complaints aren't about missing features. They're about   │
│ pricing for small teams and confusing setup. Your wedge:       │
│ transparent, predictable pricing under $50/mo.                 │
│                                                                 │
│ Signal Strength: STRONG (487 mentions from 8 subreddits)      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ TOP PAIN THEMES                                                │
│ ═══════════════════════════════════════════════════════════    │
│                                                                 │
│ 1. 💰 Pricing Forced Small Teams Away (87 mentions)           │
│    Most complaints are NOT about features—they're about        │
│    pricing. Small team budgets ($0-200/mo) don't fit          │
│    Notion's pricing tiers ($99-299/mo per seat).              │
│                                                                 │
│    [View Evidence ↓]                                           │
│                                                                 │
│    📎 Evidence (showing 2 of 12):                              │
│    ┌─────────────────────────────────────────────────┐       │
│    │ "Notion's pricing is insane for freelancers.    │       │
│    │ I switched to Obsidian because it's free."      │       │
│    │ — r/productivity (42 upvotes)                   │       │
│    │ https://reddit.com/r/productivity/...           │       │
│    └─────────────────────────────────────────────────┘       │
│                                                                 │
│    ┌─────────────────────────────────────────────────┐       │
│    │ "We need Notion's features but at $30/month,   │       │
│    │ not $99/month."                                 │       │
│    │ — r/startups (18 upvotes)                       │       │
│    │ https://reddit.com/r/startups/...               │       │
│    └─────────────────────────────────────────────────┘       │
│                                                                 │
│    [Show More ↓]  [Copy Evidence]                             │
│                                                                 │
│ 2. 🎓 Steep Learning Curve (62 mentions)                      │
│    ...                                                         │
│                                                                 │
│ 3. 🔗 Missing Integrations (45 mentions)                      │
│    ...                                                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ FEATURE REQUESTS (What users want)                            │
│ ═══════════════════════════════════════════════════════════    │
│                                                                 │
│ • Offline access (mentioned 34 times)                         │
│ • Better mobile app (mentioned 28 times)                      │
│ • API with webhooks (mentioned 22 times)                      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ POSITIONING OPPORTUNITY                                        │
│ ═══════════════════════════════════════════════════════════    │
│                                                                 │
│ "The affordable Notion for teams under 10 people"             │
│                                                                 │
│ Suggested landing page angle:                                  │
│ "Notion's power. Linear's simplicity. Your price."            │
│                                                                 │
│ Validation test:                                               │
│ Interview 5 users who mentioned Notion pricing pain and       │
│ ask: "Would you switch to a $49/month alternative that        │
│ does 80% of Notion?"                                          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ NEXT STEPS                                                     │
│ ═══════════════════════════════════════════════════════════    │
│                                                                 │
│ 1. Interview 5 users who complained about pricing             │
│ 2. Test landing page angle with 100 people                    │
│ 3. Analyze competitor pricing (what's under $50/mo?)          │
│ 4. Validate feature priorities with prospects                 │
│                                                                 │
│ [⬇ Download Report as PDF]  [📋 Copy to Clipboard]           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Report Components

#### Tabs (Optional, for long reports)
```
[Summary] [Pain Themes] [Evidence] [Opportunities] [Validation]
```

If only 1 page fits, no tabs needed.

#### Expandable Evidence Drawer
```
Click "View Evidence ↓" → Shows 5-10 most relevant Reddit quotes

Each quote shows:
- Text (truncated to 200 chars)
- Source (r/subreddit, author if visible)
- Engagement (score, comment count)
- Link (direct to Reddit)
- Copy button
```

#### Export Menu (Top right: [⋯])
```
[Download as PDF]
[Download as Markdown]
[Copy to Clipboard]
[Share...]
```

---

## UI/UX Principles

### 1. Emphasis on Evidence
- Every claim backed by quote(s)
- Link to source always visible
- User can verify findings

### 2. Scannable
- Clear hierarchy (headings, subheadings)
- Bullet points > paragraphs
- Icons for themes (💰 pricing, 🎓 learning, 🔗 integrations)
- Short blocks of text

### 3. Actionable
- Report ends with clear next steps
- Suggested validation questions
- Positioning recommendations

### 4. Beautiful, Not Flashy
- Clean typography (system fonts fine)
- Generous spacing
- Soft colors (avoid bright neon)
- Cards for evidence snippets
- No unnecessary animations

### 5. Mobile-Friendly
- Single column on mobile
- Readable at all sizes
- Touch-friendly buttons

---

## Color Scheme

**Light Mode (Primary):**
- Background: #FFFFFF
- Text: #1F2937 (dark gray)
- Accents: #3B82F6 (blue)
- Highlights: #F3F4F6 (light gray)
- Warnings/Negative: #EF4444 (red)
- Success: #10B981 (green)

**Dark Mode (Future):**
- Background: #1F2937
- Text: #F9FAFB
- Accents: #60A5FA (lighter blue)

---

## Loading States

### While generating report:

```
┌─────────────────────────────────────────────────┐
│ Generating Report for Notion                    │
├─────────────────────────────────────────────────┤
│                                                 │
│ Step 2/5: Analyzing mentions...                │
│ [████████░░░░░░░░░░] 40%                       │
│                                                 │
│ This typically takes 2-3 minutes.               │
│ You can close this tab and check back later.    │
│                                                 │
│ Current progress:                               │
│ ✓ Searched Reddit (487 mentions found)          │
│ ⏳ Analyzing sentiment & themes                  │
│ ○ Grouping similar complaints                   │
│ ○ Generating recommendations                    │
│ ○ Creating report                               │
│                                                 │
│ [Cancel Report Generation]                      │
│                                                 │
└─────────────────────────────────────────────────┘
```

### While fetching evidence:

```
Evidence drawer opens:
- Skeleton cards showing while loading
- ~1-2 second load time
```

---

## Error States

### Report generation failed:

```
⚠️  Report generation failed

We couldn't find enough information about Notion on Reddit.

Possible reasons:
- Product is too new or niche
- Reddit doesn't discuss this product
- All sources were removed/deleted

Suggestions:
1. Try a different competitor name spelling
2. Create report for a related product
3. Contact support

[Try Again] [Different Product] [Contact Support]
```

### Network error:

```
❌ Connection lost

Your report was being generated but we lost connection.

[Retry] [Go to Dashboard]
```

---

## Mobile Layout

### Report on mobile:
```
┌──────────────────────────┐
│ ◄ Notion Pain Report    │
│ Share [⋯]               │
├──────────────────────────┤
│ EXECUTIVE SUMMARY        │
│ Most complaints aren't.. │
│                          │
│ Signal: STRONG           │
│ 487 mentions            │
│                          │
├──────────────────────────┤
│ PAIN THEMES             │
│                          │
│ 1. 💰 Pricing (87)      │
│    Most complaints...   │
│    [View Evidence]      │
│                          │
│ 2. 🎓 Learning (62)     │
│    [View Evidence]      │
│                          │
├──────────────────────────┤
│ [⬇ Download PDF]        │
│ [📋 Copy Report]        │
│                          │
└──────────────────────────┘
```

---

## Interaction Patterns

### Copy to Clipboard
```
[📋 Copy to Clipboard]
  → Text copied! (Toast notification, 2s)
  → User can paste into email, Google Docs, etc.
```

### Export Options
```
[⬇ Download Report]
  → [As PDF]          (generates on-demand, downloads)
  → [As Markdown]     (for blogs, docs)
  → [As JSON]         (for integrations later)
```

### View Evidence
```
Evidence snippet:
  "Notion's pricing is insane..."
  
  [View Full Thread] (opens Reddit in new tab)
  [Copy Quote]       (copies to clipboard)
```

---

## Accessibility

**Required for MVP:**
- ✓ Keyboard navigation (Tab through buttons)
- ✓ Color contrast (WCAG AA standard)
- ✓ Alt text on all images
- ✓ Form labels associated with inputs
- ✓ Focus indicators visible

**Nice to Have (Post-MVP):**
- Screen reader testing
- ARIA labels for complex components
- Reduced motion support

---

## Performance Targets

- Page load: <2 seconds
- Report load: <3 seconds (from cache)
- Evidence drawer: <1 second
- PDF export: <5 seconds
- Mobile: <3 seconds on 4G

---

## Component Library (Shadcn UI)

**Already available:**
- Button
- Input
- Card
- Badge
- Separator
- Progress
- Skeleton

**May need to add:**
- Dialog (for confirmation)
- Popover (for tooltips)
- Tabs (if needed)
- Toast (for notifications)

---

## Design Iteration Plan

1. **Week 1:** Wireframes + prototype
2. **Week 2:** Visual design + component build
3. **Week 3:** Integration with backend
4. **Week 4:** Polish + accessibility testing
5. **Week 5:** Beta testing with 5 users
6. **Week 6:** Final tweaks + launch

---

## Definition of "Beautiful UI"

✓ I would show this to a friend without embarrassment  
✓ Report is readable in 5 minutes  
✓ Evidence is easy to verify  
✓ Next steps are clear  
✓ Looks professional, not enterprise-bloated  
✓ Feels fast, even if it's not  

---

## Future Enhancements

- Dark mode toggle
- Print-friendly CSS
- Report templates (different formats)
- Comparison reports (Product A vs B)
- Historical reports (track trends)
- Team comments on reports
