variable "zone_id" {
  description = "Cloudflare Zone ID"
  type        = string
}

variable "domain" {
  description = "Domain name (e.g., omnihub.dev)"
  type        = string
}

variable "vercel_cname" {
  description = "Vercel CNAME target (e.g., cname.vercel-dns.com)"
  type        = string
  default     = "cname.vercel-dns.com"
}

variable "rate_limit_threshold" {
  description = "Rate limit threshold (requests per minute)"
  type        = number
  default     = 100
}

variable "security_level" {
  description = "Security level (off, essentially_off, low, medium, high, under_attack)"
  type        = string
  default     = "medium"
}
