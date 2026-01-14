from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass


@dataclass(frozen=True)
class OmniLinkConstraints:
    env_allowlist: list[str]
    allowed_adapters: list[str]
    allowed_workflows: list[dict]


@dataclass(frozen=True)
class OmniLinkScopes:
    permissions: list[str]
    constraints: OmniLinkConstraints


def match_permission(permissions: Iterable[str], required: str) -> bool:
    if "*" in permissions:
        return True
    if required in permissions:
        return True
    prefix = required.split(":", 1)[0]
    return f"{prefix}:*" in permissions


def enforce_env_allowlist(source: str, allowlist: list[str]) -> bool:
    if not allowlist:
        return True
    env_segment = source.split("/")[-1]
    return env_segment in allowlist


def allow_adapter(target: dict | None, allowlist: list[str]) -> bool:
    if not allowlist:
        return True
    system = (target or {}).get("system")
    return system in allowlist


def allow_workflow(workflow: dict | None, allowlist: list[dict]) -> bool:
    if not allowlist:
        return True
    workflow = workflow or {}
    name = workflow.get("name")
    version = workflow.get("version")
    if not name:
        return False
    for entry in allowlist:
        if entry.get("name") == name and (entry.get("version") in (None, version)):
            return True
    return False


def normalize_scopes(scopes: dict | None) -> OmniLinkScopes:
    scopes = scopes or {}
    constraints = scopes.get("constraints") or {}
    return OmniLinkScopes(
        permissions=list(scopes.get("permissions") or []),
        constraints=OmniLinkConstraints(
            env_allowlist=list(constraints.get("env_allowlist") or []),
            allowed_adapters=list(constraints.get("allowed_adapters") or []),
            allowed_workflows=list(constraints.get("allowed_workflows") or []),
        ),
    )


def evaluate_scope(scopes: dict | None, request_type: str, payload: dict) -> tuple[bool, str]:
    normalized = normalize_scopes(scopes)
    if request_type == "event":
        required = "events:write"
    elif request_type == "command":
        required = f"commands:{payload.get('type')}"
    else:
        required = "orchestrations:request"

    if not match_permission(normalized.permissions, required):
        return False, "permission_denied"

    source = payload.get("source", "")
    if not enforce_env_allowlist(source, normalized.constraints.env_allowlist):
        return False, "env_not_allowed"

    if request_type == "command" and not allow_adapter(
        payload.get("target"),
        normalized.constraints.allowed_adapters,
    ):
        return False, "adapter_not_allowed"

    if request_type == "workflow" and not allow_workflow(
        payload.get("workflow"),
        normalized.constraints.allowed_workflows,
    ):
        return False, "workflow_not_allowed"

    return True, "ok"
