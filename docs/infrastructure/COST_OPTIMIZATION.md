# Cost Optimization Strategy

**Issue Identified:** Guardian pattern makes 3x LLM calls per request (Input Check + Planner + Output Check)

**Current Cost:** ~$0.30 per agent request (assuming GPT-4)
**Optimized Cost:** ~$0.08 per agent request (73% reduction)

---

## Guardian Model Downgrade

### Recommended Configuration

**Guardian (Security Layer):** Use fast, cheap model
- **Model:** `gpt-4o-mini` or `claude-3-haiku`
- **Cost:** $0.15/1M input tokens, $0.60/1M output tokens
- **Latency:** ~500ms
- **Use Case:** Input/output validation, prompt injection detection

**Planner (Cognitive Layer):** Use smart, expensive model
- **Model:** `gpt-4o` or `claude-3-5-sonnet`
- **Cost:** $2.50/1M input tokens, $10/1M output tokens
- **Latency:** ~2s
- **Use Case:** Complex reasoning, plan generation

**Executor (Action Layer):** No LLM needed
- **Cost:** $0 (DAG traversal)
- **Latency:** <100ms

### Implementation

**File:** `supabase/functions/omnilink-agent/index.ts`

```typescript
// Current (EXPENSIVE):
const guardianCheck = await llm.chat({
  model: 'gpt-4o',  // $2.50 per million tokens
  prompt: `Check if this is safe: ${userInput}`,
});

// Optimized (CHEAP):
const guardianCheck = await llm.chat({
  model: 'gpt-4o-mini',  // $0.15 per million tokens (16x cheaper!)
  prompt: `Check if this is safe: ${userInput}`,
  max_tokens: 50,  // Guardian only needs yes/no response
  temperature: 0,   // Deterministic for security checks
});

const plan = await llm.chat({
  model: 'gpt-4o',  // Keep smart model for planning
  prompt: `Generate a plan for: ${safeInput}`,
});
```

### Environment Variable Config

```bash
# .env
GUARDIAN_MODEL=gpt-4o-mini      # Fast, cheap security checks
PLANNER_MODEL=gpt-4o             # Smart, expensive reasoning
FALLBACK_MODEL=gpt-4o-mini       # If primary fails

# Cost limits
MAX_MONTHLY_LLM_SPEND=500        # Alert if exceeded
COST_PER_REQUEST_LIMIT=0.10      # Block if single request exceeds
```

---

## Semantic Cache Optimization

**Current:** 67% cache hit rate (production average)
**Target:** 80% cache hit rate

### Strategies

#### 1. Expand Entity Recognition

```python
# orchestrator/infrastructure/cache.py
PATTERNS = {
    'DATE': [...],
    'LOCATION': [...],
    'AMOUNT': [...],
    'EMAIL': [...],
    # ADD MORE:
    'PHONE': [r'\+?1?\d{10}', r'\(\d{3}\)\s*\d{3}-\d{4}'],
    'URL': [r'https?://[^\s]+'],
    'TIME': [r'\d{1,2}:\d{2}\s*(AM|PM)?'],
    'DURATION': [r'\d+\s*(hours?|days?|weeks?|months?)'],
}
```

#### 2. Fuzzy Matching

Instead of exact similarity threshold (0.85), use adaptive threshold:

```python
# High confidence cache hits
if similarity > 0.90:
    return cached_plan  # Use directly

# Medium confidence - verify with cheap LLM
elif similarity > 0.75:
    verification = await verify_plan_relevance(cached_plan, current_query)
    if verification.is_relevant:
        return cached_plan

# Low confidence - generate new plan
else:
    return generate_new_plan()
```

#### 3. Cache Warming

Pre-populate cache with common queries:

```python
common_queries = [
    "Book a flight to {LOCATION}",
    "Schedule a meeting at {TIME}",
    "Send {AMOUNT} to {EMAIL}",
    "What's the weather in {LOCATION}?",
]

for template in common_queries:
    # Generate and cache plans
    await semantic_cache.warm(template)
```

---

## Rate Limiting & Quotas

### Per-User Limits

```typescript
// Prevent abuse
const RATE_LIMITS = {
  free_tier: {
    requests_per_hour: 10,
    max_plan_complexity: 5,  // Max steps in plan
  },
  pro_tier: {
    requests_per_hour: 100,
    max_plan_complexity: 20,
  },
  enterprise: {
    requests_per_hour: 1000,
    max_plan_complexity: 50,
  },
};
```

### Cost-Based Circuit Breaker

```typescript
// Stop processing if costs spike
let hourly_cost = 0;

async function checkCostLimit() {
  if (hourly_cost > MAX_HOURLY_COST) {
    throw new Error('Cost limit exceeded - pausing new requests');
  }
}

// Track after each LLM call
hourly_cost += estimateRequestCost(tokens_used, model);
```

---

## Monitoring & Alerts

### Cost Metrics Dashboard

```typescript
// Track in Datadog/Grafana
const metrics = {
  'llm.cost.total': hourly_cost,
  'llm.cost.guardian': guardian_cost,
  'llm.cost.planner': planner_cost,
  'llm.requests.total': request_count,
  'cache.hit_rate': hit_rate,
};
```

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Hourly LLM Cost | > $10 | > $50 |
| Daily LLM Cost | > $100 | > $500 |
| Cache Hit Rate | < 60% | < 50% |
| Avg Request Cost | > $0.15 | > $0.30 |

---

## Expected Savings

### Before Optimization

- **Guardian Input Check:** $0.05 (gpt-4o)
- **Planner:** $0.20 (gpt-4o)
- **Guardian Output Check:** $0.05 (gpt-4o)
- **Total per request:** $0.30

### After Optimization

- **Guardian Input Check:** $0.003 (gpt-4o-mini)
- **Planner:** $0.20 (gpt-4o)
- **Guardian Output Check:** $0.003 (gpt-4o-mini)
- **Cache Hit (67%):** $0.00
- **Effective cost:** ~$0.08 per request

### Monthly Savings (1000 requests/day)

- **Before:** 30,000 requests × $0.30 = **$9,000/month**
- **After:** 30,000 requests × $0.08 = **$2,400/month**
- **Savings:** **$6,600/month (73%)**

---

## Action Items

- [ ] Update omnilink-agent to use gpt-4o-mini for Guardian
- [ ] Add cost tracking middleware
- [ ] Implement per-user rate limits
- [ ] Set up cost alert thresholds
- [ ] Expand entity recognition patterns
- [ ] Enable adaptive cache threshold
- [ ] Pre-warm cache with common queries
- [ ] Monitor savings weekly

---

**Last Updated:** 2026-01-04
**Owner:** APEX Cost Optimization Team
