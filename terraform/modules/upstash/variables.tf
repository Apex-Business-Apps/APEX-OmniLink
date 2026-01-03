variable "database_name" {
  description = "Name of the Redis database"
  type        = string
}

variable "region" {
  description = "AWS region for Redis deployment"
  type        = string
  default     = "us-east-1"
}

variable "eviction_policy" {
  description = "Eviction policy (noeviction, allkeys-lru, volatile-lru)"
  type        = string
  default     = "allkeys-lru"
}

variable "multi_zone" {
  description = "Enable multi-zone replication (production only)"
  type        = bool
  default     = false
}

variable "enable_qstash" {
  description = "Enable QStash message queue"
  type        = bool
  default     = false
}

variable "webhook_url" {
  description = "Webhook URL for QStash"
  type        = string
  default     = ""
}
