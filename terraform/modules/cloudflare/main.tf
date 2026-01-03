# CLOUDFLARE MODULE
# Manages DNS, WAF, and DDoS protection for OmniHub

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

# DNS Records
resource "cloudflare_record" "root" {
  zone_id = var.zone_id
  name    = "@"
  value   = var.vercel_cname
  type    = "CNAME"
  proxied = true
  comment = "Root domain pointing to Vercel"
}

resource "cloudflare_record" "www" {
  zone_id = var.zone_id
  name    = "www"
  value   = var.vercel_cname
  type    = "CNAME"
  proxied = true
  comment = "WWW subdomain pointing to Vercel"
}

# WAF Rules (OWASP Top 10 Protection)
resource "cloudflare_ruleset" "waf" {
  zone_id     = var.zone_id
  name        = "OmniHub WAF Rules"
  description = "Web Application Firewall rules for OmniHub"
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  rules {
    action = "block"
    expression = "(cf.threat_score > 14)"
    description = "Block high threat score"
  }

  rules {
    action = "challenge"
    expression = "(cf.threat_score > 5)"
    description = "Challenge medium threat score"
  }
}

# Rate Limiting
resource "cloudflare_rate_limit" "api" {
  zone_id   = var.zone_id
  threshold = var.rate_limit_threshold
  period    = 60
  match {
    request {
      url_pattern = "${var.domain}/api/*"
    }
  }
  action {
    mode    = "challenge"
    timeout = 86400
  }
}

# Page Rules
resource "cloudflare_page_rule" "cache_static" {
  zone_id  = var.zone_id
  target   = "${var.domain}/assets/*"
  priority = 1

  actions {
    cache_level         = "cache_everything"
    edge_cache_ttl      = 7200
    browser_cache_ttl   = 14400
  }
}

resource "cloudflare_page_rule" "security_headers" {
  zone_id  = var.zone_id
  target   = "${var.domain}/*"
  priority = 2

  actions {
    security_level = var.security_level
  }
}
