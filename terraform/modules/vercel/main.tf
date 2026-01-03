# VERCEL MODULE
# Frontend deployment and configuration

terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.0"
    }
  }
}

resource "vercel_project" "main" {
  name      = var.project_name
  framework = "vite"
  
  git_repository {
    type = "github"
    repo = var.github_repo
  }

  # Build settings
  build_command    = "npm run build"
  output_directory = "dist"
  install_command  = "npm install"
}

# Environment variables (synced from Doppler)
resource "vercel_project_environment_variable" "env_vars" {
  for_each = var.env_vars

  project_id = vercel_project.main.id
  key        = each.key
  value      = each.value
  target     = [var.environment]
}

# Custom domain
resource "vercel_project_domain" "main" {
  count = var.custom_domain != "" ? 1 : 0

  project_id = vercel_project.main.id
  domain     = var.custom_domain
}

# Deployment protection (production only)
resource "vercel_project_deployment_retention" "main" {
  project_id = vercel_project.main.id
  
  # Keep last 30 deployments
  expiration = 2592000 # 30 days in seconds
}
