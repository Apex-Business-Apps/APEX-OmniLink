"""
OmniPolicy Plane - Cached, deterministic policy evaluation for tool execution.

Responsibilities:
- Fetch enabled policies from the database (cached in-memory with TTL)
- Bounded matching using exact string lists (no regex/exec)
- Deterministic priority ordering (lowest priority value wins)
- Return explainable decision payload for audit/logging
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import json
import os
import time
from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass
from typing import Any

from models.audit import AuditAction, AuditResourceType, AuditStatus, log_audit_event
from models.man_mode import ManLane
from providers.database.factory import get_database_provider

PolicyLoader = Callable[[], Awaitable[list[dict[str, Any]]]]


@dataclass(frozen=True)
class PolicyRecord:
    """In-memory representation of a policy row."""

    name: str
    version: int
    priority: int
    match: dict[str, Any]
    decision: str
    lane: str
    reason: str


class OmniPolicyEvaluator:
    """
    Cached policy evaluator.

    - O(P) bounded matching (small P)
    - In-memory cache with TTL (no per-call DB hits)
    - Deterministic ordering: priority ASC, name ASC, version DESC
    """

    def __init__(
        self,
        cache_ttl_seconds: int | None = None,
        loader: PolicyLoader | None = None,
    ) -> None:
        self.cache_ttl_seconds = cache_ttl_seconds or int(
            os.getenv("OMNIPOLICY_CACHE_TTL_SECONDS", "60")
        )
        self._loader = loader or self._load_from_db
        self._cache: list[PolicyRecord] = []
        self._cache_expires_at: float = 0.0
        self._lock = asyncio.Lock()

    async def _load_from_db(self) -> list[dict[str, Any]]:
        """Load enabled policies from DB."""
        db = get_database_provider()
        rows = await db.select(
            table="omni_policies",
            filters={"enabled": True},
            select_fields="name, version, priority, match, decision, lane, reason",
        )
        return rows or []

    async def _get_policies(self) -> list[PolicyRecord]:
        """Return cached policies, refreshing on TTL expiry."""
        async with self._lock:
            now = time.monotonic()
            if self._cache and now < self._cache_expires_at:
                return self._cache

            rows = await self._loader()
            records = [
                PolicyRecord(
                    name=row["name"],
                    version=int(row.get("version", 1)),
                    priority=int(row.get("priority", 100)),
                    match=row.get("match") or {},
                    decision=str(row.get("decision", "ALLOW")).upper(),
                    lane=str(row.get("lane", "GREEN")).upper(),
                    reason=row.get("reason") or "No reason provided",
                )
                for row in rows
            ]

            # Deterministic ordering
            self._cache = sorted(
                records,
                key=lambda r: (r.priority, r.name, -r.version),
            )
            self._cache_expires_at = now + self.cache_ttl_seconds
            return self._cache

    @staticmethod
    def _matches(policy: PolicyRecord, ctx: dict[str, Any]) -> bool:
        """Bounded matcher: only *_in exact arrays, no regex."""
        match = policy.match or {}

        def field_matches(field: str) -> bool:
            values: Iterable[str] | None = match.get(f"{field}_in")
            if not values:
                return True
            return str(ctx.get(field, "")).lower() in {str(v).lower() for v in values}

        return all(field_matches(field) for field in ("tool", "action", "resource", "data_class"))

    async def evaluate(self, ctx: dict[str, Any]) -> dict[str, Any]:
        """
        Evaluate policies against provided context.

        Returns:
            {
              "decision": "ALLOW|DEFER|DENY",
              "lane": "GREEN|YELLOW|RED|BLOCKED",
              "reason": "...",
              "policy_name": "...",
              "policy_version": int,
            }
        """
        policies = await self._get_policies()

        for policy in policies:
            if self._matches(policy, ctx):
                return {
                    "decision": policy.decision,
                    "lane": policy.lane,
                    "reason": policy.reason,
                    "policy_name": policy.name,
                    "policy_version": policy.version,
                }

        # Default allow if no policy matched
        return {
            "decision": "ALLOW",
            "lane": ManLane.GREEN.value,
            "reason": "No matching policy",
            "policy_name": "default_allow",
            "policy_version": 1,
        }


_evaluator = OmniPolicyEvaluator()


def _hash_ctx(ctx: dict[str, Any]) -> str:
    """Hash context to avoid logging raw payloads."""
    canonical = json.dumps(ctx, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


async def evaluate_policy(ctx: dict[str, Any]) -> dict[str, Any]:
    """
    Evaluate policy and emit audit log (hashed payload).

    Deterministic decision based on cached policies.
    """
    decision = await _evaluator.evaluate(ctx)

    # Audit logging must never block policy enforcement; best-effort only.
    with contextlib.suppress(Exception):
        await log_audit_event(
            actor_id=ctx.get("user_id", "unknown"),
            action=AuditAction.CONFIG_CHANGE,
            resource_type=AuditResourceType.SECURITY_POLICY,
            resource_id=f"{decision['policy_name']}@{decision['policy_version']}",
            status=AuditStatus.SUCCESS,
            metadata=None,
            custom_fields={"ctx_hash": _hash_ctx(ctx), "policy_decision": decision["decision"]},
        )

    return decision
