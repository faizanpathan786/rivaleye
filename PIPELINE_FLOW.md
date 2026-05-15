# RivalEye Pipeline Flow Diagram

## Complete E2E Flow: Input → Output

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE (Next.js)                            │
│                     http://localhost:3000                                     │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               │ 1. User adds competitor
                               │    "Zerodha Varsity"
                               ▼
        ┌──────────────────────────────────────────────┐
        │  API SERVER (Fastify)                        │
        │  POST /api/competitors                       │
        │  http://localhost:3001                       │
        └──────────┬───────────────────────────────────┘
                   │
                   │ 2. Create competitor in DB
                   ▼
        ┌──────────────────────────────────────────────┐
        │  DATABASE (Supabase PostgreSQL)              │
        │  ├─ competitors table                        │
        │  ├─ reddit_sources table                     │
        │  ├─ mentions table                           │
        │  └─ classifications table                    │
        └──────────┬───────────────────────────────────┘
                   │
                   │ 3. Call discovery service
                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  DISCOVERY PHASE                                                          │
│  ═══════════════════════════════════════════════════════════════════════ │
│                                                                            │
│  Input: "Zerodha Varsity"                                                │
│                                                                            │
│  ┌─────────────────────────┐                                             │
│  │  LLM (Mistral/Claude)   │  Prompt: "Find Reddit communities           │
│  │  Local/Bedrock          │  discussing this product"                   │
│  └────────────┬────────────┘                                             │
│               │                                                            │
│               ▼                                                            │
│  Output: {                                                                │
│    subreddits: ["IndiaInvestments", "investing", "stocks", ...],        │
│    searchTerms: ["Zerodha review", "Varsity tutorial", ...]             │
│  }                                                                         │
│               │                                                            │
│               ▼                                                            │
│  Save to reddit_sources table                                            │
│  ├─ subreddit: "IndiaInvestments"                                        │
│  ├─ search_terms: ["Zerodha review", ...]                               │
│  └─ is_active: true                                                      │
│                                                                            │
└────────────────┬─────────────────────────────────────────────────────────┘
                 │
                 │ 4. Queue ingestion job
                 ▼
        ┌────────────────────────────────────────────┐
        │  JOB QUEUE (Redis + BullMQ)                │
        │  bull:ingestion                            │
        │  └─ Job: {competitorId, status: "queued"} │
        └────────────┬───────────────────────────────┘
                     │
                     │ 5. Worker picks up job
                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  INGESTION PHASE                                                          │
│  ═══════════════════════════════════════════════════════════════════════ │
│                                                                            │
│  WORKER (Node.js BullMQ)                                                 │
│  packages/workers/src/processors/ingestion.processor.ts                  │
│                                                                            │
│  For each Reddit source:                                                 │
│  ┌─────────────────────────────────────────┐                             │
│  │ 1. Fetch subreddit posts (hot + new)    │                             │
│  │    reddit.getSubredditPosts(sub, 100)   │                             │
│  │                                          │                             │
│  │ 2. Search using keywords                │                             │
│  │    reddit.searchPosts(term, 50)         │                             │
│  │                                          │                             │
│  │ 3. Fetch comments from hot posts        │                             │
│  │    reddit.getPostComments(id, 25)       │                             │
│  └──────────────┬──────────────────────────┘                             │
│                 │                                                          │
│                 ▼                                                          │
│  Collect ~1000+ mentions with:                                            │
│  ├─ content (title + text)                                               │
│  ├─ author                                                                │
│  ├─ subreddit                                                             │
│  ├─ score                                                                 │
│  ├─ numComments                                                           │
│  └─ externalId (for deduplication)                                       │
│                 │                                                          │
│                 ▼                                                          │
│  DEDUP: Check if externalId already in DB                                │
│  ├─ Existing: skip                                                        │
│  └─ New: insert in batches of 500                                        │
│                 │                                                          │
│                 ▼                                                          │
│  Save to mentions table (648 new mentions)                               │
│  ├─ competitor_id: UUID                                                  │
│  ├─ source: "reddit"                                                     │
│  ├─ external_id: "reddit_post_xyz"                                       │
│  ├─ content: "How do u get 5% decay..."                                 │
│  ├─ author: "hohoho502"                                                  │
│  ├─ subreddit: "NSEbets"                                                 │
│  ├─ score: 42                                                             │
│  └─ posted_at: timestamp                                                 │
│                 │                                                          │
│                 ▼                                                          │
│  Update ingestion_jobs: status = "completed"                             │
│                 │                                                          │
│                 ▼                                                          │
│  Queue classification job                                                │
│  bull:classification → {competitorId}                                    │
│                                                                            │
└────────────────┬─────────────────────────────────────────────────────────┘
                 │
                 │ 6. Classification worker picks up
                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  CLASSIFICATION PHASE (Batch Processing)                                 │
