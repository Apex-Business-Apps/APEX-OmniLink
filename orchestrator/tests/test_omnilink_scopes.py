from omnilink.scopes import (
    allow_adapter,
    allow_workflow,
    evaluate_scope,
    match_permission,
)


def test_match_permission():
    assert match_permission(["events:write"], "events:write")
    assert match_permission(["events:*"], "events:write")
    assert match_permission(["*"], "commands.calendar.create")
    assert not match_permission(["events:write"], "commands.calendar.create")


def test_allow_adapter_and_workflow():
    assert allow_adapter({"system": "webhook"}, ["webhook"])
    assert not allow_adapter({"system": "calendar"}, ["webhook"])

    assert allow_workflow({"name": "sync", "version": "1.0.0"}, [{"name": "sync"}])
    assert not allow_workflow(
        {"name": "sync", "version": "1.0.0"},
        [{"name": "sync", "version": "2.0.0"}],
    )


def test_evaluate_scope():
    scopes = {
        "permissions": ["events:write", "orchestrations:request", "commands:calendar.create"],
        "constraints": {
            "env_allowlist": ["prod"],
            "allowed_adapters": ["calendar"],
            "allowed_workflows": [{"name": "sync"}],
        },
    }

    ok, reason = evaluate_scope(
        scopes,
        "event",
        {"type": "event.created", "source": "app://vendor/app/prod"},
    )
    assert ok is True
    assert reason == "ok"

    ok, reason = evaluate_scope(
        scopes,
        "command",
        {
            "type": "calendar.create",
            "source": "app://vendor/app/prod",
            "target": {"system": "calendar"},
        },
    )
    assert ok is True

    ok, reason = evaluate_scope(
        scopes,
        "workflow",
        {
            "type": "workflow.run.requested",
            "source": "app://vendor/app/prod",
            "workflow": {"name": "sync"},
        },
    )
    assert ok is True

    ok, reason = evaluate_scope(
        scopes,
        "workflow",
        {
            "type": "workflow.run.requested",
            "source": "app://vendor/app/dev",
            "workflow": {"name": "sync"},
        },
    )
    assert ok is False
    assert reason == "env_not_allowed"
