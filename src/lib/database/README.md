# DATABASE ABSTRACTION LAYER

**Purpose:** Provider-agnostic database interface for OmniHub
**Status:** ✅ Implemented (Week 2, Phase 1)
**Current Provider:** Supabase
**Future Providers:** PostgreSQL (Cloud SQL/RDS/Azure), PlanetScale

---

## OVERVIEW

This abstraction layer reduces vendor lock-in risk by providing a generic database interface that works across multiple providers.

**Benefits:**
- ✅ **Portability:** Switch database providers with minimal code changes
- ✅ **Type Safety:** Full TypeScript support with generic types
- ✅ **Testability:** Easy to mock for unit tests
- ✅ **Consistency:** Uniform API across all database operations
- ✅ **Future-Proof:** Add new providers without changing application code

**Current Lock-in Risk:** HIGH → MEDIUM (after abstraction layer)

---

## QUICK START

### Basic Usage

```typescript
import { db } from '@/lib/database'

// Find all active users
const { data: users, error } = await db.find('users', {
  filters: [{ column: 'active', operator: '=', value: true }],
  orderBy: { column: 'created_at', ascending: false },
  limit: 10
})

if (error) {
  console.error('Error fetching users:', error)
  return
}

console.log('Active users:', users)
```

---

## API REFERENCE

### Query Operations

#### `findById(table, id, options?)`
Find a single record by ID.

```typescript
const { data: user, error } = await db.findById('users', userId)

// With specific columns
const { data: user, error } = await db.findById('users', userId, {
  select: ['id', 'email', 'name']
})
```

#### `find(table, options?)`
Find multiple records matching filters.

```typescript
const { data: users, error, count } = await db.find('users', {
  filters: [
    { column: 'active', operator: '=', value: true },
    { column: 'role', operator: 'in', value: ['admin', 'moderator'] }
  ],
  orderBy: { column: 'created_at', ascending: false },
  limit: 20,
  offset: 0
})
```

#### `findOne(table, options?)`
Find a single record matching filters.

```typescript
const { data: user, error } = await db.findOne('users', {
  filters: [{ column: 'email', operator: '=', value: 'user@example.com' }]
})
```

#### `count(table, options?)`
Count records matching filters.

```typescript
const { data: count, error } = await db.count('users', {
  filters: [{ column: 'active', operator: '=', value: true }]
})
```

---

### Mutation Operations

#### `insert(table, data)`
Insert a single record.

```typescript
const { data: newUser, error } = await db.insert('users', {
  email: 'user@example.com',
  name: 'John Doe',
  active: true
})
```

#### `insertMany(table, dataArray)`
Insert multiple records.

```typescript
const { data: newUsers, error } = await db.insertMany('users', [
  { email: 'user1@example.com', name: 'User 1' },
  { email: 'user2@example.com', name: 'User 2' }
])
```

#### `update(table, data, options?)`
Update records matching filters.

```typescript
const { data: updatedUsers, error } = await db.update(
  'users',
  { active: false },
  {
    filters: [{ column: 'last_login', operator: '<', value: '2025-01-01' }]
  }
)
```

#### `updateById(table, id, data)`
Update a single record by ID.

```typescript
const { data: updatedUser, error } = await db.updateById('users', userId, {
  name: 'Jane Doe',
  updated_at: new Date().toISOString()
})
```

#### `delete(table, options)`
Delete records matching filters.

```typescript
// SAFETY: Filters are required to prevent accidental deletion of all rows
const { data: success, error } = await db.delete('users', {
  filters: [{ column: 'active', operator: '=', value: false }]
})
```

#### `deleteById(table, id)`
Delete a single record by ID.

```typescript
const { data: success, error } = await db.deleteById('users', userId)
```

---

### Storage Operations

#### `uploadFile(bucket, path, file, options?)`
Upload a file to storage.

```typescript
const { data: url, error } = await db.uploadFile(
  'avatars',
  `${userId}/profile.jpg`,
  fileBlob,
  {
    contentType: 'image/jpeg',
    cacheControl: '3600'
  }
)

console.log('File uploaded:', url)
```

#### `downloadFile(bucket, path)`
Download a file from storage.

```typescript
const { data: blob, error } = await db.downloadFile('avatars', `${userId}/profile.jpg`)

if (blob) {
  const url = URL.createObjectURL(blob)
  // Use blob URL...
}
```

#### `deleteFile(bucket, path)`
Delete a file from storage.

```typescript
const { data: success, error } = await db.deleteFile('avatars', `${userId}/profile.jpg`)
```

