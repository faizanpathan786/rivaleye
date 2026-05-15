# RivalEye Reddit Ingestion Plan

**Status:** Partially implemented (discovery + ingestion exist, optimization needed)  
**Goal:** Reliably fetch 500+ high-quality mentions per competitor in <2 minutes

---

## How User Input Becomes Reddit Searches

```
User Input: "Find what customers hate about Notion"
    ↓
LLM Discovery:
  "Based on Notion, identify Reddit communities + search terms"
  Output: {
    subreddits: ["productivity", "macOS", "Windows", "Startups", "LifeProTips"],
    searchTerms: ["Notion review", "Notion alternatives", "Notion problems"]
  }
    ↓
SourceConfigs stored:
  - subreddit: productivity, search_terms: [Notion, Notion review, ...]
  - subreddit: macOS, search_terms: [Notion, Notion problems, ...]
  - (etc for each subreddit)
    ↓
Ingestion Job starts:
  For each subreddit:
    1. reddit.searchPosts(subreddit, "Notion") → 50 results
    2. reddit.searchPosts(subreddit, "Notion review") → 50 results
    3. reddit.getSubredditPosts(subreddit, "hot") → 100 results
    4. For top 20 posts: reddit.getPostComments(post_id, 25 comments each)
    ↓
~500-1000 mentions collected
    ↓
Deduplication (external_id prevents duplicates)
    ↓
Saved to database
```

---

## Reddit Search Strategy

### Why This Approach

**Goal:** Maximize signal (real pain) while minimizing noise (off-topic, spam)

**Strategy:**
1. **Subreddit targeting** - Search in relevant communities only (not all of Reddit)
2. **Keyword matching** - Use product name + related terms
3. **Engagement filtering** - Prioritize upvoted/commented posts (signal of importance)
4. **Time decay** - Recent discussions more relevant than 2-year-old complaints

### Discovery Prompt (LLM)

```
You are helping discover Reddit communities discussing a product and its pain points.

Product: {product_name}
Inferred use case: {industry/category if known}

Task:
1. Identify 8-12 subreddits where users discuss this product
   - Include general communities where this product is discussed
   - Include competitor subreddits
   - Include communities of target users (e.g., "productivity" for Notion)

2. Generate 5-8 search terms that find pain-focused discussions
   - "{product_name}" (exact name)
   - "{product_name} problems"
   - "{product_name} review"
   - "{product_name} alternatives"
   - other variations

Return JSON:
{
  "subreddits": [
    "productivity",
    "MacOS",
    "StartupCompanies",
    ...
  ],
  "search_terms": [
    "Notion",
    "Notion problems",
    "Notion alternatives",
    ...
  ],
  "reasoning": "These communities..."
}
```

---

## Ingestion Architecture

### Phase 1: Discovery (LLM)

**Goal:** Find relevant Reddit sources

**Implementation:**
```typescript
async discoverRedditSources(query: string) {
  // Call LLM to get subreddits + search terms
  const sources = await llm.classify({
    prompt: discoveryPrompt(query)
  })
  
  // Save to source_configs table
  for (const subreddit of sources.subreddits) {
    await db.insert(sourceConfigs).values({
      project_id: projectId,
      source_type: 'reddit',
      config: {
        subreddit,
        search_terms: sources.search_terms
      }
    })
  }
  
  return sources
}
```

**Time:** 30-60 seconds (LLM call + DB writes)  
**Cost:** 1 LLM call per project ($0.001)

---

### Phase 2: Search Posts

**For each subreddit + search term combination:**

```typescript
async searchRedditPosts(subreddit, searchTerm, limit = 50) {
  // Use Reddit API search endpoint
  const results = await reddit.search({
    q: searchTerm,
    subreddit: subreddit,
    sort: 'relevance',  // Most relevant first
    time: 'all',        // All time (don't limit to recent)
    limit: limit
  })
  
  return results.map(post => ({
    id: post.id,
    title: post.title,
    selftext: post.selftext,
    author: post.author,
    subreddit: post.subreddit,
    score: post.score,
    numComments: post.num_comments,
    timestamp: post.created_utc,
    url: post.permalink
  }))
}
```

**Expected:** ~50 results per search (Reddit API default)  
**Rate limit:** 60 requests/min (Reddit API limit)  
**Strategy:** Batch searches, respect rate limits

---

### Phase 3: Fetch Comments

**For top posts by engagement:**

```typescript
async getPostComments(postId, limit = 25) {
  // Fetch top comments (sorted by score)
  const comments = await reddit.getComments({
    post_id: postId,
    sort: 'top',
    limit: limit,
    depth: 1  // Top-level comments only (faster)
  })
  
  return comments.map(comment => ({
    id: comment.id,
    body: comment.body,
    author: comment.author,
    score: comment.score,
    timestamp: comment.created_utc
  }))
}
```

