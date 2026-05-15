# RivalEye AI Analysis Pipeline

**Status:** Classification broken (Llama context limit), clustering untested  
**Fix:** Switch to Claude API (Anthropic), implement proper batching and error handling

---

## Problem Analysis

### Current State
- **Discovery LLM:** Working (generates subreddit + search terms)
- **Classification LLM:** Broken (Llama 3.1 8B context too small)
- **Clustering:** Code exists but untested

### Root Cause: LLM Limitations

| Issue | Cause | Solution |
|-------|-------|----------|
| Context window exceeded | Llama 3.1 8B (8K) < batch size | Use Claude API (200K tokens) |
| Non-JSON output | LLM not following format rules | Stricter prompts + output validation |
| Batch size limited | Even 2 mentions exceed context | Claude handles 100+ mentions |
| Rate limiting | Groq free tier exhausted | Use Anthropic SDK (already in use) |

### Why Claude API

**Llama 3.1 8B:**
- 8K context window
- Can't handle batch of 10 mentions + prompt + JSON output
- Free but insufficient

**Claude 3.5 Sonnet:**
- 200K context window
- Excellent instruction-following
- Better for complex classification
- Cost: ~$0.50-1 per 1000 mentions (affordable)

**Claude 3 Haiku:**
- 200K context window  
- Cheaper than Sonnet ($0.25-0.5 per 1000)
- Good enough for classification
- Better for cost-sensitive batching

---

## AI Pipeline Architecture

```
Raw Mentions (500+)
    ↓
Step 1: Clean & Normalize
    → Remove duplicates
    → Trim long text (>2000 chars)
    → Remove non-English (language detection)
    Result: 450 clean mentions
    ↓
Step 2: Classification (Claude)
    → Batch into groups of 50
    → Classify: sentiment, category, relevance
    → Filter by relevance_score >= 40
    Result: 350 relevant mentions
    ↓
Step 3: Clustering (LLM + Algorithm)
    → Semantic grouping
    → Generate cluster summaries
    → Rank by strength
    Result: 8-12 clusters
    ↓
Step 4: Report Generation
    → Select top insights
    → Generate evidence excerpts
    → Create recommendations
    Result: Founder-friendly report
```

---

## Step 1: Cleaning & Normalization

**Goal:** Remove noise before expensive LLM calls

```typescript
async function cleanMentions(mentions: Mention[]): Promise<Mention[]> {
  const cleaned = []
  const seen = new Set<string>()
  
  for (const mention of mentions) {
    // Skip if already seen (dedup)
    if (seen.has(mention.external_id)) continue
    
    // Skip very short content
    if (mention.content.trim().length < 10) continue
    
    // Skip non-English (simple heuristic)
    if (!isEnglish(mention.content)) continue
    
    // Trim very long content
    const trimmed = mention.content.slice(0, 2000).trim()
    
    // Skip if became empty after trimming
    if (!trimmed) continue
    
    cleaned.push({
      ...mention,
      content: trimmed
    })
    seen.add(mention.external_id)
  }
  
  logger.info('Cleaned mentions', {
    original: mentions.length,
    cleaned: cleaned.length,
    removed_rate: (1 - cleaned.length / mentions.length).toFixed(2)
  })
  
  return cleaned
}

function isEnglish(text: string): boolean {
  // Simple heuristic: >80% ASCII + common Latin chars
  const asciiMatch = text.match(/[a-z0-9\s.,!?\-]/gi) || []
  return asciiMatch.length / text.length > 0.8
}
```

---

## Step 2: Classification (Claude API)

### Batching Strategy

**Problem:** Can't classify 1 mention at a time (too expensive, slow)

**Solution:** Batch 50 mentions per API call

