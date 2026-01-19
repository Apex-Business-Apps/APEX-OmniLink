# Framework Patterns Reference

Copyright (c) 2025 APEX Business Systems Ltd. | https://apexbusiness-systems.com

Quick reference for framework-specific patterns and best practices.

## React / Next.js

### Component Patterns

```tsx
// Compound Components
const Tabs = ({ children }: { children: React.ReactNode }) => {
  const [active, setActive] = useState(0);
  return (
    <TabsContext.Provider value={{ active, setActive }}>
      {children}
    </TabsContext.Provider>
  );
};
Tabs.List = TabsList;
Tabs.Panel = TabsPanel;

// Custom Hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```

### Data Fetching (React Query / SWR)

```tsx
// React Query
function useUser(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => api.getUser(id),
    staleTime: 5 * 60 * 1000,
  });
}

// SWR
function useUser(id: string) {
  const { data, error, isLoading } = useSWR(`/api/users/${id}`, fetcher);
  return { user: data, error, isLoading };
}
```

### Server Components (Next.js 14+)

```tsx
// Server Component (default)
async function ProductList() {
  const products = await db.products.findMany();
  return <ul>{products.map(p => <ProductCard key={p.id} {...p} />)}</ul>;
}

// Client Component
'use client';
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

// Server Action
'use server';
async function createPost(formData: FormData) {
  await db.posts.create({ data: { title: formData.get('title') } });
  revalidatePath('/posts');
}
```

---

## Vue.js

### Composition API

```vue
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';

const count = ref(0);
const double = computed(() => count.value * 2);

watch(count, (newVal) => console.log('Count:', newVal));

onMounted(async () => {
  // Fetch data
});
</script>
```

### Pinia Store

```typescript
import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', {
  state: () => ({ user: null as User | null }),
  getters: { isLoggedIn: (state) => !!state.user },
  actions: {
    async login(email: string, password: string) {
      this.user = await api.login(email, password);
    },
  },
});
```

---

## Express.js / Node.js

### Route Structure

```typescript
import { Router } from 'express';
import { z } from 'zod';

const router = Router();

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

router.post('/', async (req, res, next) => {
  try {
    const data = CreateUserSchema.parse(req.body);
    const user = await userService.create(data);
    res.status(201).json({ data: user });
  } catch (error) {
    next(error);
  }
});

export default router;
```

### Middleware

```typescript
// Error handler
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.code });
  }
  console.error(err);
  res.status(500).json({ error: 'INTERNAL_ERROR' });
};

// Auth middleware
const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'NO_TOKEN' });
  try {
    req.user = await verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'INVALID_TOKEN' });
  }
};
```

---

## FastAPI (Python)

### Routes

```python
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel, EmailStr

app = FastAPI()

class UserCreate(BaseModel):
    email: EmailStr
    name: str

@app.post("/users", status_code=201)
async def create_user(data: UserCreate, db = Depends(get_db)):
    user = await db.users.create(data.model_dump())
    return {"data": user}

@app.get("/users/{user_id}")
async def get_user(user_id: str, db = Depends(get_db)):
    user = await db.users.find_unique(id=user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return {"data": user}
```

### Dependency Injection

```python
async def get_db():
    async with AsyncSession() as session:
        yield session

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db = Depends(get_db),
) -> User:
    user = await verify_token(token, db)
    if not user:
        raise HTTPException(401, "Invalid token")
    return user
```

---

## Django

### Views

```python
from django.http import JsonResponse
from django.views import View

class UserView(View):
    def get(self, request, user_id=None):
        if user_id:
            user = get_object_or_404(User, pk=user_id)
            return JsonResponse({'data': user.to_dict()})
        return JsonResponse({'data': list(User.objects.values()[:20])})

    def post(self, request):
        data = json.loads(request.body)
        serializer = UserSerializer(data=data)
        if serializer.is_valid():
            user = serializer.save()
            return JsonResponse({'data': user.to_dict()}, status=201)
        return JsonResponse({'error': serializer.errors}, status=400)
```

---

## Spring Boot (Java)

```java
@RestController
@RequestMapping("/api/v1/users")
public class UserController {
    
    @Autowired
    private UserService userService;
    
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse createUser(@Valid @RequestBody CreateUserRequest request) {
        return userService.create(request);
    }
    
    @GetMapping("/{id}")
    public UserResponse getUser(@PathVariable UUID id) {
        return userService.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }
}
```

---

## Go (Gin/Echo)

```go
// Gin
func main() {
    r := gin.Default()
    r.POST("/users", createUser)
    r.GET("/users/:id", getUser)
    r.Run(":8080")
}

func createUser(c *gin.Context) {
    var req CreateUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    user, err := userService.Create(req)
    if err != nil {
        c.JSON(500, gin.H{"error": "Internal error"})
        return
    }
    c.JSON(201, gin.H{"data": user})
}
```
