# Language Patterns Reference

Copyright (c) 2025 APEX Business Systems Ltd. | https://apexbusiness-systems.com

## TypeScript / JavaScript

### Type Safety

```typescript
// Discriminated unions
type Result<T> = { success: true; data: T } | { success: false; error: Error };

// Const assertions
const ROUTES = { HOME: '/', USERS: '/users' } as const;
type Route = typeof ROUTES[keyof typeof ROUTES];

// Zod validation
import { z } from 'zod';
const UserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});
```

### Async Patterns

```typescript
// Safe error handling
async function safe<T>(promise: Promise<T>): Promise<[T, null] | [null, Error]> {
  try { return [await promise, null]; }
  catch (e) { return [null, e instanceof Error ? e : new Error(String(e))]; }
}

// Rate-limited parallel
async function rateLimited<T>(tasks: (() => Promise<T>)[], limit: number) {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += limit) {
    results.push(...await Promise.all(tasks.slice(i, i + limit).map(t => t())));
  }
  return results;
}
```

---

## Python

### Type Hints

```python
from typing import TypeVar, Generic, Optional
from dataclasses import dataclass

T = TypeVar('T')

@dataclass
class Result(Generic[T]):
    success: bool
    data: Optional[T] = None
    error: Optional[str] = None
```

### Async

```python
import asyncio

async def rate_limited(tasks, limit=10):
    semaphore = asyncio.Semaphore(limit)
    async def bounded(task):
        async with semaphore:
            return await task
    return await asyncio.gather(*[bounded(t) for t in tasks])
```

---

## Go

### Error Handling

```go
type AppError struct {
    Code    string
    Message string
    Err     error
}

func (e *AppError) Error() string {
    return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Wrapping
if err != nil {
    return fmt.Errorf("processUser(%s): %w", id, err)
}
```

### Concurrency

```go
func workerPool(jobs <-chan Job, results chan<- Result, workers int) {
    var wg sync.WaitGroup
    for i := 0; i < workers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for job := range jobs {
                results <- process(job)
            }
        }()
    }
    wg.Wait()
    close(results)
}
```

---

## Rust

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Database error")]
    Database(#[from] sqlx::Error),
}

pub type Result<T> = std::result::Result<T, AppError>;
```

---

## SQL

```sql
-- Pagination (cursor-based)
SELECT * FROM orders WHERE created_at < $1 ORDER BY created_at DESC LIMIT 20;

-- Upsert
INSERT INTO users (email, name) VALUES ($1, $2)
ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name;

-- Window functions
SELECT id, SUM(amount) OVER (ORDER BY created_at) as running_total FROM orders;
```