```typescript
async function classifyMentions(mentions: Mention[]): Promise<Classification[]> {
  const batchSize = 50
  const batches = chunk(mentions, batchSize)
  const allClassifications: Classification[] = []
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    logger.info(`Classifying batch ${i + 1}/${batches.length}`, { count: batch.length })
    
    try {
      const classifications = await classifyBatch(batch)
      allClassifications.push(...classifications)
      
      // Rate limiting (1 API call per second)
      if (i < batches.length - 1) {
        await sleep(1000)
      }
    } catch (error) {
      logger.error(`Batch ${i + 1} failed`, { error })
      // Continue with next batch (don't fail entire job)
    }
  }
  
  return allClassifications
}

async function classifyBatch(mentions: Mention[]): Promise<Classification[]> {
  // Prepare prompt
  const prompt = buildClassificationPrompt(mentions)
  
  // Call Claude API
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',  // Or claude-3-haiku if budget-conscious
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: prompt
    }]
  })
  
  // Parse response
  const jsonStr = extractJSON(response.content[0].text)
  const parsed = JSON.parse(jsonStr)
  
  // Validate + map
  const classifications = parsed.map((item, idx) => {
    if (!item.mention_id) {
      // Fallback: use array position
      item.mention_id = mentions[idx].id
    }
    
    return {
      mention_id: item.mention_id,
      sentiment: validateEnum(item.sentiment, ['positive', 'negative', 'neutral', 'mixed']),
      category: validateEnum(item.category, CATEGORIES),
      relevance_score: Math.min(Math.max(item.relevance_score || 50, 0), 100),
      confidence: Math.min(Math.max(item.confidence || 0.5, 0), 1),
      summary: item.summary || ''
    }
  })
  
  return classifications
}
```

### Classification Prompt

```
You are analyzing customer feedback about a product to find pain points and opportunities.

Your task: Classify each piece of feedback into sentiment, category, and relevance.

For each mention, return:
- sentiment: positive / negative / neutral / mixed
- category: One of [complaint, praise, feature_request, comparison, pricing, ux, performance, support, onboarding, integration, security, competitor_update, other]
- relevance_score: 0-100 (how relevant to understanding product pain/opportunities)
- confidence: 0-1 (how confident in classification)
- summary: 1-line summary

IMPORTANT:
1. Return ONLY a JSON array, no other text
2. Each item must have all 5 fields
3. Maintain array order exactly (index 0 = first mention)
4. Use the mention_id provided

Mentions to classify:
[
  {
    "mention_id": "uuid1",
    "source": "reddit",
    "subreddit": "productivity",
    "score": 42,
    "content": "Notion's pricing is absurd for freelancers. I switched to Obsidian because it's free."
  },
  {
    "mention_id": "uuid2",
    "source": "reddit",
    "subreddit": "startups",
    "score": 12,
    "content": "Notion is great! Amazing for organizing my projects and collaborating with my team."
  },
  ...more items...
]

Return JSON array:
[
  {"mention_id": "uuid1", "sentiment": "negative", "category": "pricing", "relevance_score": 95, "confidence": 0.98, "summary": "Pricing too high for freelancers"},
  {"mention_id": "uuid2", "sentiment": "positive", "category": "praise", "relevance_score": 60, "confidence": 0.95, "summary": "Good for teams"},
  ...
]
```

### Token Management

```typescript
// Before sending to Claude, estimate tokens
function estimateTokens(mentions: Mention[]): number {
  const contentChars = mentions.reduce((sum, m) => sum + m.content.length, 0)
  
  // Rough estimate: 1 token ≈ 4 chars
  let estimated = contentChars / 4
  
  // Add prompt overhead
  estimated += 200  // For prompt structure
  
  // Add response overhead
  estimated += mentions.length * 20  // ~20 tokens per classification
  
  return Math.ceil(estimated)
}

// Before batching
const mentions = cleanedMentions
const estimatedTokens = mentions.reduce((sum, batch) => {
  return sum + estimateTokens(batch)
}, 0)

logger.info('Classification tokens', {
  mentions: mentions.length,
  estimatedInputTokens: estimatedTokens,
  estimatedCost: (estimatedTokens / 1000 * 0.003).toFixed(2)  // $0.003 per 1k input tokens
})
```

### Error Handling