#### `getFileUrl(bucket, path)`
Get public URL for a file.

```typescript
const url = db.getFileUrl('avatars', `${userId}/profile.jpg`)
```

---

### Realtime Subscriptions

#### `subscribe(table, callback, options?)`
Subscribe to changes on a table.

```typescript
const unsubscribe = await db.subscribe(
  'users',
  (event, record) => {
    console.log(`User ${event}:`, record)

    if (event === 'INSERT') {
      console.log('New user created:', record)
    } else if (event === 'UPDATE') {
      console.log('User updated:', record)
    } else if (event === 'DELETE') {
      console.log('User deleted:', record)
    }
  },
  {
    filters: [{ column: 'active', operator: '=', value: true }]
  }
)

// Later: Unsubscribe
unsubscribe()
```

---

### Auth Operations

#### `getCurrentUserId()`
Get the current authenticated user ID.

```typescript
const userId = await db.getCurrentUserId()

if (!userId) {
  console.log('User not authenticated')
  return
}
```

#### `setUserContext(userId)`
Set user context for RLS (Row Level Security).

```typescript
db.setUserContext(userId)
```

---

### Advanced Operations

#### `raw(query, params?)`
Execute raw SQL query (use sparingly).

```typescript
const { data, error } = await db.raw(
  'SELECT * FROM users WHERE created_at > $1',
  ['2025-01-01']
)
```

#### `transaction(callback)`
Execute operations in a transaction.

```typescript
const { data: result, error } = await db.transaction(async (tx) => {
  // All operations in this callback are part of the transaction
  await tx.insert('users', { email: 'user@example.com' })
  await tx.insert('profiles', { user_id: userId })

  return { success: true }
})
```

**Note:** Transactions are not yet fully supported in Supabase client library. This is a known limitation.

---

### Health Check

#### `ping()`
Check if database connection is healthy.

```typescript
const isHealthy = await db.ping()

if (!isHealthy) {
  console.error('Database connection failed')
}
```

---

## FILTER OPERATORS

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equals | `{ column: 'active', operator: '=', value: true }` |
| `!=` | Not equals | `{ column: 'role', operator: '!=', value: 'guest' }` |
| `>` | Greater than | `{ column: 'age', operator: '>', value: 18 }` |
| `>=` | Greater than or equal | `{ column: 'score', operator: '>=', value: 100 }` |
| `<` | Less than | `{ column: 'price', operator: '<', value: 50 }` |
| `<=` | Less than or equal | `{ column: 'count', operator: '<=', value: 10 }` |
| `in` | In array | `{ column: 'status', operator: 'in', value: ['active', 'pending'] }` |
| `like` | SQL LIKE (case-sensitive) | `{ column: 'name', operator: 'like', value: '%John%' }` |
| `ilike` | SQL ILIKE (case-insensitive) | `{ column: 'email', operator: 'ilike', value: '%@gmail.com' }` |

---

## MIGRATION GUIDE

### Migrating from Direct Supabase Usage

**Before (Direct Supabase):**
```typescript
import { supabase } from '@/integrations/supabase/client'

const { data: users, error } = await supabase
  .from('users')
  .select('*')
  .eq('active', true)
  .order('created_at', { ascending: false })
  .limit(10)
```

**After (Abstraction Layer):**
```typescript
import { db } from '@/lib/database'

const { data: users, error } = await db.find('users', {
  filters: [{ column: 'active', operator: '=', value: true }],
  orderBy: { column: 'created_at', ascending: false },
  limit: 10
})
```

### Migration Checklist

- [ ] Replace `supabase.from(table).select()` with `db.find(table, ...)`
- [ ] Replace `supabase.from(table).insert()` with `db.insert(table, ...)`
- [ ] Replace `supabase.from(table).update()` with `db.update(table, ...)`
- [ ] Replace `supabase.from(table).delete()` with `db.delete(table, ...)`
- [ ] Replace `supabase.storage.from(bucket).upload()` with `db.uploadFile(bucket, ...)`
- [ ] Replace `supabase.channel().on()` with `db.subscribe(table, ...)`
- [ ] Replace `supabase.auth.getUser()` with `db.getCurrentUserId()`

---

## SWITCHING PROVIDERS

### Current: Supabase

**Environment Variables:**
```bash
VITE_DATABASE_PROVIDER=supabase
VITE_SUPABASE_URL=https://wwajmaohwcbooljdureo.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
```

### Future: PostgreSQL (Cloud SQL/RDS/Azure)

**Steps to Switch:**

