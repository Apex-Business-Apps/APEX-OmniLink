# Provider credentials
variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID"
  type        = string
}

variable "upstash_email" {
  description = "Upstash account email"
  type        = string
}

variable "upstash_api_key" {
  description = "Upstash API key"
  type        = string
  sensitive   = true
}

variable "vercel_token" {
  description = "Vercel API token"
  type        = string
  sensitive   = true
}

# Application configuration
variable "github_repo" {
  description = "GitHub repository (owner/repo)"
  type        = string
}

# Environment variables
variable "vite_supabase_url" {
  description = "Supabase URL"
  type        = string
}

variable "vite_supabase_publishable_key" {
  description = "Supabase publishable key"
  type        = string
  sensitive   = true
}

variable "vite_sentry_dsn" {
  description = "Sentry DSN"
  type        = string
  sensitive   = true
}

variable "vite_datadog_application_id" {
  description = "Datadog application ID"
  type        = string
}

variable "vite_datadog_client_token" {
  description = "Datadog client token"
  type        = string
  sensitive   = true
}
