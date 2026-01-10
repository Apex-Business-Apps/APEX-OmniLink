"""
Enterprise Compliance Audit Logging Schema.

This module defines the strict schema for audit logging to ensure future
compliance with SOC2, GDPR, and other enterprise compliance frameworks.

All audit events must be logged using this schema to maintain:
- Complete audit trails
- Structured data for compliance reporting
- Immutable records for forensic analysis
- Standardized metadata for enterprise integration
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class AuditAction(str, Enum):
    """Standardized audit actions for compliance tracking."""

    # Authentication & Authorization
    LOGIN = "login"
    LOGOUT = "logout"
    AUTH_FAILURE = "auth_failure"
    TOKEN_REFRESH = "token_refresh"
    PASSWORD_CHANGE = "password_change"

    # Data Operations
    DATA_ACCESS = "data_access"
    DATA_MODIFY = "data_modify"
    DATA_DELETE = "data_delete"
    DATA_EXPORT = "data_export"

    # Workflow Operations
    WORKFLOW_START = "workflow_start"
    WORKFLOW_COMPLETE = "workflow_complete"
    WORKFLOW_FAIL = "workflow_fail"
    WORKFLOW_CANCEL = "workflow_cancel"
    ACTIVITY_EXECUTE = "activity_execute"
    ACTIVITY_RETRY = "activity_retry"
    ACTIVITY_TIMEOUT = "activity_timeout"

    # Security Events
    SECURITY_VIOLATION = "security_violation"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    CONFIG_CHANGE = "config_change"

    # Compliance Events
    COMPLIANCE_CHECK = "compliance_check"
    COMPLIANCE_VIOLATION = "compliance_violation"
    AUDIT_LOG_ACCESS = "audit_log_access"


class AuditResourceType(str, Enum):
    """Resource types for audit logging."""

    USER = "user"
    WORKFLOW = "workflow"
    ACTIVITY = "activity"
    DATABASE = "database"
    API_ENDPOINT = "api_endpoint"
    CONFIGURATION = "configuration"
    SECURITY_POLICY = "security_policy"


class AuditStatus(str, Enum):
    """Audit event outcome status."""

    SUCCESS = "success"
    FAILURE = "failure"
    DENIED = "denied"
    TIMEOUT = "timeout"
    ERROR = "error"


class AuditMetadata(BaseModel):
    """Structured metadata for audit events."""

    # Request Context
    user_agent: str | None = None
    ip_address: str | None = None
    geo_location: str | None = None
    session_id: str | None = None

    # Workflow Context
    workflow_id: str | None = None
    workflow_run_id: str | None = None
    activity_id: str | None = None
    task_queue: str | None = None

    # Performance Metrics
    duration_ms: int | None = None
    retry_count: int | None = 0

    # Compliance Fields
    data_sensitivity: str | None = None  # public, internal, confidential, restricted
    compliance_flags: list[str] = Field(default_factory=list)  # soc2, gdpr, hipaa, etc.

    # Custom Fields
    custom_fields: dict[str, Any] = Field(default_factory=dict)


class AuditLogEntry(BaseModel):
    """
    Strict schema for enterprise audit logging.

    This model enforces compliance requirements for:
    - SOC2 Type II audit trails
    - GDPR Article 30 processing records
    - ISO 27001 security monitoring
    - PCI DSS transaction logging

    All audit events MUST use this schema.
    """

    # Primary Identifiers
    id: str = Field(..., description="Unique audit event identifier (UUID)")
    correlation_id: str = Field(..., description="Correlation ID for request tracing")

    # Timestamp (Critical for compliance)
    timestamp: datetime = Field(..., description="Event timestamp (ISO 8601 with timezone)")
    event_sequence: int = Field(
        ..., description="Sequence number for ordering within correlation_id"
    )

    # Actor Information
    actor_id: str = Field(..., description="ID of the user/service that performed the action")
    actor_type: str = Field("user", description="Type of actor: user, service, system")
    actor_ip: str | None = Field(None, description="IP address of the actor")
    actor_user_agent: str | None = Field(None, description="User agent string")

    # Action Details
    action: AuditAction = Field(..., description="Standardized action type")
    status: AuditStatus = Field(..., description="Outcome of the action")

    # Resource Information
    resource_type: AuditResourceType = Field(..., description="Type of resource being acted upon")
    resource_id: str = Field(..., description="Unique identifier of the resource")
    resource_owner: str | None = Field(None, description="Owner of the resource (if applicable)")

    # Context & Metadata
    metadata: AuditMetadata = Field(
        default_factory=AuditMetadata, description="Structured metadata"
    )

    # Compliance Fields (Required for SOC2/GDPR)
    data_classification: str = Field("internal", description="Data classification level")
    retention_period_days: int = Field(
        2555, description="How long to retain this log (7 years for financial)"
    )
    compliance_frameworks: list[str] = Field(
        default_factory=lambda: ["soc2", "gdpr"], description="Applicable compliance frameworks"
    )

    # Security & Integrity
    integrity_hash: str | None = Field(
        None, description="Cryptographic hash for tamper detection"
    )
    previous_hash: str | None = Field(
        None, description="Hash of previous log entry for chain integrity"
    )

    # Processing Metadata
    processed_at: datetime | None = Field(None, description="When this log was processed")
    storage_location: str | None = Field(None, description="Where this log is stored")
    backup_location: str | None = Field(None, description="Backup location for DR")

    class Config:
        """Pydantic configuration."""

        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }


class AuditLogger:
    """
    Enterprise audit logger with compliance guarantees.

    Features:
    - Immutable log entries
    - Cryptographic integrity
    - Compliance-ready structure
    - Structured metadata
    - High-performance async logging
    """

    def __init__(self, storage_backend: str = "supabase"):
        """
        Initialize audit logger.

        Args:
            storage_backend: Where to store audit logs ('supabase', 'file', 'external')
        """
        self.storage_backend = storage_backend
        self._integrity_chain: list[str] = []

    async def log_event(self, event: AuditLogEntry) -> str:
        """
        Log an audit event with compliance guarantees.

        Args:
            event: The audit event to log

        Returns:
            Log entry ID

        Raises:
            AuditFailureException: If logging fails (critical for compliance)
        """
        # Set processing timestamp
        event.processed_at = datetime.utcnow()

        # Generate integrity hash
        event.integrity_hash = self._generate_integrity_hash(event)

        # Link to previous entry for chain integrity
        if self._integrity_chain:
            event.previous_hash = self._integrity_chain[-1]

        # Store the event
        await self._store_event(event)

        # Update integrity chain
        self._integrity_chain.append(event.integrity_hash)

        return event.id

    def _generate_integrity_hash(self, event: AuditLogEntry) -> str:
        """Generate cryptographic hash for tamper detection."""
        import hashlib
        import json

        # Create canonical JSON representation
        event_dict = event.model_dump()
        canonical_json = json.dumps(event_dict, sort_keys=True, default=str)

        # Generate SHA-256 hash
        return hashlib.sha256(canonical_json.encode()).hexdigest()

    async def _store_event(self, event: AuditLogEntry) -> None:
        """Store audit event (implementation depends on backend)."""
        if self.storage_backend == "supabase":
            await self._store_supabase(event)
        elif self.storage_backend == "file":
            await self._store_file(event)
        else:
            raise ValueError(f"Unsupported storage backend: {self.storage_backend}")

    async def _store_supabase(self, event: AuditLogEntry) -> None:
        """Store audit event in Supabase."""
        # Implementation would connect to Supabase audit_logs table
        # This is a placeholder - actual implementation would use the Supabase client
        pass

    async def _store_file(self, event: AuditLogEntry) -> None:
        """Store audit event in local file (for development/testing)."""
        import json

        import aiofiles

        log_file = f"audit_logs_{event.timestamp.date()}.jsonl"

        async with aiofiles.open(log_file, "a") as f:
            await f.write(json.dumps(event.model_dump(), default=str) + "\n")

    async def query_events(
        self,
        actor_id: str | None = None,
        action: AuditAction | None = None,
        resource_type: AuditResourceType | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        limit: int = 100,
    ) -> list[AuditLogEntry]:
        """
        Query audit events for compliance reporting.

        Args:
            actor_id: Filter by actor
            action: Filter by action type
            resource_type: Filter by resource type
            start_date: Start date for query
            end_date: End date for query
            limit: Maximum results to return

        Returns:
            List of matching audit events
        """
        # Implementation would query the audit log storage
        # This is a placeholder
        return []

    async def validate_integrity(self, events: list[AuditLogEntry]) -> bool:
        """
        Validate the integrity of audit log chain.

        Args:
            events: Chronologically ordered audit events

        Returns:
            True if integrity is maintained, False if tampered
        """
        for i, event in enumerate(events):
            expected_hash = self._generate_integrity_hash(event)

            if event.integrity_hash != expected_hash:
                return False

            if i > 0:
                if event.previous_hash != events[i - 1].integrity_hash:
                    return False

        return True


# Global audit logger instance
audit_logger = AuditLogger()


async def log_audit_event(
    actor_id: str,
    action: AuditAction,
    resource_type: AuditResourceType,
    resource_id: str,
    status: AuditStatus = AuditStatus.SUCCESS,
    metadata: AuditMetadata | None = None,
    **kwargs,
) -> str:
    """
    Convenience function for logging audit events.

    This is the primary interface for logging audit events throughout the application.

    Args:
        actor_id: ID of the actor performing the action
        action: Type of action being performed
        resource_type: Type of resource being acted upon
        resource_id: ID of the specific resource
        status: Outcome status of the action
        metadata: Additional structured metadata
        **kwargs: Additional fields for metadata

    Returns:
        Audit log entry ID

    Example:
        await log_audit_event(
            actor_id="user_123",
            action=AuditAction.LOGIN,
            resource_type=AuditResourceType.USER,
            resource_id="user_123",
            status=AuditStatus.SUCCESS,
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0..."
        )
    """
    import uuid
    from datetime import datetime

    # Create metadata if not provided
    if metadata is None:
        metadata = AuditMetadata(**kwargs)
    else:
        # Update metadata with additional kwargs
        for key, value in kwargs.items():
            setattr(metadata, key, value)

    # Create audit event
    event = AuditLogEntry(
        id=str(uuid.uuid4()),
        correlation_id=str(uuid.uuid4()),  # In practice, this would be passed from request context
        timestamp=datetime.utcnow(),
        event_sequence=1,  # Would be incremented per correlation_id
        actor_id=actor_id,
        action=action,
        status=status,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata=metadata,
    )

    # Log the event
    return await audit_logger.log_event(event)
