output "nameservers" {
  description = "Cloudflare nameservers"
  value       = data.cloudflare_zone.main.name_servers
}

output "zone_id" {
  description = "Cloudflare Zone ID"
  value       = var.zone_id
}

output "waf_ruleset_id" {
  description = "WAF ruleset ID"
  value       = cloudflare_ruleset.waf.id
}

data "cloudflare_zone" "main" {
  zone_id = var.zone_id
}
