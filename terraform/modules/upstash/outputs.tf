output "redis_url" {
  description = "Redis connection URL"
  value       = upstash_redis_database.main.endpoint
  sensitive   = true
}

output "redis_token" {
  description = "Redis authentication token"
  value       = upstash_redis_database.main.rest_token
  sensitive   = true
}

output "database_id" {
  description = "Database ID"
  value       = upstash_redis_database.main.database_id
}

output "qstash_endpoint_id" {
  description = "QStash endpoint ID"
  value       = var.enable_qstash ? upstash_qstash_endpoint.webhook[0].id : null
}
