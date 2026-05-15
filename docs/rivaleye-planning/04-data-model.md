# RivalEye Data Model

**Status:** Schema ready, migration plan included  
**Approach:** Add new tables, keep old for compatibility, deprecate later

---

## Current Schema → Future Schema Migration

### What Needs to Change

**Current Problem:**
- "Competitors" table doesn't fit MVP use case
- A "competitor" could be a topic (Notion) or person (Elon Musk) or feature (AI chatbots)
- We need "projects" to contain multiple competitors in future

**Solution:**
- Rename logical entity: competitors → projects
- Keep table name flexibility (can be `projects` or add new table)
- Add `search_query` field to clarify what we're searching for

### Migration Path

**Option A: Rename competitors → projects (non-breaking)**
```sql
-- Add new column to competitors table
ALTER TABLE competitors ADD COLUMN search_query VARCHAR(500);
ALTER TABLE competitors ADD COLUMN source_types TEXT[] DEFAULT ARRAY['reddit'];
ALTER TABLE competitors RENAME TO projects;
```

**Option B: Create new projects table, migrate data (safer)**
```sql
-- Create new table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  search_query VARCHAR(500) NOT NULL,
  name VARCHAR(255),  -- For display (same as search_query usually)
  source_types TEXT[] NOT NULL DEFAULT ARRAY['reddit'],
  status project_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB  -- Store extra data: industries, target market, etc.
);

-- Migrate data
INSERT INTO projects (workspace_id, search_query, name, source_types, status, created_at)
SELECT workspace_id, name, name, ARRAY['reddit'], status, created_at FROM competitors;

-- Keep competitors table for backward compatibility (30 days), then drop
```

**Recommendation:** Use **Option B** (safer, allows rollback)

---

## Full Schema (MVP Ready)

### Core User Tables

#### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

**Purpose:** Authentication & identification  
**Retention:** Forever (user accounts)  
**Archive strategy:** Soft-delete flag (is_active BOOLEAN)

---

#### workspaces
```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workspaces_owner ON workspaces(owner_id);
```

**Purpose:** Multi-tenant isolation  
**Retention:** Forever  
**Queries:** Get workspace by owner, list user's workspaces

---

#### workspace_members
```sql
CREATE TABLE workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role workspace_member_role NOT NULL DEFAULT 'member',  -- 'owner', 'member'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
```

**Purpose:** Team collaboration (MVP: just owner, future: multiple members)  
**Retention:** Until member removed  
**Archiving:** Delete row

---

### Core Business Tables

#### projects (NEW - renamed from competitors)
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- What we're searching for
  search_query VARCHAR(500) NOT NULL,  -- "Notion", "Slack", "Copilot pricing"
  name VARCHAR(255),  -- Display name (usually same as search_query)
  
  -- Source configuration
  source_types TEXT[] NOT NULL DEFAULT ARRAY['reddit'],  -- ['reddit'], ['reddit','appstore'], etc
  
  -- Status tracking
  status project_status NOT NULL DEFAULT 'pending',  -- pending/processing/complete/failed
  error TEXT,  -- If status=failed, why did it fail?
  
  -- Metadata
  industry VARCHAR(255),  -- Optional: "fintech", "productivity", "ai", etc
  target_market VARCHAR(500),  -- Optional: "B2B SaaS founders", "indie hackers"
  
  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Versioning (for re-runs later)
  version INT DEFAULT 1,
  
  -- Extra data stored as JSON
  metadata JSONB DEFAULT '{}'  -- Store anything: urls, screenshots, notes
);