1. **Install PostgreSQL client:**
   ```bash
   npm install pg
   ```

2. **Create PostgreSQL provider:**
   ```typescript
   // src/lib/database/providers/postgresql.ts
   export class PostgreSQLDatabase implements IDatabase {
     // Implement IDatabase interface using pg library
   }
   ```

3. **Update factory:**
   ```typescript
   // src/lib/database/index.ts
   case 'postgresql':
     return new PostgreSQLDatabase({
       connectionString: options.connectionString
     })
   ```

4. **Update environment variables:**
   ```bash
   VITE_DATABASE_PROVIDER=postgresql
   DATABASE_CONNECTION_STRING=postgresql://user:pass@host:5432/dbname
   ```

5. **Deploy and test** - Application code remains unchanged!

---

## TESTING

### Unit Testing with Mocks

```typescript
import { describe, it, expect, vi } from 'vitest'
import type { IDatabase } from '@/lib/database'

// Create mock database
const mockDb: IDatabase = {
  findById: vi.fn(),
  find: vi.fn(),
  insert: vi.fn(),
  // ... implement all interface methods
}

describe('User Service', () => {
  it('should fetch user by ID', async () => {
    const mockUser = { id: '123', email: 'test@example.com' }
    mockDb.findById.mockResolvedValue({ data: mockUser, error: null })

    const result = await userService.getUser('123')

    expect(mockDb.findById).toHaveBeenCalledWith('users', '123')
    expect(result).toEqual(mockUser)
  })
})
```

---

## PERFORMANCE CONSIDERATIONS

### Caching

The database abstraction layer does **not** implement caching by default. For caching, use:
- `src/lib/request-cache.ts` for request-level caching
- React Query for component-level caching
- Redis for distributed caching (future)

### Batch Operations

Use `insertMany` instead of multiple `insert` calls:

```typescript
// ❌ BAD: Multiple round trips
for (const user of users) {
  await db.insert('users', user)
}

// ✅ GOOD: Single batch insert
await db.insertMany('users', users)
```

### Selective Columns

Only select columns you need:

```typescript
// ❌ BAD: Fetches all columns
const { data: users } = await db.find('users')

// ✅ GOOD: Fetches only needed columns
const { data: users } = await db.find('users', {
  select: ['id', 'email', 'name']
})
```

---

## LIMITATIONS

### Current Limitations (Supabase Provider)

1. **Transactions:** Not fully supported in Supabase client library
2. **Raw SQL:** Requires custom RPC function (`execute_sql`)
3. **Complex Joins:** Use raw SQL or Supabase's select syntax directly
4. **Realtime Filters:** Applied client-side (performance limitation)

### Workarounds

For complex queries, temporarily use Supabase client directly:

```typescript
import { supabase } from '@/integrations/supabase/client'

// Complex join query
const { data } = await supabase
  .from('users')
  .select(`
    *,
    profiles (*)
  `)
  .eq('active', true)
```

---

## SECURITY

### Row Level Security (RLS)

The abstraction layer respects Supabase RLS policies automatically. Ensure RLS is enabled on all tables.

### Service Role Key

For admin operations, use service role key:

```typescript
import { createDatabase } from '@/lib/database'

const adminDb = createDatabase({
  provider: 'supabase',
  url: process.env.VITE_SUPABASE_URL,
  apiKey: process.env.SUPABASE_SERVICE_ROLE_KEY, // Admin access
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
})

// This bypasses RLS - use with caution!
await adminDb.find('users')
```

---

## TROUBLESHOOTING

### Error: "Database not configured"

**Solution:** Set environment variables:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### Error: "Delete operation requires filters"

**Solution:** Always provide filters when deleting:
```typescript
// ❌ BAD
await db.delete('users')

// ✅ GOOD
await db.delete('users', {
  filters: [{ column: 'active', operator: '=', value: false }]
})
```

### Error: "No rows found" (PGRST116)

This is handled gracefully by `findOne` - returns `{ data: null, error: null }`

---

## FUTURE ENHANCEMENTS

**Phase 2 (Weeks 3-4):**
- [ ] Add PostgreSQL provider implementation
- [ ] Add connection pooling
- [ ] Add query caching layer
- [ ] Add query builder (for complex queries)

**Phase 3 (Weeks 5-6):**
- [ ] Add PlanetScale provider
- [ ] Add distributed caching (Redis)
- [ ] Add query performance monitoring
- [ ] Add automatic retry logic

---

**Document Status:** ✅ COMPLETE
**Last Updated:** 2026-01-03
**Owner:** Backend Team
