# Database Patterns Reference

Copyright (c) 2025 APEX Business Systems Ltd. | https://apexbusiness-systems.com

## Database Selection

| Use Case | Database | Why |
|----------|----------|-----|
| General CRUD | PostgreSQL | ACID, JSON support, mature |
| High-write analytics | ClickHouse | Column-oriented, fast aggregates |
| Document store | MongoDB | Flexible schema, horizontal scale |
| Key-value cache | Redis | Sub-ms latency, data structures |
| Search | Elasticsearch | Full-text, analytics |
| Time series | TimescaleDB | PostgreSQL + time partitioning |
| Graph | Neo4j | Relationship queries |
| Queue | Redis/RabbitMQ | Pub/sub, task queues |

---

## PostgreSQL

### Schema Design

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    total_cents BIGINT NOT NULL CHECK (total_cents >= 0),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Always index foreign keys
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_metadata ON orders USING GIN(metadata);
```

### Query Optimization

```sql
-- ALWAYS use EXPLAIN ANALYZE
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM orders WHERE user_id = $1;

-- Pagination: Use cursor, not OFFSET
SELECT * FROM orders 
WHERE created_at < $1 ORDER BY created_at DESC LIMIT 20;
```

### Index Guidelines

| Query Pattern | Index Type |
|---------------|------------|
| Equality (=) | B-tree |
| Range (<, >) | B-tree |
| LIKE 'prefix%' | B-tree |
| JSONB containment | GIN |
| Full-text search | GIN tsvector |

---

## Redis

### Data Structures

```bash
# Strings (cache)
SET user:123:profile '{"name":"John"}' EX 3600

# Hash (object)
HSET user:123 name "John" email "john@example.com"

# Sorted Set (leaderboard)
ZADD leaderboard 1000 "user:123"
ZREVRANGE leaderboard 0 9 WITHSCORES
```

### Caching Pattern

```python
def get_user(user_id: str) -> dict:
    key = f"user:{user_id}"
    cached = redis.get(key)
    if cached:
        return json.loads(cached)
    user = db.query("SELECT * FROM users WHERE id = %s", user_id)
    redis.setex(key, 3600, json.dumps(user))
    return user
```

---

## Query Anti-Patterns

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| SELECT * | Over-fetching | List columns |
| N+1 queries | 100 items = 101 queries | JOIN/batch |
| OFFSET pagination | Scans skipped rows | Cursor |
| Missing FK index | Slow JOINs | Index FKs |
| LIKE '%term%' | Full scan | Full-text search |
