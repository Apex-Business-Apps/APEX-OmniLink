# ONE-PASS DEBUG: Bug Pattern Library

> **Reference**: Load on-demand when Phase 3 root cause deduction needs pattern matching.

© 2025 APEX Business Systems Ltd. Edmonton, AB, Canada.

---

## Pattern Categories

### 1. NULL/UNDEFINED PATTERNS

| Pattern | Symptoms | Root Cause | Fix |
|---------|----------|------------|-----|
| **Uninitialized variable** | `undefined` or `null` at runtime | Variable declared but not assigned | Initialize with default value |
| **Missing optional chain** | `Cannot read property X of undefined` | Deep object access without null check | Add `?.` or guard clause |
| **Async timing** | Value `undefined` on first render/call | Data not loaded yet | Add loading state, null check |
| **Destructuring missing** | `undefined` from destructure | Object doesn't have expected key | Default values in destructure |
| **API response changed** | Suddenly `null` where data expected | Backend contract changed | Update frontend to match |

### 2. OFF-BY-ONE PATTERNS

| Pattern | Symptoms | Root Cause | Fix |
|---------|----------|------------|-----|
| **Array bounds** | Index out of bounds | Using `<=` instead of `<` | Use `< length`, not `<= length` |
| **Loop iteration** | Missing first/last element | Starting at 1 or ending early | Start at 0, end at length |
| **Pagination** | Missing or duplicate items | Page/offset calculation wrong | Verify: `offset = (page - 1) * pageSize` |
| **Date/time** | Wrong day/month | 0-indexed months, timezone | Use library, be explicit about timezone |
| **String slice** | Wrong characters returned | End index is exclusive | `slice(0, 5)` returns indices 0-4 |

### 3. ASYNC/TIMING PATTERNS

| Pattern | Symptoms | Root Cause | Fix |
|---------|----------|------------|-----|
| **Race condition** | Intermittent wrong data | Two async ops compete | Add mutex, queue, or sequence |
| **Stale closure** | Old value in callback | Closure captured old state | Use ref, or add to deps |
| **Missing await** | Promise object instead of value | Forgot `await` keyword | Add `await` |
| **Callback hell** | Unpredictable execution order | Nested callbacks | Convert to async/await |
| **Event loop blocking** | UI freezes, timeouts | Sync operation on main thread | Move to worker or async |

### 4. STATE MANAGEMENT PATTERNS

| Pattern | Symptoms | Root Cause | Fix |
|---------|----------|------------|-----|
| **Stale state** | UI shows old data | State not updated | Verify state setter called correctly |
| **Mutation** | Random bugs, no re-render | Direct state mutation | Return new object/array |
| **Double render** | Effect runs twice | React StrictMode or missing deps | Add proper dependency array |
| **Infinite loop** | Browser crashes, max depth | Effect triggers its own dependency | Fix dependency array, add guard |
| **Lost update** | Changes disappear | Concurrent writes | Use functional update or locks |

### 5. TYPE MISMATCH PATTERNS

| Pattern | Symptoms | Root Cause | Fix |
|---------|----------|------------|-----|
| **String vs Number** | `"12" + 3 = "123"` | Implicit coercion | Explicit `parseInt()` or `Number()` |
| **Truthy/Falsy** | `0` or `""` treated as false | Loose equality check | Use `=== null` or `!== undefined` |
| **Array vs Object** | Method doesn't exist | Expected array, got object | Validate type before operation |
| **Date string** | Invalid date operations | String not parsed to Date | `new Date(string)` or library |
| **JSON parse** | Crash on malformed input | Invalid JSON string | Try/catch around parse |

### 6. NETWORK/API PATTERNS

| Pattern | Symptoms | Root Cause | Fix |
|---------|----------|------------|-----|
| **CORS** | Request blocked | Missing headers on server | Add CORS headers server-side |
| **Auth expired** | 401 errors after time | Token expired | Refresh token flow |
| **Timeout** | Hanging requests | Server slow or unreachable | Add timeout, retry logic |
| **Payload too large** | 413 error | Body exceeds limit | Compress, chunk, or raise limit |
| **Wrong method** | 405 error | GET vs POST mismatch | Match method to endpoint |

### 7. DATABASE PATTERNS

| Pattern | Symptoms | Root Cause | Fix |
|---------|----------|------------|-----|
| **N+1 query** | Slow page load | Query in loop | Use JOIN or eager loading |
| **Deadlock** | Timeout, stuck queries | Competing transactions | Reorder operations, add timeout |
| **Missing index** | Slow queries | Full table scan | Add index on WHERE/JOIN columns |
| **Constraint violation** | Insert/update fails | FK, unique, or check failed | Validate before write, handle error |
| **Connection exhausted** | Pool empty errors | Connections not released | Ensure connection.release() |

### 8. MEMORY/PERFORMANCE PATTERNS

