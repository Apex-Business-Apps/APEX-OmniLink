# UPSTASH REDIS MODULE
# Serverless Redis for rate limiting and caching

terraform {
  required_providers {
    upstash = {
      source  = "upstash/upstash"
      version = "~> 1.0"
    }
  }
}

resource "upstash_redis_database" "main" {
  database_name = var.database_name
  region        = var.region
  tls           = true
  eviction      = var.eviction_policy
  
  # Multi-zone replication for production
  multi_zone = var.multi_zone
}

# Optional: QStash for message queue
resource "upstash_qstash_endpoint" "webhook" {
  count = var.enable_qstash ? 1 : 0
  
  name = "${var.database_name}-webhook"
  url  = var.webhook_url
}
