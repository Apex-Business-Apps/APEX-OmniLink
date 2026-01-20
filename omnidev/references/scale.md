# High-Scale Architecture Reference

Copyright (c) 2025 APEX Business Systems Ltd. | https://apexbusiness-systems.com

## Scale Decision Matrix

| Users | Architecture | Database | Caching | Notes |
|-------|--------------|----------|---------|-------|
| <1K | Monolith | Single PostgreSQL | Optional | Keep it simple |
| 1K-10K | Monolith | PostgreSQL + read replica | Redis | Add monitoring |
| 10K-100K | Modular monolith | PostgreSQL cluster | Redis cluster | Consider CDN |
| 100K-1M | Microservices | Sharded DB | Redis + CDN | Full observability |
| >1M | Distributed | Multi-region, NoSQL | Edge caching | SRE team required |

---

## Horizontal Scaling

### Stateless Services

```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: app
  minReplicas: 3
  maxReplicas: 100
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Load Balancing

```nginx
# nginx.conf
upstream backend {
    least_conn;  # or ip_hash for sticky sessions
    server app1:8080 weight=5;
    server app2:8080 weight=5;
    server app3:8080 backup;
    
    keepalive 32;
}

server {
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
}
```

---

## Database Scaling

### Read Replicas

```python
# SQLAlchemy with read replica
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

write_engine = create_engine(PRIMARY_URL)
read_engine = create_engine(REPLICA_URL)

def get_session(readonly=False):
    engine = read_engine if readonly else write_engine
    return Session(engine)

# Usage
with get_session(readonly=True) as session:
    users = session.query(User).all()
```

### Sharding Strategies

| Strategy | When | Example |
|----------|------|---------|
| Range | Ordered data | user_id 1-1M shard 1, 1M-2M shard 2 |
| Hash | Even distribution | shard = hash(user_id) % num_shards |
| Geographic | Multi-region | US users → US shard, EU → EU shard |
| Tenant | Multi-tenant | Each customer gets own shard |

### Connection Pooling

```yaml
# PgBouncer config
[databases]
mydb = host=postgres port=5432 dbname=mydb

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
```

---

## Caching Strategies

### Multi-Level Cache

```
Request → Edge Cache (CDN) → Application Cache (Redis) → Database
         [<10ms]            [<5ms]                      [10-100ms]
```

### Cache Invalidation

```python
# Event-driven invalidation
async def update_user(user_id: str, data: dict):
    # Update DB
    await db.execute("UPDATE users SET ... WHERE id = $1", user_id)
    
    # Invalidate cache
    await redis.delete(f"user:{user_id}")
    
    # Publish event for distributed invalidation
    await redis.publish("cache:invalidate", json.dumps({
        "type": "user",
        "id": user_id
    }))
```

### Cache Warming

```python
async def warm_cache():
    """Pre-populate cache on deployment"""
    hot_users = await db.fetch("SELECT id FROM users ORDER BY last_active DESC LIMIT 1000")
    
    async with redis.pipeline() as pipe:
        for user in hot_users:
            data = await fetch_user_data(user['id'])
            pipe.setex(f"user:{user['id']}", 3600, json.dumps(data))
        await pipe.execute()
```

---

## Message Queues

### Event-Driven Architecture

```python
# Producer
async def create_order(order: Order):
    await db.insert(order)
    
    await publish_event("orders", {
        "type": "order.created",
        "order_id": order.id,
        "user_id": order.user_id,
        "total": order.total
    })

# Consumer (separate service)
@consumer("orders")
async def handle_order_created(event: dict):
    if event["type"] == "order.created":
        await send_confirmation_email(event["user_id"], event["order_id"])
        await update_inventory(event["order_id"])
        await notify_warehouse(event["order_id"])
```

### Queue Patterns

| Pattern | Use Case | Implementation |
|---------|----------|----------------|
| Work Queue | Background jobs | Redis/SQS + workers |
| Pub/Sub | Event broadcasting | Redis Pub/Sub, Kafka |
| Request/Reply | Sync over async | Correlation IDs |
| Dead Letter | Failed messages | DLQ with retry logic |

---

## Rate Limiting

### Token Bucket

```python
import time
import redis

class RateLimiter:
    def __init__(self, redis_client, rate: int, per: int):
        self.redis = redis_client
        self.rate = rate  # requests
        self.per = per    # seconds
    
    async def is_allowed(self, key: str) -> bool:
        now = time.time()
        pipe = self.redis.pipeline()
        
        # Remove old tokens
        pipe.zremrangebyscore(key, 0, now - self.per)
        # Count remaining
        pipe.zcard(key)
        # Add new request
        pipe.zadd(key, {str(now): now})
        # Set expiry
        pipe.expire(key, self.per)
        
        results = await pipe.execute()
        return results[1] < self.rate

# Usage: 100 requests per minute
limiter = RateLimiter(redis, rate=100, per=60)
if not await limiter.is_allowed(f"user:{user_id}"):
    raise RateLimitExceeded()
```

---

## Observability

### The Three Pillars

| Pillar | Tool | Purpose |
|--------|------|---------|
| Metrics | Prometheus/Datadog | Aggregated measurements |
| Logs | ELK/Loki | Event details |
| Traces | Jaeger/Datadog | Request flow |

### Key Metrics

```python
from prometheus_client import Counter, Histogram

REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint'],
    buckets=[.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10]
)

@app.middleware("http")
async def metrics_middleware(request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    REQUEST_LATENCY.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)
    
    return response
```

---

## Disaster Recovery

### RTO/RPO Targets

| Tier | RTO | RPO | Strategy |
|------|-----|-----|----------|
| Critical | <1hr | <5min | Active-active, sync replication |
| High | <4hr | <1hr | Warm standby, async replication |
| Medium | <24hr | <24hr | Cold standby, daily backups |
| Low | <72hr | <1wk | Backups only |

### Multi-Region Setup

```
         ┌─────────────┐
         │   Route 53  │
         │  (Failover) │
         └──────┬──────┘
                │
       ┌────────┴────────┐
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│  US-EAST-1   │  │  EU-WEST-1   │
│  (Primary)   │  │  (Standby)   │
├──────────────┤  ├──────────────┤
│ App Servers  │  │ App Servers  │
│ PostgreSQL   │──│ PostgreSQL   │
│ (Primary)    │  │ (Replica)    │
│ Redis        │  │ Redis        │
└──────────────┘  └──────────────┘
```

---

## Capacity Planning

### Estimation Formula

```
Required Capacity = Peak Load × Growth Factor × Safety Margin

Example:
- Current peak: 1000 RPS
- Expected growth: 2x in 12 months
- Safety margin: 1.5x

Required = 1000 × 2 × 1.5 = 3000 RPS capacity
```

### Load Testing

```bash
# k6 load test
k6 run --vus 100 --duration 5m load-test.js
```

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up
    { duration: '3m', target: 100 },  // Stay at peak
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% under 200ms
    http_req_failed: ['rate<0.01'],   // <1% errors
  },
};

export default function() {
  let res = http.get('https://api.example.com/items');
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
```