```typescript
async function classifyWithFallback(mentions: Mention[]): Promise<Classification[]> {
  try {
    return await classifyBatch(mentions)
  } catch (error) {
    if (error instanceof TokenLimitExceeded) {
      // Batch too large, split in half
      logger.warn('Token limit exceeded, reducing batch size', { size: mentions.length })
      const mid = Math.ceil(mentions.length / 2)
      const [batch1, batch2] = [mentions.slice(0, mid), mentions.slice(mid)]
      const c1 = await classifyWithFallback(batch1)
      const c2 = await classifyWithFallback(batch2)
      return [...c1, ...c2]
    } else if (error instanceof JSONParseError) {
      // LLM returned bad JSON, return defaults
      logger.warn('Failed to parse LLM response, using defaults', { error })
      return mentions.map(m => ({
        mention_id: m.id,
        sentiment: 'neutral',
        category: 'other',
        relevance_score: 50,
        confidence: 0.3,
        summary: m.content.slice(0, 100)
      }))
    } else {
      throw error
    }
  }
}
```

---

## Step 3: Clustering

### Algorithm: Semantic Grouping

```typescript
async function clusterMentions(
  mentions: Mention[],
  classifications: Classification[]
): Promise<Cluster[]> {
  // Prepare mentions with embeddings
  const embedded = await embedMentions(mentions)
  
  // Group by initial heuristics
  const groups = new Map<string, Mention[]>()
  
  for (const mention of mentions) {
    const classification = classifications.find(c => c.mention_id === mention.id)
    if (!classification) continue
    
    // Group by category first
    const key = classification.category
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(mention)
  }
  
  // Within each category, sub-group by semantic similarity
  const clusters: Cluster[] = []
  
  for (const [category, mentionGroup] of groups) {
    if (mentionGroup.length < 3) continue  // Skip tiny groups
    
    // Cluster by semantic similarity
    const subClusters = semanticCluster(mentionGroup, embedded, 0.7)  // 70% similarity threshold
    
    for (const subCluster of subClusters) {
      const cluster = await generateClusterSummary(subCluster, category)
      clusters.push(cluster)
    }
  }
  
  // Rank clusters by strength
  const ranked = clusters
    .map(c => ({
      ...c,
      strength: calculateStrength(c)
    }))
    .sort((a, b) => b.strength - a.strength)
  
  return ranked.slice(0, 12)  // Top 12 clusters
}

function semanticCluster(
  mentions: Mention[],
  embeddings: Map<string, number[]>,
  similarityThreshold: number
): Mention[][] {
  // Simple clustering: if similar to any in cluster, add it
  const clusters: Mention[][] = []
  const processed = new Set<string>()
  
  for (const mention of mentions) {
    if (processed.has(mention.id)) continue
    
    const cluster = [mention]
    processed.add(mention.id)
    
    // Find similar mentions
    for (const other of mentions) {
      if (processed.has(other.id)) continue
      
      const similarity = cosineSimilarity(
        embeddings.get(mention.id)!,
        embeddings.get(other.id)!
      )
      
      if (similarity >= similarityThreshold) {
        cluster.push(other)
        processed.add(other.id)
      }
    }
    
    if (cluster.length >= 2) {  // Only keep clusters with 2+
      clusters.push(cluster)
    }
  }
  
  return clusters
}

async function generateClusterSummary(
  mentions: Mention[],
  category: string
): Promise<Cluster> {
  // Use LLM to summarize cluster
  const topMentions = mentions
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  
  const prompt = `
    Summarize this cluster of user feedback into one clear label.
    
    Category: ${category}
    Sample quotes:
    ${topMentions.map(m => `- "${m.content.slice(0, 100)}..."`).join('\n')}
    
    Return JSON:
    {
      "label": "Clear 1-sentence label",
      "summary": "2-sentence summary"
    }
  `
  
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  })
  
  const result = JSON.parse(extractJSON(response.content[0].text))
  
  return {
    id: crypto.randomUUID(),
    project_id: mentions[0].project_id,
    label: result.label,
    category: category,
    sentiment: calculateAverageSentiment(mentions),
    mention_count: mentions.length,
    strength: 'strong',  // Calculate based on mention count
    evidence_mention_ids: mentions.slice(0, 5).map(m => m.id),
    summary: result.summary
  }
}

function calculateStrength(cluster: Cluster): number {
  let score = cluster.mention_count * 10  // 10 points per mention
  
  if (cluster.sentiment === 'negative') score *= 1.5  // Negative is more important
  if (cluster.mention_count > 50) score = 100  // Cap at 100
  
  return score
}
```

---

## Step 4: Report Generation