│  ═══════════════════════════════════════════════════════════════════════ │
│                                                                            │
│  Fetch unclassified mentions: 648 total                                  │
│                                                                            │
│  Process in batches of 10:                                               │
│  ┌──────────────────────────────────────────────┐                        │
│  │ BATCH 1: Mentions 1-10                       │                        │
│  │                                              │                        │
│  │ Prepare input:                               │                        │
│  │ [{                                            │                        │
│  │   mentionId: "uuid-1",                       │                        │
│  │   content: "How do u get 5% decay..." (300) │                        │
│  │   author: "hohoho502",                       │                        │
│  │   subreddit: "NSEbets",                      │                        │
│  │   score: 42                                  │                        │
│  │ }, ... 9 more]                              │                        │
│  │                                              │                        │
│  │ Build prompt:                                │                        │
│  │ "Classify these mentions. Return JSON:      │                        │
│  │  {mentionId, sentiment, category,           │                        │
│  │   relevanceScore, confidence}"              │                        │
│  │                                              │                        │
│  │ Send to LLM:                                 │                        │
│  │ ┌─────────────────────────────────────┐     │                        │
│  │ │ callLLM(prompt)                     │     │                        │
│  │ │ ├─ Local: POST http://localhost:1234│     │                        │
│  │ │ │  (LM Studio/Ollama)               │     │                        │
│  │ │ └─ Cloud: AWS Bedrock/Claude        │     │                        │
│  │ │    (Claude 3 Haiku)                 │     │                        │
│  │ └─────────────────────────────────────┘     │                        │
│  │                                              │                        │
│  │ LLM Response:                                │                        │
│  │ [{                                            │                        │
│  │   mentionId: "uuid-1",                       │                        │
│  │   sentiment: "neutral",                      │                        │
│  │   category: "comparison",                    │                        │
│  │   relevanceScore: 75,                        │                        │
│  │   confidence: 0.92                           │                        │
│  │ }, ... 9 more]                              │                        │
│  │                                              │                        │
│  │ Validate mentionIds match input              │                        │
│  │ Save to classifications table                │                        │
│  └──────────────────────────────────────────────┘                        │
│                 │                                                          │
│                 │ BATCH 2-64: Repeat above                               │
│                 │ (10 mentions each)                                     │
│                 ▼                                                          │
│  ✅ 640 classifications complete                                         │
│                 │                                                          │
│                 ▼                                                          │
│  Queue clustering job                                                    │
│  bull:clustering → {competitorId}                                        │
│                                                                            │
└────────────────┬─────────────────────────────────────────────────────────┘
                 │
                 │ 7. Clustering worker picks up
                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  CLUSTERING PHASE                                                         │
│  ═══════════════════════════════════════════════════════════════════════ │
│                                                                            │
│  Group similar mentions:                                                 │
│  ├─ Similarity scoring (semantic)                                        │
│  ├─ Group threshold: 0.7+ similarity                                     │
│  └─ Generate cluster summaries                                           │
│                                                                            │
│  Output clusters:                                                        │
│  Cluster 1: "UI/UX Complaints" (234 mentions)                            │
│  Cluster 2: "Pricing Discussions" (156 mentions)                         │
│  Cluster 3: "Feature Requests" (89 mentions)                             │
│  ... etc                                                                  │
│                                                                            │
└────────────────┬─────────────────────────────────────────────────────────┘
                 │
                 │ 8. All done - data ready
                 ▼
        ┌──────────────────────────────────────────┐
        │  DATABASE (Final State)                  │
        │                                           │
        │  competitors:                            │
        │  ├─ id: UUID                             │
        │  ├─ name: "Zerodha Varsity"             │
        │  └─ lastSyncedAt: NOW()                 │
        │                                           │
        │  mentions (648 records):                 │
        │  ├─ competitor_id: UUID                  │
        │  ├─ content: "How do u get..."          │
        │  ├─ author: "hohoho502"                  │
        │  └─ ... (all fields)                    │
        │                                           │
        │  classifications (648 records):          │
        │  ├─ mention_id: UUID                     │
        │  ├─ sentiment: "neutral"                 │
        │  ├─ category: "comparison"               │
        │  ├─ relevanceScore: 75                   │
        │  └─ confidence: 0.92                     │
        │                                           │
        │  clusters (20+ clusters):                │
        │  ├─ competitor_id: UUID                  │
        │  ├─ title: "UI/UX Complaints"           │
        │  ├─ mention_count: 234                   │
        │  └─ summary: "Users criticize..."       │
        │                                           │
        └────────────┬───────────────────────────────┘
                     │
                     │ 9. User views dashboard
                     ▼
        ┌────────────────────────────────────────────┐
        │  WEB UI (Next.js)                          │
        │  /dashboard/competitors/[id]               │
        │                                             │
        │  Display:                                  │
        │  ├─ Competitor: Zerodha Varsity           │
        │  ├─ Total Mentions: 648                   │
        │  ├─ Sentiment Distribution:               │
        │  │  ├─ Positive: 156 (24%)                │
        │  │  ├─ Negative: 234 (36%)                │
        │  │  ├─ Neutral: 198 (30%)                 │
        │  │  └─ Mixed: 60 (10%)                    │
        │  ├─ Top Categories:                       │
        │  │  ├─ Complaint (234)                    │
        │  │  ├─ Comparison (156)                   │
        │  │  └─ Feature Request (89)               │
        │  ├─ Clusters:                             │
        │  │  ├─ UI/UX Issues (234)                 │
        │  │  ├─ Pricing (156)                      │
        │  │  └─ New Features (89)                  │
        │  └─ Individual Mentions with details      │
        │                                             │
        └────────────────────────────────────────────┘
