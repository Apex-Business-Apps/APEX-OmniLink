# OmniHub Terraform Infrastructure

**Purpose:** Infrastructure as Code for OmniHub/TradeLine/APEX

**Cloud-Agnostic Principle:** All modules designed with provider abstraction - swap providers via configuration only.

---

## Directory Structure

```
terraform/
├── modules/                  # Reusable infrastructure modules
│   ├── cloudflare/          # DNS, WAF, DDoS protection
│   ├── upstash/             # Serverless Redis
│   ├── vercel/              # Frontend hosting configuration
│   └── observability/       # Datadog dashboards, monitors
├── environments/            # Environment-specific configurations
│   ├── dev/
│   ├── staging/
│   └── production/
└── README.md               # This file
```

---

## Prerequisites

1. **Terraform:** Version >= 1.5.0
2. **Provider Credentials:**
   - Cloudflare API Token (with DNS + WAF permissions)
   - Upstash API Key
   - Vercel Token
   - Datadog API Key + App Key

3. **Environment Variables:**
```bash
export CLOUDFLARE_API_TOKEN="your_cloudflare_token"
export UPSTASH_EMAIL="your_upstash_email"
export UPSTASH_API_KEY="your_upstash_api_key"
export VERCEL_API_TOKEN="your_vercel_token"
export DATADOG_API_KEY="your_datadog_api_key"
export DATADOG_APP_KEY="your_datadog_app_key"
```

---

## Quick Start

### Deploy Staging Environment

```bash
cd terraform/environments/staging
terraform init
terraform plan
terraform apply
```

### Deploy Production Environment (Requires Approval)

```bash
cd terraform/environments/production
terraform init
terraform plan -out=tfplan

# Review plan with team
terraform show tfplan

# Apply after approval
terraform apply tfplan
```

---

## Module Usage

### Cloudflare Module

**Purpose:** DNS management, WAF, DDoS protection, rate limiting

```hcl
module "cloudflare" {
  source = "../../modules/cloudflare"

  domain            = "omnihub.dev"
  cloudflare_zone_id = var.cloudflare_zone_id

  # DNS records
  vercel_cname = "cname.vercel-dns.com"

  # WAF rules
  enable_waf        = true
  enable_rate_limiting = true
  rate_limit_threshold = 100  # requests per minute
}
```

### Upstash Module

**Purpose:** Serverless Redis for rate limiting, session storage, caching

```hcl
module "upstash" {
  source = "../../modules/upstash"

  database_name = "omnihub-${var.environment}"
  region        = "us-east-1"

  # Redis configuration
  eviction      = true
  tls_enabled   = true
}
```

---

## Environment Variables

### Required Secrets

Store these in your secrets manager (Vault, Doppler) or GitHub Secrets:

```bash
# Cloudflare
CLOUDFLARE_API_TOKEN=""
CLOUDFLARE_ZONE_ID=""

# Upstash
UPSTASH_EMAIL=""
UPSTASH_API_KEY=""

# Vercel
VERCEL_API_TOKEN=""
VERCEL_ORG_ID=""
VERCEL_PROJECT_ID=""

# Datadog
DATADOG_API_KEY=""
DATADOG_APP_KEY=""

# Supabase (for reference, not managed by Terraform yet)
SUPABASE_ACCESS_TOKEN=""
SUPABASE_ORG_ID=""
```

---

## State Management

**Backend:** Terraform Cloud (recommended) or S3-compatible storage

**Terraform Cloud Setup:**

```hcl
# terraform/backend.tf
terraform {
  cloud {
    organization = "omnihub"

    workspaces {
      tags = ["omnihub", "staging"]
    }
  }
}
```

**Alternative: S3 Backend (Cloud-Agnostic)**

```hcl
terraform {
  backend "s3" {
    bucket         = "omnihub-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-lock"
  }
}
```

**For multi-cloud portability, use Cloudflare R2 (S3-compatible):**

```hcl
terraform {
  backend "s3" {
    bucket   = "omnihub-terraform-state"
    key      = "staging/terraform.tfstate"
    region   = "auto"
    endpoint = "https://<ACCOUNT_ID>.r2.cloudflarestorage.com"

    skip_credentials_validation = true
    skip_region_validation      = true
    skip_metadata_api_check     = true
  }
}
```

---

## Best Practices

### 1. Always Run Plan Before Apply

```bash
terraform plan -out=tfplan
terraform apply tfplan
```

### 2. Use Variables for Environment-Specific Values

```hcl
variable "environment" {
  description = "Environment name"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}
```

### 3. Tag All Resources

```hcl
locals {
  common_tags = {
    Project     = "OmniHub"
    Environment = var.environment
    ManagedBy   = "Terraform"
    Owner       = "DevOps"
  }
}
```

### 4. Use Modules for Reusability

Don't repeat yourself - extract common patterns into modules.

### 5. Lock Provider Versions

```hcl
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
}
```

---

## Disaster Recovery

### Backup Terraform State

```bash
# Download current state
terraform state pull > terraform.tfstate.backup

# Upload to secure location
aws s3 cp terraform.tfstate.backup s3://omnihub-backups/terraform/
```

### Restore from Backup

```bash
# Download backup
aws s3 cp s3://omnihub-backups/terraform/terraform.tfstate.backup ./

# Push to Terraform backend
terraform state push terraform.tfstate.backup
```

---

## Troubleshooting

### Terraform State Lock Issues

```bash
# Force unlock (use with caution)
terraform force-unlock <LOCK_ID>
```

### Provider Authentication Errors

```bash
# Verify environment variables are set
env | grep CLOUDFLARE
env | grep UPSTASH

# Test provider credentials
terraform providers
```

### Drift Detection

```bash
# Check if actual infrastructure matches Terraform state
terraform plan -refresh-only
```

---

## Contributing

1. Create feature branch: `git checkout -b infra/add-new-module`
2. Make changes to Terraform code
3. Run `terraform fmt` to format code
4. Run `terraform validate` to check syntax
5. Test in dev environment first
6. Create PR with Terraform plan output
7. After approval, apply to staging
8. After staging validation, apply to production (requires separate approval)

---

## Security

### Secrets Management

**DO NOT** commit secrets to Git:
- Use environment variables
- Use Terraform Cloud variables
- Use external secrets manager (Vault, Doppler)

**Check for leaked secrets:**

```bash
# Scan for secrets in Git history
git secrets --scan-history

# Or use TruffleHog
trufflehog git file://. --only-verified
```

### State File Security

- State files contain sensitive data (connection strings, API keys)
- Always encrypt state files at rest
- Use remote backend with access controls
- Enable state locking to prevent concurrent modifications

---

## Next Steps

1. Set up Terraform Cloud workspace (or S3 backend)
2. Configure provider credentials
3. Deploy dev environment
4. Deploy staging environment
5. Test disaster recovery procedures
6. Get approval for production deployment

---

**Document Status:** ✅ Complete
**Maintained By:** DevOps Team
