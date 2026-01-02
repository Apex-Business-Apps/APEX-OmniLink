terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

# DNS Records
resource "cloudflare_record" "apex" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  value   = var.vercel_cname
  type    = "CNAME"
  proxied = true  # Enable Cloudflare proxy (WAF, DDoS protection, CDN)
  comment = "OmniHub production frontend (Vercel)"
}

resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  value   = var.vercel_cname
  type    = "CNAME"
  proxied = true
  comment = "OmniHub www subdomain"
}

resource "cloudflare_record" "staging" {
  zone_id = var.cloudflare_zone_id
  name    = "staging"
  value   = var.vercel_cname_staging
  type    = "CNAME"
  proxied = true
  comment = "OmniHub staging environment"
}

# WAF (Web Application Firewall)
resource "cloudflare_ruleset" "waf" {
  zone_id     = var.cloudflare_zone_id
  name        = "OmniHub WAF"
  description = "Web Application Firewall for OmniHub - OWASP protection + custom rules"
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  # OWASP Core Rule Set
  rules {
    action      = "block"
    expression  = "(cf.waf.score > 50)"
    description = "Block high-threat-score requests (OWASP)"
    enabled     = var.enable_waf
  }

  # SQL Injection Protection
  rules {
    action      = "block"
    expression  = "(cf.waf.score.sqli > 20)"
    description = "Block SQL injection attempts"
    enabled     = var.enable_waf
  }

  # XSS Protection
  rules {
    action      = "block"
    expression  = "(cf.waf.score.xss > 20)"
    description = "Block XSS attempts"
    enabled     = var.enable_waf
  }

  # Bot Detection (challenge suspected bots)
  rules {
    action      = "challenge"
    expression  = "(cf.bot_management.score < 30)"
    description = "Challenge low-score bots"
    enabled     = var.enable_waf
  }

  # Block known bad actors
  rules {
    action      = "block"
    expression  = "(cf.threat_score > 50)"
    description = "Block known malicious IPs"
    enabled     = var.enable_waf
  }
}

# Rate Limiting (Distributed, API Gateway Protection)
resource "cloudflare_rate_limit" "api_gateway" {
  zone_id   = var.cloudflare_zone_id
  threshold = var.rate_limit_threshold
  period    = 60  # 60 seconds window

  match {
    request {
      url_pattern = "*/functions/v1/*"  # Supabase Edge Functions
    }
  }

  action {
    mode    = var.rate_limit_mode  # "simulate", "ban", "challenge"
    timeout = 60                    # Ban duration in seconds
  }

  description = "API Gateway rate limiting - ${var.rate_limit_threshold} requests per minute"
  disabled    = !var.enable_rate_limiting
}

# Rate Limiting for Web3 Endpoints (stricter)
resource "cloudflare_rate_limit" "web3_endpoints" {
  zone_id   = var.cloudflare_zone_id
  threshold = 30  # 30 requests per minute for Web3 operations
  period    = 60

  match {
    request {
      url_pattern = "*/functions/v1/web3-*"  # Web3-specific functions
    }
  }

  action {
    mode    = "ban"
    timeout = 300  # 5-minute ban for Web3 abuse
  }

  description = "Web3 endpoint rate limiting (stricter)"
  disabled    = !var.enable_rate_limiting
}

# DDoS Protection Settings
resource "cloudflare_zone_settings_override" "omnihub_security" {
  zone_id = var.cloudflare_zone_id

  settings {
    # TLS Configuration
    tls_1_3                  = "on"
    automatic_https_rewrites = "on"
    ssl                      = "strict"  # Full (strict) TLS
    min_tls_version          = "1.2"
    always_use_https         = "on"

    # HTTP/2 & HTTP/3
    http2 = "on"
    http3 = "on"

    # Security Headers
    security_header {
      enabled            = true
      preload            = true
      max_age            = 31536000  # 1 year
      include_subdomains = true
      nosniff            = true
    }

    # DDoS Protection
    challenge_ttl = 1800  # 30 minutes

    # Browser Integrity Check
    browser_check = "on"

    # Hotlink Protection
    hotlink_protection = "on"

    # IP Geolocation (for analytics)
    ip_geolocation = "on"

    # Cache Settings
    browser_cache_ttl        = 14400  # 4 hours
    cache_level              = "aggressive"
    development_mode         = var.environment == "dev" ? "on" : "off"
  }
}

# Page Rules (Caching + Performance)
resource "cloudflare_page_rule" "api_bypass_cache" {
  zone_id = var.cloudflare_zone_id
  target  = "${var.domain}/functions/v1/*"
  priority = 1

  actions {
    cache_level = "bypass"  # Never cache API responses
  }
}

resource "cloudflare_page_rule" "static_assets_cache" {
  zone_id = var.cloudflare_zone_id
  target  = "${var.domain}/assets/*"
  priority = 2

  actions {
    cache_level         = "cache_everything"
    edge_cache_ttl      = 2592000  # 30 days
    browser_cache_ttl   = 86400    # 1 day
  }
}

# Firewall Rules (Custom)
resource "cloudflare_filter" "block_suspicious_user_agents" {
  count = var.enable_waf ? 1 : 0

  zone_id     = var.cloudflare_zone_id
  description = "Block suspicious user agents"
  expression  = "(http.user_agent contains \"curl\" and not http.user_agent contains \"Uptime-Kuma\") or (http.user_agent contains \"wget\")"
}

resource "cloudflare_firewall_rule" "block_suspicious_user_agents" {
  count = var.enable_waf ? 1 : 0

  zone_id     = var.cloudflare_zone_id
  description = "Block suspicious user agents (but allow monitoring tools)"
  filter_id   = cloudflare_filter.block_suspicious_user_agents[0].id
  action      = "block"
}

# Health Check (Monitoring)
resource "cloudflare_healthcheck" "api_health" {
  zone_id = var.cloudflare_zone_id
  name    = "OmniHub API Health Check"
  address = var.domain
  path    = "/health"
  port    = 443
  type    = "HTTPS"

  check_regions = [
    "WNAM",  # Western North America
    "ENAM",  # Eastern North America
    "WEU",   # Western Europe
    "EEU",   # Eastern Europe
    "SEAS",  # Southeast Asia
  ]

  interval          = 60   # Check every 60 seconds
  retries           = 2
  timeout           = 5
  consecutive_fails = 2
  consecutive_successes = 2

  description = "Health check for OmniHub API Gateway"
}

# Notifications (Alert on health check failure)
resource "cloudflare_notification_policy" "health_check_alert" {
  count = var.alert_email != "" ? 1 : 0

  name        = "OmniHub Health Check Failure"
  description = "Alert when health check fails"
  enabled     = true
  alert_type  = "health_check_status_notification"

  email_integration {
    id   = var.alert_email
    name = "DevOps Team"
  }

  filters {
    health_check_id = [cloudflare_healthcheck.api_health.id]
  }
}

# Outputs
output "zone_id" {
  value       = var.cloudflare_zone_id
  description = "Cloudflare Zone ID"
}

output "dns_records" {
  value = {
    apex    = cloudflare_record.apex.hostname
    www     = cloudflare_record.www.hostname
    staging = cloudflare_record.staging.hostname
  }
  description = "DNS records created"
}

output "waf_enabled" {
  value       = var.enable_waf
  description = "WAF status"
}

output "rate_limiting_enabled" {
  value       = var.enable_rate_limiting
  description = "Rate limiting status"
}
