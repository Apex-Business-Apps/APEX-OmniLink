terraform {
  required_version = ">= 1.5.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    upstash = {
      source  = "upstash/upstash"
      version = "~> 1.0"
    }
  }

  # Backend configuration (state storage)
  # Option 1: Terraform Cloud (recommended)
  # cloud {
  #   organization = "omnihub"
  #   workspaces {
  #     name = "omnihub-staging"
  #   }
  # }

  # Option 2: S3-compatible backend (cloud-agnostic)
  backend "s3" {
    bucket  = "omnihub-terraform-state"
    key     = "staging/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true

    # For Cloudflare R2 (S3-compatible, cloud-agnostic):
    # endpoint                    = "https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
    # skip_credentials_validation = true
    # skip_region_validation      = true
    # skip_metadata_api_check     = true
  }
}

# Local variables
locals {
  environment = "staging"
  domain      = "staging.omnihub.dev"

  common_tags = {
    Project     = "OmniHub"
    Environment = local.environment
    ManagedBy   = "Terraform"
    Owner       = "DevOps"
  }
}

# Cloudflare Module (DNS, WAF, DDoS Protection)
module "cloudflare" {
  source = "../../modules/cloudflare"

  cloudflare_zone_id   = var.cloudflare_zone_id
  domain               = "omnihub.dev"  # Parent domain
  vercel_cname         = var.vercel_cname
  vercel_cname_staging = var.vercel_cname_staging

  # Security settings
  enable_waf            = true
  enable_rate_limiting  = true
  rate_limit_threshold  = 100  # 100 requests/minute for staging
  rate_limit_mode       = "simulate"  # Start with simulate, then switch to "ban" after testing

  environment = local.environment
  alert_email = var.alert_email
}

# Upstash Redis Module (Distributed Cache, Rate Limiting, Session Storage)
module "upstash" {
  source = "../../modules/upstash"

  database_name = "omnihub-${local.environment}"
  region        = var.upstash_region

  # Configuration
  tls_enabled = true
  eviction    = true
  consistent  = false  # Eventual consistency for better performance

  environment = local.environment
}

# Outputs (for use in application deployment)
output "cloudflare_zone_id" {
  value       = module.cloudflare.zone_id
  description = "Cloudflare Zone ID"
}

output "dns_records" {
  value       = module.cloudflare.dns_records
  description = "DNS records created"
}

output "redis_url" {
  value       = module.upstash.redis_url
  description = "Redis connection URL (for application)"
  sensitive   = true
}

output "redis_endpoint" {
  value       = module.upstash.redis_endpoint
  description = "Redis endpoint"
}

output "redis_rest_url" {
  value       = module.upstash.redis_rest_url
  description = "Redis REST API URL (for serverless)"
  sensitive   = true
}

# Environment summary
output "environment_summary" {
  value = {
    environment = local.environment
    domain      = local.domain
    region      = var.upstash_region
    waf_enabled = module.cloudflare.waf_enabled
    rate_limiting_enabled = module.cloudflare.rate_limiting_enabled
  }
  description = "Staging environment summary"
}
