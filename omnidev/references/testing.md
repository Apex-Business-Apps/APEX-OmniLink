# Testing Patterns Reference

Copyright (c) 2025 APEX Business Systems Ltd. | https://apexbusiness-systems.com

## Testing Pyramid

```
        /\
       /  \  E2E (10%)
      /    \  - Critical user journeys
     /──────\  
    /        \ Integration (20%)
   /          \  - API contracts, DB
  /────────────\
 /              \ Unit (70%)
/                \  - Functions, classes
```

---

## Unit Testing

### Python (pytest)

```python
import pytest
from unittest.mock import Mock, patch
from myapp.services import UserService

class TestUserService:
    @pytest.fixture
    def service(self):
        db = Mock()
        return UserService(db)
    
    def test_create_user_success(self, service):
        service.db.insert.return_value = {"id": "123", "email": "test@example.com"}
        
        result = service.create(email="test@example.com", password="secure123")
        
        assert result["id"] == "123"
        service.db.insert.assert_called_once()
    
    def test_create_user_duplicate_raises(self, service):
        service.db.insert.side_effect = IntegrityError("duplicate")
        
        with pytest.raises(DuplicateEmailError):
            service.create(email="test@example.com", password="secure123")
    
    @pytest.mark.parametrize("email,valid", [
        ("valid@example.com", True),
        ("invalid", False),
        ("", False),
    ])
    def test_email_validation(self, service, email, valid):
        if valid:
            service.validate_email(email)  # No exception
        else:
            with pytest.raises(ValidationError):
                service.validate_email(email)
```

### TypeScript (Jest/Vitest)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from './user-service';

describe('UserService', () => {
  let service: UserService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn(),
      findOne: vi.fn(),
    };
    service = new UserService(mockDb);
  });

  it('creates user successfully', async () => {
    mockDb.insert.mockResolvedValue({ id: '123', email: 'test@example.com' });

    const result = await service.create({ email: 'test@example.com', password: 'secure123' });

    expect(result.id).toBe('123');
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it('throws on duplicate email', async () => {
    mockDb.insert.mockRejectedValue(new Error('duplicate'));

    await expect(
      service.create({ email: 'test@example.com', password: 'secure123' })
    ).rejects.toThrow('Email already exists');
  });
});
```

### Go

```go
func TestUserService_Create(t *testing.T) {
    tests := []struct {
        name    string
        email   string
        wantErr bool
    }{
        {"valid email", "test@example.com", false},
        {"invalid email", "invalid", true},
        {"empty email", "", true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            db := &mockDB{}
            svc := NewUserService(db)

            _, err := svc.Create(tt.email, "password")

            if (err != nil) != tt.wantErr {
                t.Errorf("Create() error = %v, wantErr %v", err, tt.wantErr)
            }
        })
    }
}
```

---

## Integration Testing

### API Testing (Python)

```python
import pytest
from fastapi.testclient import TestClient
from myapp.main import app

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

def test_create_item(client):
    response = client.post(
        "/items",
        json={"name": "Test Item", "price": 19.99}
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Item"
    assert "id" in data

def test_create_item_invalid(client):
    response = client.post("/items", json={"name": ""})
    
    assert response.status_code == 422
```

### Database Testing

```python
import pytest
from sqlalchemy import create_engine
from myapp.models import Base

@pytest.fixture(scope="function")
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    
    with engine.connect() as conn:
        yield conn
        conn.rollback()

def test_user_crud(db):
    # Create
    result = db.execute("INSERT INTO users (email) VALUES (?)", ["test@example.com"])
    user_id = result.lastrowid
    
    # Read
    user = db.execute("SELECT * FROM users WHERE id = ?", [user_id]).fetchone()
    assert user["email"] == "test@example.com"
```

---

## E2E Testing

### Playwright

```typescript
import { test, expect } from '@playwright/test';

test.describe('User Flow', () => {
  test('complete checkout', async ({ page }) => {
    await page.goto('/');
    
    // Login
    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="submit"]');
    
    // Add to cart
    await page.click('[data-testid="product-1"]');
    await page.click('[data-testid="add-to-cart"]');
    
    // Checkout
    await page.click('[data-testid="checkout"]');
    await expect(page.locator('[data-testid="success"]')).toBeVisible();
  });
});
```

---

## Test Coverage

```bash
# Python
pytest --cov=src --cov-report=html --cov-fail-under=80

# TypeScript
vitest --coverage --coverage.thresholds.lines=80

# Go
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

---

## Test Data

### Factories (Python)

```python
import factory
from faker import Faker

fake = Faker()

class UserFactory(factory.Factory):
    class Meta:
        model = User
    
    email = factory.LazyFunction(fake.email)
    name = factory.LazyFunction(fake.name)
    
class OrderFactory(factory.Factory):
    class Meta:
        model = Order
    
    user = factory.SubFactory(UserFactory)
    total_cents = factory.LazyFunction(lambda: fake.random_int(100, 10000))
```

---

## CI Integration

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install
        run: pip install -e ".[test]"
      
      - name: Lint
        run: ruff check .
      
      - name: Type check
        run: mypy src/
      
      - name: Test
        run: pytest --cov=src --cov-fail-under=80
```

---

## Testing Checklist

| Area | Required Tests |
|------|----------------|
| Happy path | Basic success case |
| Validation | Invalid inputs |
| Edge cases | Empty, null, boundary |
| Errors | Exception handling |
| Auth | Unauthorized, forbidden |
| Concurrency | Race conditions |
| Performance | Load testing (critical paths) |