```

## Data Flow Summary

```
USER INPUT
    ↓
DISCOVERY (LLM) → Find Reddit sources
    ↓
INGESTION (Reddit API) → Fetch mentions (648)
    ↓
CLASSIFICATION (LLM batch) → Analyze each mention
    ├─ Sentiment (positive/negative/neutral/mixed)
    ├─ Category (complaint/praise/feature_request/etc)
    ├─ Relevance Score (0-100)
    └─ Confidence (0.0-1.0)
    ↓
CLUSTERING → Group similar mentions
    ↓
DATABASE STORAGE
    ├─ competitors
    ├─ mentions (648)
    ├─ classifications (648)
    └─ clusters (20+)
    ↓
UI DISPLAY → Dashboard visualization
```

## Time & Cost Breakdown

### Option 1: Local (Phi 2.7B + LM Studio)
```
Discovery:        2 min   (1 LLM call)
Ingestion:       10 min   (Reddit API)
Classification:  15 min   (64 batches × 10 mentions)
Clustering:       5 min
─────────────────────────
TOTAL:           32 min
COST:            $0 (your Mac CPU/GPU)
HEAT:            Medium-High (fan noise)
```

### Option 2: Cloud (Claude 3 Haiku + AWS Bedrock)
```
Discovery:        5 sec  ($0.001)
Ingestion:       10 min  ($0)
Classification:   3 min  ($2.50 for 648 mentions)
Clustering:       5 min  ($0)
─────────────────────────
TOTAL:           18 min
COST:            ~$2.50 per run
HEAT:            None
```

## Key Database Tables

```sql
-- Competitors
competitors (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  name TEXT,
  slug TEXT,
  website TEXT,
  status TEXT, -- 'active', 'paused', 'archived'
  last_synced_at TIMESTAMP
)

-- Reddit Sources
reddit_sources (
  id UUID PRIMARY KEY,
  competitor_id UUID FOREIGN KEY,
  subreddit TEXT,
  search_terms TEXT[],
  is_active BOOLEAN,
  created_at TIMESTAMP
)

-- Mentions (Raw Reddit Data)
mentions (
  id UUID PRIMARY KEY,
  competitor_id UUID FOREIGN KEY,
  source TEXT, -- 'reddit', 'twitter', etc
  external_id TEXT, -- 'reddit_post_xyz'
  author TEXT,
  content TEXT,
  url TEXT,
  score INTEGER,
  num_comments INTEGER,
  subreddit TEXT,
  post_type TEXT, -- 'post' or 'comment'
  posted_at TIMESTAMP,
  created_at TIMESTAMP
)

-- Classifications (LLM Output)
classifications (
  id UUID PRIMARY KEY,
  mention_id UUID FOREIGN KEY,
  sentiment TEXT, -- positive/negative/neutral/mixed
  category TEXT, -- complaint/praise/feature_request/etc
  switch_intent BOOLEAN,
  switch_intent_target TEXT,
  feature_shipped TEXT,
  urgency TEXT, -- low/medium/high
  competitor_mentions TEXT[],
  summary TEXT,
  confidence FLOAT,
  relevance_score INTEGER,
  is_relevant BOOLEAN, -- relevance_score >= 60
  created_at TIMESTAMP
)

-- Clusters (Grouped Mentions)
clusters (
  id UUID PRIMARY KEY,
  competitor_id UUID FOREIGN KEY,
  title TEXT,
  summary TEXT,
  mention_count INTEGER,
  average_sentiment TEXT,
  created_at TIMESTAMP
)
```

## Job Queue States (Redis + BullMQ)

```
Ingestion Queue:
├─ PENDING: Job waiting for worker
├─ ACTIVE: Worker processing
├─ COMPLETED: Job done
└─ FAILED: Job error (retries 3x)

Classification Queue:
├─ WAITING: 64 batch jobs queued
├─ ACTIVE: Worker processing batches
├─ COMPLETED: All batches done
└─ FAILED: LLM error (retries)

Clustering Queue:
├─ WAITING: 1 job queued
├─ ACTIVE: Worker processing
└─ COMPLETED: Clusters generated
```

