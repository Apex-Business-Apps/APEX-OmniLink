# Changelog

All notable changes to the APEX OmniHub Marketing Site.

## [1.1.0] - 2026-01-15

### Added
- Visual regression tests with Playwright (`npm run test:visual`)
- Theme toggle tests for White Fortress / Night Watch

### Changed
- Hero tagline updated to "It Sees You" (title case)
- Hero subtitle updated to "Welcome to the future of workflow automation and business intelligence."
- Feature highlights now display: AI-Powered Automation, Smart Integrations, Advanced Analytics
- Showcase section title updated to "Experience APEX OmniHub Today"

### Removed
- `ReferenceOverlay.tsx` - Development-only overlay tool (security hotspot)
- `FeatureCard.tsx` - Unused component
- `ShowcaseCard.tsx` - Unused component
- `IntegrationGrid.tsx` - Unused component
- Development reference images from `public/reference/`
- CSS classes for removed components

### Fixed
- SonarCloud security hotspot (window.location.search usage)
- Code duplication reduced from 28.2% to <3%

## [1.0.0] - 2026-01-14

### Added
- Initial release with White Fortress and Night Watch themes
- 5-page static MPA architecture
- Anti-abuse protection (honeypot, timing, rate limiting)
- Security headers (A+ grade)
- Supabase integration (optional)
- Smoke tests for content verification