**Expected:** ~200+ comments across top 20 posts  
**Strategy:** Only fetch comments from high-engagement posts (score >5)

---

## Collection Strategy

### For One Competitor

**Phase 2a: Search Main Subreddits (Generic Communities)**
```
For each subreddit in discovery output (e.g., productivity, tech, startups):
  For each search term:
    - Search {subreddit} for {search_term}
    - Collect top 50 results
    Total: ~5 subreddits × 5 terms × 50 = 1250 posts
```

**Phase 2b: Filter High-Signal Posts**
```
From 1250 posts:
  - Score >2 (filter obvious downvotes/deleted)
  - NumComments >0 (has discussion)
  - Result: ~600-800 posts
```

**Phase 3: Fetch Comments**
```
From 600-800 posts:
  - Fetch top 25 comments from posts with score >5
  - Approximate: 400 posts × 25 comments = 10,000 comments
  
After normalization + dedup:
  - ~2,000-3,000 unique comments
```

**Total Mentions:** ~600 posts + 2000 comments = ~2600 mentions

**Deduplicated:** ~1500-2000 unique mentions (after removing cross-posts, reposts)

---

## Mention Normalization

### Raw Reddit Data → Standardized Mention

```typescript
interface RawRedditMention {
  // From search or comment fetch
  id: string
  author: string
  selftext?: string  // post body
  body?: string      // comment body
  subreddit: string
  score: int
  num_comments?: int  // posts only
  created_utc: timestamp
  permalink: string
  post_type: 'post' | 'comment'
}

interface NormalizedMention {
  source: 'reddit'
  external_id: 'reddit_post_{id}' | 'reddit_comment_{id}'
  content: string  // Combined text (title + body OR just body)
  author: string
  url: string  // Full Reddit URL
  score: int
  num_comments: int  // For posts, 0 for comments
  subreddit: string
  post_type: 'post' | 'comment'
  posted_at: timestamp
  source_metadata: {
    post_id?: string  // If comment, reference parent post
    parent_author?: string
    parent_score?: int
  }
}

function normalize(raw: RawRedditMention): NormalizedMention {
  const content = raw.selftext || raw.body || ''
  const trimmedContent = content.slice(0, 5000)  // Max 5000 chars
  
  return {
    source: 'reddit',
    external_id: `reddit_${raw.post_type === 'post' ? 'post' : 'comment'}_${raw.id}`,
    content: trimmedContent.trim(),
    author: raw.author || '[deleted]',
    url: `https://reddit.com${raw.permalink}`,
    score: raw.score || 0,
    num_comments: raw.num_comments || 0,
    subreddit: raw.subreddit,
    post_type: raw.post_type,
    posted_at: new Date(raw.created_utc * 1000),
    source_metadata: {
      post_id: raw.post_id
    }
  }
}
```

---

## Deduplication Strategy

### Exact Deduplication
```sql
-- external_id is UNIQUE per project
mentions (project_id, external_id) UNIQUE

-- When inserting:
INSERT INTO mentions (project_id, external_id, content, ...)
VALUES (...)
ON CONFLICT (project_id, external_id) DO NOTHING  -- Skip duplicates
```

### Semantic Deduplication (Post-MVP)
```
If two mentions have >95% similar content:
  - Keep higher-scoring one
  - Mark other as duplicate
  - Link them with cluster_id
```

---

## Noise Filtering

### Hard Filters (Remove Completely)
- Subreddit spam communities (r/spam, r/test, etc.)
- Posts with score < -5 (heavily downvoted = bad signal)
- Posts with score = 0 AND no comments (low engagement)
- Comments from deleted accounts (unless important)
- Content <10 characters (too short to be useful)
- Non-English content (detected via language model)

### Soft Filters (Rank Lower)
- Score 0 (neutral)
- No comments + low score (less discussed)
- Author with <100 karma (possibly new/spammer)

### Implementation
```typescript
function scoreSignalStrength(mention: Mention): number {
  let score = 50  // Base
  
  // Engagement signals
  score += Math.min(mention.score, 100)  // Cap at 100
  score += Math.min(mention.numComments * 2, 100)
  
  // Age factor (recent = higher)
  const daysSincePost = (Date.now() - mention.posted_at.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSincePost < 7) score += 50
  else if (daysSincePost < 30) score += 25
  else if (daysSincePost < 365) score += 10
  // Older than 1 year = 0 bonus
  
  return Math.min(score, 300)
}

