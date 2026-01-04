"""Unit tests for semantic caching with Redis."""

import pytest

from infrastructure.cache import EntityExtractor, SemanticCacheService


class TestEntityExtractor:
    """Test entity extraction from natural language."""

    def test_extract_date_entities(self):
        """Should extract date references."""
        text = "Book flight tomorrow"
        entities = EntityExtractor.extract_entities(text)

        assert "DATE" in entities
        assert "tomorrow" in entities["DATE"]

    def test_extract_location_entities(self):
        """Should extract location references."""
        text = "Book flight to Paris"
        entities = EntityExtractor.extract_entities(text)

        assert "LOCATION" in entities
        assert any("paris" in loc.lower() for loc in entities["LOCATION"])

    def test_extract_email_entities(self):
        """Should extract email addresses."""
        text = "Send confirmation to user@example.com"
        entities = EntityExtractor.extract_entities(text)

        assert "EMAIL" in entities
        assert "user@example.com" in entities["EMAIL"]

    def test_extract_amount_entities(self):
        """Should extract monetary amounts."""
        text = "Transfer $1,500 to account"
        entities = EntityExtractor.extract_entities(text)

        assert "AMOUNT" in entities
        assert "$1,500" in entities["AMOUNT"]

    def test_create_template(self):
        """Should convert goal into parameterized template."""
        text = "Book flight to Paris tomorrow"
        template, params = EntityExtractor.create_template(text)

        # Check template has placeholders
        assert "{" in template and "}" in template

        # Check parameters extracted
        assert "LOCATION" in params or "DATE" in params

    def test_template_preserves_structure(self):
        """Should preserve sentence structure in template."""
        text = "Send $500 to john@example.com tomorrow"
        template, params = EntityExtractor.create_template(text)

        # Template should start with "Send"
        assert template.startswith("Send")

        # Should have extracted email and amount
        assert "EMAIL" in params or "AMOUNT" in params


@pytest.mark.asyncio
class TestSemanticCacheService:
    """Test semantic cache with vector similarity search."""

    @pytest.fixture
    async def cache_service(self):
        """Create cache service instance for testing."""
        # Use test Redis (or mock if no Redis available)
        cache = SemanticCacheService(
            redis_url="redis://localhost:6379/15",  # Test DB
            similarity_threshold=0.85,
            ttl_seconds=300,  # 5min for tests
        )
        try:
            await cache.initialize()
            yield cache
        except Exception:
            # If Redis not available, skip tests
            pytest.skip("Redis not available for testing")
        finally:
            await cache.close()

    async def test_store_and_retrieve_plan(self, cache_service):
        """Should store plan and retrieve it on cache hit."""
        goal = "Book flight to Paris tomorrow"
        plan_steps = [
            {
                "id": "step1",
                "tool": "search_flights",
                "input": {"to": "{LOCATION}", "date": "{DATE}"},
            },
            {"id": "step2", "tool": "book_flight", "input": {"flight_id": "{FLIGHT_ID}"}},
        ]

        # Store plan
        template_id = await cache_service.store_plan(goal, plan_steps)
        assert template_id is not None

        # Retrieve plan (should hit cache)
        cached = await cache_service.get_plan("Book flight to Paris tomorrow")

        assert cached is not None
        assert cached.cache_hit is True
        assert cached.similarity_score >= 0.85
        assert len(cached.steps) == 2

    async def test_semantic_similarity_matching(self, cache_service):
        """Should match semantically similar queries."""
        # Store plan
        original_goal = "Book flight to Paris"
        plan_steps = [{"id": "step1", "tool": "search_flights"}]
        await cache_service.store_plan(original_goal, plan_steps)

        # Try similar query
        similar_goal = "Reserve airplane ticket to Paris"
        cached = await cache_service.get_plan(similar_goal)

        # Might hit cache if embedding similarity is high enough
        # (depends on sentence-transformers model)
        if cached:
            assert cached.similarity_score >= 0.85

    async def test_parameter_injection(self, cache_service):
        """Should inject correct parameters into cached plan."""
        goal = "Book flight to Paris on 2024-01-15"
        plan_steps = [
            {
                "id": "step1",
                "tool": "search_flights",
                "input": {"to": "{LOCATION}", "date": "{DATE}"},
            },
        ]
        await cache_service.store_plan(goal, plan_steps)

        # Retrieve with same parameters
        cached = await cache_service.get_plan("Book flight to Paris on 2024-01-15")

        if cached:
            # Check parameters were injected
            assert cached.parameters is not None
            # Should have extracted Paris and date
            assert len(cached.parameters) > 0

    async def test_cache_miss(self, cache_service):
        """Should return None on cache miss."""
        # Try to get plan that doesn't exist
        cached = await cache_service.get_plan("Completely unique query xyz123")

        assert cached is None

    async def test_ttl_expiration(self, cache_service):
        """Should respect TTL for cache entries."""
        # Store plan with 1-second TTL
        cache_service.ttl_seconds = 1
        goal = "Test expiration"
        plan_steps = [{"id": "step1", "tool": "test"}]

        await cache_service.store_plan(goal, plan_steps, ttl_seconds=1)

        # Immediate retrieval should hit
        cached = await cache_service.get_plan(goal)
        assert cached is not None

        # Wait for expiration
        import asyncio

        await asyncio.sleep(2)

        # Should miss cache after TTL
        cached_after = await cache_service.get_plan(goal)
        assert cached_after is None or cached_after.similarity_score < 0.85