CREATE INDEX idx_projects_workspace ON projects(workspace_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created ON projects(created_at DESC);
```

**Purpose:** Represents one "Find competitor pain" search  
**Retention:** Forever (archive old projects)  
**Queries:** List projects by workspace, filter by status, find completed projects
**Notes:** Replaces `competitors` table concept

---

#### source_configs (NEW)
```sql
CREATE TABLE source_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL,  -- 'reddit', 'appstore', 'g2'
  config JSONB NOT NULL,  -- Source-specific config
  -- Reddit example: {"subreddit": "IndiaInvestments", "search_terms": ["Zerodha"]}
  -- AppStore example: {"app_id": "1234567", "app_name": "Notion"}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_source_configs_project ON source_configs(project_id);
CREATE INDEX idx_source_configs_type ON source_configs(source_type);
```

**Purpose:** Store discovery results (which subreddits/sources to search)  
**Retention:** For project lifetime  
**Replaces:** reddit_sources (makes it generic)

---

#### mentions
```sql
CREATE TABLE mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Deduplication
  source VARCHAR(50) NOT NULL,  -- 'reddit', 'appstore', 'g2', etc
  external_id VARCHAR(500) NOT NULL,  -- Reddit: "reddit_t1_abc123", AppStore: "appstore_review_123"
  UNIQUE(project_id, external_id),  -- Prevent duplicates per project
  
  -- Content
  content TEXT NOT NULL,  -- Main text
  author VARCHAR(255),  -- Reddit: username, AppStore: anonymous
  url VARCHAR(1000) NOT NULL,  -- Reddit: permalink, AppStore: app store link
  
  -- Metadata (varies by source)
  source_metadata JSONB,  -- Reddit: {subreddit, post_type, score, num_comments}
                          -- AppStore: {rating, version}
                          -- G2: {rating, verified_user}
  
  -- Engagement signals
  score INT DEFAULT 0,  -- Reddit: upvote count, AppStore: star rating * 100
  num_comments INT DEFAULT 0,  -- Reddit only
  
  -- Timing
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Processed flags
  is_relevant BOOLEAN DEFAULT NULL,  -- null=unclassified, true=relevant, false=noise
  needs_review BOOLEAN DEFAULT FALSE  -- Manual review flag
);

CREATE INDEX idx_mentions_project ON mentions(project_id);
CREATE INDEX idx_mentions_source ON mentions(source);
CREATE INDEX idx_mentions_posted ON mentions(posted_at DESC);
CREATE INDEX idx_mentions_external_id ON mentions(external_id);
CREATE INDEX idx_mentions_relevant ON mentions(is_relevant) WHERE is_relevant IS NOT NULL;
```

**Purpose:** Raw data from sources  
**Retention:** Project lifetime + 90 days (archive old projects)  
**Queries:** Get unclassified mentions, get mentions by source, find duplicates
**Storage:** ~1KB per mention average (1000 mentions = 1MB)

---

#### classifications
```sql
CREATE TABLE classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mention_id UUID NOT NULL REFERENCES mentions(id) ON DELETE CASCADE UNIQUE,
  
  -- LLM outputs
  sentiment sentiment NOT NULL,  -- 'positive', 'negative', 'neutral', 'mixed'
  category category NOT NULL,  -- See enum below
  
  -- Signals
  relevance_score REAL NOT NULL CHECK (relevance_score >= 0 AND relevance_score <= 100),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  
  -- Extracted insights
  summary TEXT,  -- Short summary of the mention
  urgency urgency,  -- 'low', 'medium', 'high'
  has_switching_intent BOOLEAN DEFAULT FALSE,
  switch_target VARCHAR(255),  -- "Slack", "Linear", etc
  feature_requests TEXT[],  -- ["better pricing", "api access"]
  
  -- Competitors mentioned
  competitor_mentions TEXT[],  -- ["Notion", "Jira"]
  
  -- Timing
  classified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_classifications_mention ON classifications(mention_id);
CREATE INDEX idx_classifications_sentiment ON classifications(sentiment);
CREATE INDEX idx_classifications_category ON classifications(category);
CREATE INDEX idx_classifications_relevance ON classifications(relevance_score DESC);
```

**Category Enum:**
```sql
CREATE TYPE category AS ENUM (
  'complaint',        -- Something doesn't work / too expensive / slow
  'praise',           -- Something works well
  'feature_request',  -- User wants a feature
  'comparison',       -- Comparing to alternatives
  'pricing',          -- About pricing specifically
  'ux',               -- About user experience / UI
  'performance',      -- About speed / reliability
  'support',          -- About customer support
  'onboarding',       -- About learning / setup
  'integration',      -- About connecting to other tools
  'security',         -- About trust / privacy / security
  'competitor_update', -- News about competitor changes
  'other'             -- Doesn't fit above
);

CREATE TYPE urgency AS ENUM ('low', 'medium', 'high');
```

**Purpose:** LLM classification results  
**Retention:** Project lifetime  
**Queries:** Get unclassified mentions, get complaints, get feature requests, group by category

---

#### clusters (insight groupings)
```sql
CREATE TABLE clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- What this cluster is about
  label VARCHAR(500) NOT NULL,  -- "Pricing forced small teams away", "Setup is confusing"
  category category NOT NULL,  -- complaint / request / etc
  
  -- Signals
  sentiment sentiment NOT NULL,  -- mixed/negative/positive
  mention_count INT NOT NULL,  -- How many mentions in this cluster
  strength VARCHAR(50) NOT NULL,  -- 'strong' / 'medium' / 'weak' signal
  
  -- Evidence
  evidence_mention_ids UUID[] NOT NULL,  -- Top 3-5 representative mention IDs
  
  -- Details
  summary TEXT,  -- "Most complaints are about pricing for small teams"
  recommendations TEXT[],  -- ["emphasize pricing for small teams"]
  
  -- Trends (later: for historical comparison)
  trend_direction VARCHAR(50) DEFAULT 'stable',  -- 'rising' / 'stable' / 'falling'
  
  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_clusters_project ON clusters(project_id);
