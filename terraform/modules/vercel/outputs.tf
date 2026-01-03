output "project_id" {
  description = "Vercel project ID"
  value       = vercel_project.main.id
}

output "deployment_url" {
  description = "Vercel deployment URL"
  value       = "https://${vercel_project.main.name}.vercel.app"
}

output "custom_domain_url" {
  description = "Custom domain URL"
  value       = var.custom_domain != "" ? "https://${var.custom_domain}" : null
}