### Data-Driven Report Building

```typescript
async function generateReport(
  project: Project,
  mentions: Mention[],
  classifications: Classification[],
  clusters: Cluster[]
): Promise<Report> {
  // Filter to relevant mentions only
  const relevantMentions = mentions.filter(m => {
    const c = classifications.find(cl => cl.mention_id === m.id)
    return c && c.relevance_score >= 40
  })
  
  // Executive summary
  const summary = generateSummary(project.search_query, clusters, relevantMentions)
  
  // Pain themes
  const painThemes = clusters
    .filter(c => c.sentiment === 'negative')
    .slice(0, 5)
    .map(c => ({
      label: c.label,
      mention_count: c.mention_count,
      strength: c.strength,
      evidence: getEvidenceForCluster(c, mentions),
      recommendations: generateRecommendations(c)
    }))
  
  // Feature requests
  const featureRequests = clusters
    .filter(c => c.category === 'feature_request')
    .slice(0, 3)
    .map(c => ({
      request: c.label,
      mentions: c.mention_count,
      evidence: getEvidenceForCluster(c, mentions)
    }))
  
  // Opportunities
  const opportunities = generateOpportunities(clusters, painThemes)
  
  // Compile report
  const report = {
    summary,
    competitors_analyzed: [project.search_query],
    signal_strength: calculateSignalStrength(relevantMentions),
    pain_themes: painThemes,
    feature_requests: featureRequests,
    opportunities,
    validation_recommendations: generateValidationSteps(painThemes),
    final_verdict: generateVerdict(relevantMentions, painThemes)
  }
  
  return report
}

function getEvidenceForCluster(cluster: Cluster, mentions: Mention[]): string[] {
  return cluster.evidence_mention_ids
    .slice(0, 3)
    .map(id => {
      const mention = mentions.find(m => m.id === id)
      if (!mention) return ''
      
      // Shorten to 150 chars, add ellipsis
      let excerpt = mention.content.slice(0, 150)
      if (mention.content.length > 150) excerpt += '...'
      
      return excerpt
    })
    .filter(Boolean)
}

function calculateSignalStrength(mentions: Mention[]): string {
  const avgScore = mentions.reduce((sum, m) => sum + m.score, 0) / mentions.length
  
  if (avgScore > 50) return 'strong'
  if (avgScore > 20) return 'medium'
  return 'weak'
}
```

---

## Prompt Engineering Best Practices

### Rules
1. **Be specific** - Not "classify this", but "classify sentiment, category, relevance"
2. **Show examples** - Few-shot prompts work better than zero-shot
3. **Ask for JSON** - "Return JSON only, no other text"
4. **Validate output** - Check JSON is valid, fields present
5. **Handle failures** - Batch too large → reduce and retry

### Iteration Loop
```
1. Write prompt
2. Test with 10 samples
3. Check accuracy
4. Refine prompt
5. Test with 100 samples
6. Deploy with monitoring
```

---

## Cost Control

### Estimation
- **Input:** 500 mentions × 200 chars = 100k chars ≈ 25k tokens
- **Output:** 500 classifications × 30 chars = 15k chars ≈ 3.75k tokens
- **Total:** ~30k tokens per report

### Pricing (Claude 3.5 Sonnet)
- Input: $0.003 / 1k tokens
- Output: $0.015 / 1k tokens
- Per report: (25k × 0.003) + (3.75k × 0.015) = **$132.5** (oops, recalculate)

Actually:
- (25k tokens × $0.003/1k) = $0.075
- (3.75k tokens × $0.015/1k) = $0.056
- **Total: ~$0.13 per report**

### Budget
- Monthly: $50 limit
- Reports: ~400 reports/month maximum

---

## Production Checklist

- [ ] Claude API authentication working
- [ ] Batch processing tested with 50+ mentions
- [ ] Error handling for token limits
- [ ] JSON parsing with fallbacks
- [ ] Logging for all API calls
- [ ] Token usage tracking
- [ ] Cost alerts (>$10/day)
- [ ] Rate limiting respected
- [ ] Timeouts set (max 60s per batch)
- [ ] Clustering algorithm tested
- [ ] Report generation tested
- [ ] End-to-end test with real data