CREATE INDEX idx_clusters_category ON clusters(category);
CREATE INDEX idx_clusters_strength ON clusters(strength);
```

**Purpose:** Grouped insights (pain themes, feature requests, opportunities)  
**Retention:** Project lifetime  
**Storage:** ~500B per cluster, 20 clusters = 10KB
**Queries:** Get clusters for report, group by category, sort by strength

---

#### reports (NEW)
```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  
  -- Report content (stored as JSON for flexibility)
  status report_status NOT NULL DEFAULT 'generating',  -- generating / complete / failed
  
  report_data JSONB,  -- Full report structure:
  -- {
  --   "summary": "...",
  --   "competitors_analyzed": [...],
  --   "signal_strength": "strong",
  --   "pain_themes": [{label, count, quotes}],
  --   "feature_requests": [...],
  --   "opportunities": [...],
  --   "validation_recommendations": [...]
  -- }
  
  -- Metadata
  generated_at TIMESTAMP WITH TIME ZONE,
  source_count INT,  -- How many sources were analyzed
  mention_count INT,  -- How many mentions were analyzed
  
  -- Generated at
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reports_project ON reports(project_id);
CREATE INDEX idx_reports_created ON reports(created_at DESC);
```

**Purpose:** Generated reports (final deliverable)  
**Retention:** Forever  
**Storage:** ~50KB per report (relatively compact JSON)
**Notes:** Storing report as JSON allows:
  - Easy versioning (regenerate with new algorithm)
  - Full export capability
  - Flexibility if report structure changes

---

### Job Tracking Tables

#### source_discovery_jobs (NEW)
```sql
CREATE TABLE source_discovery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Tracking
  status job_status NOT NULL DEFAULT 'pending',
  error TEXT,
  
  -- Results
  sources_found INT DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_discovery_jobs_project ON source_discovery_jobs(project_id);
CREATE INDEX idx_discovery_jobs_status ON source_discovery_jobs(status);
```

---

#### ingestion_jobs
```sql
-- Already exists, enhance with more tracking
ALTER TABLE ingestion_jobs ADD COLUMN IF NOT EXISTS error_type VARCHAR(50);
ALTER TABLE ingestion_jobs ADD COLUMN IF NOT EXISTS mentions_deduplicated INT DEFAULT 0;
ALTER TABLE ingestion_jobs ADD COLUMN IF NOT EXISTS sources_processed INT DEFAULT 0;
```

---

#### classification_jobs (NEW)
```sql
CREATE TABLE classification_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Tracking
  status job_status NOT NULL DEFAULT 'pending',
  error TEXT,
  
  -- Progress
  total_mentions INT,
  classified_count INT DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_classification_jobs_project ON classification_jobs(project_id);
CREATE INDEX idx_classification_jobs_status ON classification_jobs(status);
```

---

#### report_generation_jobs (NEW)
```sql
CREATE TABLE report_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Tracking
  status job_status NOT NULL DEFAULT 'pending',
  error TEXT,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_report_generation_jobs_project ON report_generation_jobs(project_id);
```

---

### Export & Sharing Tables

#### report_exports (NEW)
```sql
CREATE TABLE report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  
  -- Format & storage
  format export_format NOT NULL,  -- 'pdf' / 'markdown' / 'json'
  status export_status NOT NULL DEFAULT 'generating',  -- generating / ready / failed
  file_url VARCHAR(1000),  -- S3 / Cloudinary URL
  file_size_bytes INT,  -- For tracking storage
  
  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,  -- Delete after 30 days
  
  -- Tracking
  download_count INT DEFAULT 0,
  last_downloaded TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_exports_report ON report_exports(report_id);
