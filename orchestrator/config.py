"""
Configuration management for APEX Orchestrator.

Uses pydantic-settings for type-safe environment variable loading.
"""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    Priority:
    1. Environment variables
    2. .env file
    3. Default values
    """

    # Temporal Configuration
    temporal_host: str = Field(default="localhost:7233", description="Temporal server host")
    temporal_namespace: str = Field(default="default", description="Temporal namespace")
    temporal_task_queue: str = Field(
        default="apex-orchestrator", description="Temporal task queue name"
    )

    # Redis Configuration
    redis_url: str = Field(default="redis://localhost:6379", description="Redis connection URL")
    redis_password: str = Field(default="", description="Redis password")
    redis_ssl: bool = Field(default=False, description="Use SSL for Redis")

    # Supabase Configuration
    supabase_url: str = Field(..., description="Supabase project URL")
    supabase_service_role_key: str = Field(..., description="Supabase service role key")
    supabase_db_url: str = Field(..., description="Direct Supabase PostgreSQL URL")

    # LLM Configuration
    openai_api_key: str = Field(default="", description="OpenAI API key")
    anthropic_api_key: str = Field(default="", description="Anthropic API key")
    default_llm_model: str = Field(default="gpt-4-turbo-preview", description="Default LLM model")
    default_llm_temperature: float = Field(default=0.0, description="LLM temperature")

    # Semantic Cache Configuration
    cache_embedding_model: str = Field(
        default="all-MiniLM-L6-v2", description="Sentence-transformers model"
    )
    cache_similarity_threshold: float = Field(
        default=0.85, description="Minimum similarity for cache hit"
    )
    cache_ttl_seconds: int = Field(default=86400, description="Cache TTL (24h default)")

    # Application Configuration
    log_level: str = Field(default="INFO", description="Logging level")
    environment: str = Field(default="development", description="Environment name")
    enable_distributed_locks: bool = Field(default=True, description="Enable distributed locking")
    max_workflow_history_size: int = Field(
        default=1000, description="Max events before continue-as-new"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


# Global settings instance
settings = Settings()