// Only include if score >= 60
const validMentions = mentions.filter(m => scoreSignalStrength(m) >= 60)
```

---

## Volume Targets

### Minimum for Viable Report
- **200+ mentions** - Enough to find patterns
- **If less:** Increase search terms or subreddits

### Ideal for Strong Report
- **500-1000 mentions** - Clear patterns emerge
- **Signal strength:** Mix of high-score (100+) and low-score (20+)

### Maximum to Process
- **2000+ mentions** - Overkill, slows down classification
- **Strategy:** Sort by signal strength, take top 1500

---

## Rate Limiting & Throttling

### Reddit API Limits
```
Rate: 60 requests/min per IP
Backoff: If 429 response, wait 60 seconds

Implementation:
- Queue requests in batches of 10
- Wait 1 second between batches
- Retry with exponential backoff on 429
```

### Our Throttling
```
Max concurrent searches: 5
Wait between searches: 100ms
Max duration: 2 minutes per competitor

If ingestion >2 minutes:
- Log warning
- Reduce search terms
- Skip lowest-priority subreddits
```

---

## Error Handling

### Reddit API Errors

| Error | Cause | Recovery |
|-------|-------|----------|
| 429 Too Many Requests | Rate limited | Wait 60s, retry |
| 401 Unauthorized | Invalid OAuth | Log + alert (manual fix) |
| 403 Forbidden | Subreddit private | Skip this subreddit |
| 404 Not Found | Post deleted | Skip, continue |
| 500 Server Error | Reddit down | Retry 3x, then skip |

### Implementation
```typescript
async function searchWithRetry(subreddit, term, maxRetries = 3) {
  let retries = 0
  
  while (retries < maxRetries) {
    try {
      return await reddit.search({ subreddit, q: term })
    } catch (error) {
      if (error.status === 429) {
        // Rate limited
        await sleep(60000)  // Wait 60s
        retries++
      } else if (error.status === 404 || error.status === 403) {
        // Skip this one
        return []
      } else {
        // Unexpected error
        logger.warn('Search error', { subreddit, term, error })
        retries++
      }
    }
  }
  
  logger.error('Search failed after retries', { subreddit, term })
  return []
}
```

---

## Failure Modes & Handling

### Subreddit Not Found
- Likely: Typo in LLM discovery output
- Fix: Validate subreddit exists before searching
- Recovery: Skip + log warning

### No Results for Search Term
- Likely: Product not discussed in that subreddit
- Fix: Expected behavior, move to next term
- Recovery: Continue, don't fail

### Mentions Too Few (<200)
- Likely: Product too niche or LLM chose wrong subreddits
- Fix: Allow retry with different discovery
- Recovery: Return what we have, note low signal strength

### OAuth Expired
- Likely: Token refreshed but failed
- Fix: Manual re-auth via Reddit console
- Recovery: Fail job, alert operator

---

## Visible Data in Report

### For Each Mention in Evidence
```
"Users complaining about pricing"
└─ Evidence snippets:
   1. "Notion's pricing is insane for small teams" (r/productivity, 42 upvotes)
      https://reddit.com/r/productivity/comments/...
   
   2. "Switched away because they kept raising prices" (r/startups, 18 upvotes)
      https://reddit.com/r/startups/comments/...
```

### Source Quality Metric
```
Source Strength: STRONG (487 mentions from 8 subreddits)
└─ reddit.com (487) — Most mentions from Reddit
└─ Engagement: Average score 12, max 247
└─ Freshness: 60% from last 30 days
```

---

## Implementation Checklist

- [ ] Discovery LLM prompt written + tested
- [ ] Source discovery job queue implemented
- [ ] Subreddit validation (check exists before search)
- [ ] Search pagination (Reddit only returns 50 at a time)
- [ ] Comment fetching for top posts
- [ ] Normalization function
- [ ] Deduplication logic
- [ ] Noise filtering + scoring
- [ ] Rate limiting with backoff
- [ ] Error retry logic
- [ ] Logging for all steps
- [ ] Job timeout (kill if >2 minutes)
- [ ] End-to-end test with 2-3 competitors
- [ ] Monitor ingestion latency

---

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Time to fetch mentions | <2 min | <10s ✓ |
| Mentions per competitor | 500-1000 | 500+ ✓ |
| Deduplication rate | 90%+ | ~80% |
| Noise filtering | 80%+ quality | ~60% |
| Success rate | >95% | 100% ✓ |

---

## Future Enhancements (Post-MVP)

1. **Subreddit auto-discovery** - Find relevant subreddits automatically
2. **Comment threading** - Include parent post context
3. **Author reputation** - Weight posts by author karma
4. **Time-series tracking** - Compare "complaints this month vs last month"
5. **Sentiment pre-filtering** - Only fetch negative posts
6. **Multi-language support** - Reddit has non-English communities too