CREATE INDEX idx_exports_format ON report_exports(format);
CREATE INDEX idx_exports_status ON report_exports(status);
```

---

## Enums & Types

```sql
CREATE TYPE project_status AS ENUM (
  'pending',      -- Waiting to start discovery
  'discovering',  -- Finding Reddit sources
  'discovered',   -- Found sources, waiting for ingestion
  'ingesting',    -- Fetching mentions
  'ingested',     -- Mentions fetched, waiting for classification
  'classifying',  -- Analyzing mentions
  'classified',   -- Mentions analyzed, waiting for clustering
  'clustering',   -- Grouping similar mentions
  'clustered',    -- Clusters ready, waiting for report generation
  'generating',   -- Converting to report
  'complete',     -- Done!
  'failed'        -- Error occurred
);

CREATE TYPE job_status AS ENUM (
  'pending',      -- Queued
  'running',      -- In progress
  'completed',    -- Success
  'failed'        -- Error
);

CREATE TYPE sentiment AS ENUM (
  'positive',
  'negative',
  'neutral',
  'mixed'
);

CREATE TYPE category AS ENUM (
  'complaint',
  'praise',
  'feature_request',
  'comparison',
  'pricing',
  'ux',
  'performance',
  'support',
  'onboarding',
  'integration',
  'security',
  'competitor_update',
  'other'
);

CREATE TYPE urgency AS ENUM (
  'low',
  'medium',
  'high'
);

CREATE TYPE report_status AS ENUM (
  'generating',
  'complete',
  'failed'
);

CREATE TYPE export_format AS ENUM (
  'pdf',
  'markdown',
  'json'
);

CREATE TYPE export_status AS ENUM (
  'generating',
  'ready',
  'failed'
);
```

---

## Data Relationships

```
workspace
├── projects
│   ├── source_configs
│   ├── mentions
│   │   └── classifications
│   ├── clusters
│   ├── reports
│   │   └── report_exports
│   └── jobs (discovery, ingestion, classification, report_gen)

users
└── workspaces
    └── workspace_members
        └── projects
```

---

## Migration Steps

### Phase 1: Add New Tables (No Data Loss)
```bash
# Create all new tables in new schema
# Keep old tables for backward compatibility
# Update API to use new table names

# Timeline: 1 day
```

### Phase 2: Migrate Data
```bash
# Copy data from old tables to new tables
# Run in background, don't block users
# Verify counts match

# Timeline: 1 hour
```

### Phase 3: Switch API
```bash
# Update all queries to use new tables
# Keep old table reads as fallback for 7 days
# Test thoroughly

# Timeline: 1 hour
```

### Phase 4: Cleanup
```bash
# After 30 days, delete old tables
# Archive old data if needed

# Timeline: later (after stability proven)
```

---

## Storage Estimation

| Table | Avg Size | Retention | Total |
|-------|----------|-----------|-------|
| mentions (1000/project) | 1KB | Lifetime | 1MB per project |
| classifications (1000) | 500B | Lifetime | 500KB per project |
| clusters (20) | 500B | Lifetime | 10KB per project |
| reports (1) | 50KB | Lifetime | 50KB per project |
| exports (3 per project) | 100B | 30 days | 300B per project |

**Per project total:** ~1.5MB  
**For 1000 projects:** ~1.5GB (very manageable)

---

## Indexing Strategy

**Always index:**
- Foreign keys (for joins)
- Status columns (for filtering jobs)
- Timestamps (for ordering, date ranges)
- Commonly filtered columns (source, category, sentiment)

**Don't index:**
- Text columns (JSONB, content) - use full-text search if needed
- Boolean flags (unless very selective)

**Current indexes:** All covered above (checked for optimal performance)

---

## JSON Fields Best Practices

**Use JSONB for:**
- source_metadata (varies by source type)
- report_data (full report, allows versioning)
- project metadata (extensible without schema changes)

**Don't use JSONB for:**
- Sentiment, category (use enums)
- Scores, counts (use numbers)
- Anything frequently queried (use columns)

---

## Archive Strategy

### Monthly Archive Job
```sql
-- Archive old projects (after 90 days of completion)
INSERT INTO archived_projects 
SELECT * FROM projects 
WHERE completed_at < NOW() - INTERVAL '90 days'
AND status = 'complete';

DELETE FROM mentions WHERE project_id IN (SELECT id FROM archived_projects);
DELETE FROM projects WHERE completed_at < NOW() - INTERVAL '90 days';
```

**Purpose:** Keep main database lean, improve query performance

---

## Conclusion

- 15 tables (vs current 9)
- Flexible, extensible schema
- Support for multiple sources
- Full job tracking
- Report generation + export
- Zero breaking changes to existing code
