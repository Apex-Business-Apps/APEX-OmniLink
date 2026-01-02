variable "database_name" {
  description = "Name of the Redis database"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.database_name))
    error_message = "Database name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "region" {
  description = "Upstash region (us-east-1, eu-west-1, ap-northeast-1, etc.)"
  type        = string
  default     = "us-east-1"

  validation {
    condition = contains([
      "global",
      "us-east-1",
      "us-west-1",
      "us-west-2",
      "us-central1",
      "eu-west-1",
      "eu-central-1",
      "ap-northeast-1",
      "ap-southeast-1",
      "ap-southeast-2"
    ], var.region)
    error_message = "Invalid Upstash region."
  }
}

variable "tls_enabled" {
  description = "Enable TLS for Redis connections"
  type        = bool
  default     = true
}

variable "eviction" {
  description = "Enable eviction when max memory is reached (LRU)"
  type        = bool
  default     = true
}

variable "consistent" {
  description = "Enable strong consistency (vs eventual consistency)"
  type        = bool
  default     = false  # Eventual consistency is faster and cheaper
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}
