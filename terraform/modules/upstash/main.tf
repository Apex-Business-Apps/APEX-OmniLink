terraform {
  required_providers {
    upstash = {
      source  = "upstash/upstash"
      version = "~> 1.0"
    }
  }
}

# Upstash Redis Database (Serverless Redis)
resource "upstash_redis_database" "main" {
  database_name = var.database_name
  region        = var.region
  tls           = var.tls_enabled

  # Multi-zone replication (for production)
  multi_zone = var.environment == "production"

  # Eviction policy (when max memory reached)
  eviction = var.eviction

  # Pricing tier
  # - Free tier: 10,000 commands/day
  # - Pay-as-you-go: $0.2 per 100K commands
  consistent = var.consistent  # true = strong consistency, false = eventual consistency
}

# Store connection details in output (to be consumed by application)
locals {
  redis_url = "redis://default:${upstash_redis_database.main.password}@${upstash_redis_database.main.endpoint}:${upstash_redis_database.main.port}"
}

# Outputs
output "redis_endpoint" {
  value       = upstash_redis_database.main.endpoint
  description = "Redis endpoint (host)"
}

output "redis_port" {
  value       = upstash_redis_database.main.port
  description = "Redis port"
}

output "redis_password" {
  value       = upstash_redis_database.main.password
  description = "Redis password"
  sensitive   = true
}

output "redis_url" {
  value       = local.redis_url
  description = "Redis connection URL"
  sensitive   = true
}

output "redis_rest_url" {
  value       = upstash_redis_database.main.rest_token
  description = "Redis REST API URL (for serverless environments)"
  sensitive   = true
}

output "database_id" {
  value       = upstash_redis_database.main.database_id
  description = "Upstash database ID"
}

output "region" {
  value       = upstash_redis_database.main.region
  description = "Redis region"
}

output "max_clients" {
  value       = upstash_redis_database.main.max_clients
  description = "Maximum number of concurrent clients"
}

output "max_commands_per_second" {
  value       = upstash_redis_database.main.max_commands_per_second
  description = "Maximum commands per second (rate limit)"
}
