variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for omnihub.dev"
  type        = string
  sensitive   = true
}

variable "vercel_cname" {
  description = "Vercel CNAME target for production"
  type        = string
  default     = "cname.vercel-dns.com"
}

variable "vercel_cname_staging" {
  description = "Vercel CNAME target for staging"
  type        = string
  default     = "cname.vercel-dns.com"
}

variable "upstash_region" {
  description = "Upstash Redis region"
  type        = string
  default     = "us-east-1"
}

variable "alert_email" {
  description = "Email for Cloudflare health check alerts"
  type        = string
  default     = "devops@omnihub.dev"
}
