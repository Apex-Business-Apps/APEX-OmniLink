variable "project_name" {
  description = "Vercel project name"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository (owner/repo)"
  type        = string
}

variable "environment" {
  description = "Environment (production, preview, development)"
  type        = string
  default     = "production"
}

variable "env_vars" {
  description = "Environment variables"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "custom_domain" {
  description = "Custom domain for deployment"
  type        = string
  default     = ""
}
