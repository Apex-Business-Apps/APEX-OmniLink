variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for the domain"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Primary domain name (e.g., omnihub.dev)"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9.-]+\\.[a-z]{2,}$", var.domain))
    error_message = "Domain must be a valid domain name (e.g., example.com)."
  }
}

variable "vercel_cname" {
  description = "Vercel CNAME target for production (e.g., cname.vercel-dns.com)"
  type        = string
  default     = "cname.vercel-dns.com"
}

variable "vercel_cname_staging" {
  description = "Vercel CNAME target for staging"
  type        = string
  default     = "cname.vercel-dns.com"
}

variable "enable_waf" {
  description = "Enable Web Application Firewall"
  type        = bool
  default     = true
}

variable "enable_rate_limiting" {
  description = "Enable rate limiting for API endpoints"
  type        = bool
  default     = true
}

variable "rate_limit_threshold" {
  description = "Rate limit threshold (requests per minute)"
  type        = number
  default     = 100

  validation {
    condition     = var.rate_limit_threshold > 0 && var.rate_limit_threshold <= 10000
    error_message = "Rate limit threshold must be between 1 and 10000."
  }
}

variable "rate_limit_mode" {
  description = "Rate limit action mode (simulate, ban, challenge)"
  type        = string
  default     = "ban"

  validation {
    condition     = contains(["simulate", "ban", "challenge"], var.rate_limit_mode)
    error_message = "Rate limit mode must be one of: simulate, ban, challenge."
  }
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}

variable "alert_email" {
  description = "Email address for health check alerts (optional)"
  type        = string
  default     = ""
}
