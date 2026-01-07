"""
Mock Semantic Cache Service for Redis functionality.

This provides a mock implementation of the semantic caching system
until the real Redis-based implementation is available.
"""

import asyncio
import hashlib
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class CachedPlan(BaseModel):
    """Cached plan result."""

    plan_id: str
    template_id: Optional[str] = None
    similarity_score: float
    steps: List[Dict[str, Any]]
    reasoning: str = "Mock cached plan"


class SemanticCacheService:
    """
    Mock implementation of semantic cache service.

    This simulates Redis-based semantic caching without requiring
    actual Redis connectivity. In production, this would be replaced
    with a real Redis-based implementation.
    """

    def __init__(
        self,
        redis_url: str,
        embedding_model: str = "all-MiniLM-L6-v2",
        similarity_threshold: float = 0.85,
    ):
        """
        Initialize mock cache service.

        Args:
            redis_url: Redis URL (mocked - not used)
            embedding_model: Embedding model name (mocked)
            similarity_threshold: Similarity threshold (mocked)
        """
        self.redis_url = redis_url
        self.embedding_model = embedding_model
        self.similarity_threshold = similarity_threshold
        self._cache: Dict[str, CachedPlan] = {}
        self._initialized = False

    async def initialize(self) -> None:
        """
        Initialize the cache service.

        In production, this would connect to Redis and load embeddings.
        For now, it just sets up mock data.
        """
        # Simulate some cached plans for testing
        mock_plans = [
            {
                "goal": "Book flight to Paris tomorrow",
                "plan_id": "flight-booking-plan-001",
                "template_id": "flight-template-001",
                "similarity_score": 0.92,
                "steps": [
                    {
                        "id": "search_flights",
                        "name": "Search for flights",
                        "tool": "search_flights",
                        "input": {"to": "Paris", "date": "tomorrow"},
                    },
                    {
                        "id": "book_flight",
                        "name": "Book the flight",
                        "tool": "book_flight",
                        "input": {"flight_id": "{search_flights.flight_id}"},
                        "compensation": "cancel_flight",
                    },
                ],
            },
            {
                "goal": "Send email to user@example.com",
                "plan_id": "email-plan-001",
                "template_id": "email-template-001",
                "similarity_score": 0.88,
                "steps": [
                    {
                        "id": "send_email",
                        "name": "Send email",
                        "tool": "send_email",
                        "input": {
                            "to": "user@example.com",
                            "subject": "Notification",
                            "body": "Hello from APEX!",
                        },
                    }
                ],
            },
        ]

        for plan_data in mock_plans:
            goal_hash = hashlib.md5(plan_data["goal"].encode()).hexdigest()
            self._cache[goal_hash] = CachedPlan(**plan_data)

        self._initialized = True
        print("✓ Mock SemanticCacheService initialized with sample data")

    async def get_plan(self, goal: str) -> Optional[CachedPlan]:
        """
        Get cached plan for a goal.

        Args:
            goal: User goal string

        Returns:
            Cached plan if found and above similarity threshold, None otherwise
        """
        if not self._initialized:
            raise RuntimeError("Cache service not initialized")

        goal_hash = hashlib.md5(goal.encode()).hexdigest()

        # Simulate some fuzzy matching for testing
        if "flight" in goal.lower() and "paris" in goal.lower():
            return self._cache.get(hashlib.md5("Book flight to Paris tomorrow".encode()).hexdigest())

        if "email" in goal.lower():
            return self._cache.get(hashlib.md5("Send email to user@example.com".encode()).hexdigest())

        # For other goals, return None (cache miss)
        return None

    async def store_plan(self, goal: str, plan_steps: List[Dict[str, Any]]) -> str:
        """
        Store a plan in the cache.

        Args:
            goal: User goal string
            plan_steps: Plan steps to cache

        Returns:
            Template ID for the stored plan
        """
        if not self._initialized:
            raise RuntimeError("Cache service not initialized")

        template_id = f"template-{hashlib.md5(goal.encode()).hexdigest()[:8]}"

        goal_hash = hashlib.md5(goal.encode()).hexdigest()
        self._cache[goal_hash] = CachedPlan(
            plan_id=f"plan-{hashlib.md5(goal.encode()).hexdigest()[:8]}",
            template_id=template_id,
            similarity_score=1.0,  # Perfect match for stored plans
            steps=plan_steps,
            reasoning="Stored plan",
        )

        return template_id

    async def close(self) -> None:
        """Close the cache service."""
        self._cache.clear()
        self._initialized = False
        print("✓ Mock SemanticCacheService closed")


class EntityExtractor:
    """
    Mock entity extractor for semantic caching.

    This provides mock implementations of entity extraction
    used in semantic caching until the real implementation is available.
    """

    @staticmethod
    def create_template(goal: str) -> tuple[str, Dict[str, Any]]:
        """
        Create a template from a goal by extracting entities.

        Args:
            goal: User goal string

        Returns:
            Tuple of (template_string, parameters_dict)
        """
        # Simple mock implementation - extract common entities
        template = goal
        params = {}

        # Extract location (simple pattern)
        if " to " in goal.lower():
            parts = goal.lower().split(" to ")
            if len(parts) > 1:
                location = parts[1].split()[0].title()
                template = template.replace(location, "{LOCATION}")
                params["LOCATION"] = location

        # Extract dates (simple pattern)
        if "tomorrow" in goal.lower():
            template = template.replace("tomorrow", "{DATE}")
            params["DATE"] = "tomorrow"

        return template, params


class PlanTemplate(BaseModel):
    """
    Mock plan template for semantic caching.

    This represents a reusable plan template with placeholders
    for dynamic values.
    """

    template_id: str
    template: str
    parameters: Dict[str, Any]
    plan_steps: List[Dict[str, Any]]
    usage_count: int = 0


class MockRedisClient:
    """
    Mock Redis client for basic Redis operations.

    This provides mock implementations of common Redis operations
    used throughout the system until real Redis is available.
    """

    def __init__(self, url: str):
        """Initialize mock Redis client."""
        self.url = url
        self._data: Dict[str, Any] = {}
        self._initialized = False

    async def initialize(self) -> None:
        """Initialize the Redis client."""
        # Simulate connection delay
        await asyncio.sleep(0.1)
        self._initialized = True
        print("✓ Mock Redis client initialized")

    async def get(self, key: str) -> Optional[str]:
        """Get value from Redis."""
        return self._data.get(key)

    async def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        """Set value in Redis with optional expiration."""
        self._data[key] = value
        return True

    async def delete(self, key: str) -> int:
        """Delete key from Redis."""
        if key in self._data:
            del self._data[key]
            return 1
        return 0

    async def exists(self, key: str) -> int:
        """Check if key exists in Redis."""
        return 1 if key in self._data else 0

    async def expire(self, key: str, seconds: int) -> int:
        """Set expiration on key."""
        # Mock implementation - doesn't actually expire
        return 1 if key in self._data else 0

    async def close(self) -> None:
        """Close Redis connection."""
        self._data.clear()
        self._initialized = False
        print("✓ Mock Redis client closed")