| Pattern | Symptoms | Root Cause | Fix |
|---------|----------|------------|-----|
| **Memory leak** | Growing memory, eventual crash | Unreleased references | Clear intervals, remove listeners |
| **Unbounded growth** | Array/object grows forever | No cleanup or limit | Add max size, eviction policy |
| **Expensive re-render** | Slow UI, high CPU | Unnecessary component updates | Memoize, virtualize lists |
| **Large payload** | Slow load, timeout | Too much data transferred | Paginate, compress, lazy load |
| **Blocking operation** | UI freeze | Sync heavy computation | Web worker or chunked processing |

### 9. SECURITY PATTERNS

| Pattern | Symptoms | Root Cause | Fix |
|---------|----------|------------|-----|
| **Injection** | Unexpected data execution | Unsanitized user input | Parameterized queries, escape |
| **XSS** | Script runs in browser | Raw HTML insertion | Escape output, CSP headers |
| **Auth bypass** | Unauthorized access | Missing server check | Always validate server-side |
| **Sensitive exposure** | Secrets in logs/response | Logging too much | Redact sensitive fields |
| **CSRF** | Unauthorized actions | No token verification | Add and verify CSRF token |

### 10. ENVIRONMENT/CONFIG PATTERNS

| Pattern | Symptoms | Root Cause | Fix |
|---------|----------|------------|-----|
| **Missing env var** | Undefined config value | Env not set in environment | Add to .env, verify loading |
| **Wrong environment** | Dev data in prod | Env detection wrong | Check NODE_ENV properly |
| **Version mismatch** | Works locally, fails remote | Different dependency version | Lock versions, pin deps |
| **Path issues** | File not found | Relative vs absolute path | Use `__dirname`, path.join |
| **Permission denied** | Can't read/write | File/folder permissions | chmod, chown, or run as correct user |

---

## Language-Specific Patterns

### JavaScript/TypeScript

```javascript
// ❌ COMMON BUGS
[1,2,3].map(async x => x)  // Returns Promise[], not values
obj.key = value            // In React: mutates, no re-render
arr.length = 0             // Truncates array (often accidental)
JSON.parse(undefined)      // Throws, not returns null

// ✅ CORRECT
await Promise.all([1,2,3].map(async x => x))  // Awaits all
setObj({...obj, key: value})                  // New reference
arr = []                                       // New array
JSON.parse(str ?? '{}')                       // Default to empty
```

### Python

```python
# ❌ COMMON BUGS
def foo(items=[]):      # Mutable default argument
    items.append(1)     # Persists across calls!

for i in range(len(lst)):
    del lst[i]          # Modifying while iterating

x = y = []              # Same list reference!

# ✅ CORRECT
def foo(items=None):
    items = items or []
    items.append(1)

for item in lst[:]:     # Iterate copy
    lst.remove(item)

x, y = [], []           # Separate lists
```

### SQL

```sql
-- ❌ COMMON BUGS
SELECT * FROM users WHERE id = '1'  -- String comparison on int
SELECT * FROM users WHERE name = NULL  -- NULL != NULL
DELETE FROM users  -- No WHERE clause!

-- ✅ CORRECT
SELECT * FROM users WHERE id = 1
SELECT * FROM users WHERE name IS NULL
DELETE FROM users WHERE id = ?  -- Parameterized + condition
```

### React

```jsx
// ❌ COMMON BUGS
useEffect(() => { fetchData() }, [data])  // Infinite loop
useState(props.value)  // Only sets initial, won't update
onClick={handleClick()}  // Calls immediately, not on click

// ✅ CORRECT
useEffect(() => { fetchData() }, [])  // Run once
const [value, setValue] = useState(props.value)
useEffect(() => { setValue(props.value) }, [props.value])
onClick={handleClick}  // Pass reference
```

---

## Quick Diagnosis Decision Tree

```
Error type?
├─ TypeError/ReferenceError
│  └─ "undefined" or "null"? → Null Pattern (#1)
│  └─ "is not a function"? → Type Mismatch (#5)
├─ RangeError
│  └─ Array/stack related? → Off-by-One (#2)
├─ Network Error
│  └─ CORS? Auth? Timeout? → Network Pattern (#6)
├─ No error, wrong result
│  └─ Intermittent? → Async Pattern (#3)
│  └─ Consistent? → State or Logic error
├─ Performance issue
│  └─ Slow over time? → Memory Pattern (#8)
│  └─ Always slow? → Database or Algorithm
└─ Security finding
   └─ Match to Security Pattern (#9)
```

---

## Usage

1. **Identify error category** from symptoms
2. **Match to pattern** in relevant section
3. **Verify match** with evidence from Phase 2
4. **Apply known fix** from pattern
5. **Validate** fix works for your specific case

**Remember**: Patterns accelerate diagnosis but don't replace evidence. ALWAYS verify the pattern matches your specific case before applying the fix.
