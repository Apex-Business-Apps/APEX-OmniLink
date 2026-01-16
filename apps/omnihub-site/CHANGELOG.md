# Changelog

All notable changes to the APEX OmniHub Marketing Site.

## [1.2.0] - 2026-01-15

### Added
- **Tri-Force Protocol section** - Connect, Translate, Execute pillars with linked cards
- **Orchestrator section** - Central coordination capabilities with animated visual
- **Zero-Trust Fortress Protocol section** - Security principles in navy variant
- **MAN Mode section** - Manual Authorization Needed with warning iconography
- **Core Capabilities showcase** - Four capability cards linking to page anchors
- **Privacy Policy page** (`/privacy.html`) - Full legal content
- **Terms of Service page** (`/terms.html`) - Full legal content
- **Burger menu navigation** - Mobile-friendly drawer with all navigation links
- **Reference overlay mode** - Dev tool for pixel-perfect alignment (`?ref=light` or `?ref=night`)
- Enhanced hero section with:
  - Deep navy gradient with starfield and sweeping arcs (Night Watch)
  - Airy white/pale blue gradient with subtle arcs (White Fortress)
  - Cyan/blue highlight on "IT SEES YOU" in Night Watch theme
  - Proof microline: "DIRECTABLE, ACCOUNTABLE, DEPENDABLE"
  - Extended description about OmniHub as universal translator/orchestrator

### Changed
- Navigation simplified: removed desktop link row, added burger menu for all screen sizes
- Auth button: single "Log in" / "Log out" button replaces redundant "Get Started" in header
- Hero visual now includes glow effect behind the central hub image
- Showcase cards replaced with capability cards linking to page sections
- Footer links now properly route to `/privacy.html` and `/terms.html`
- Tailwind config updated to include all HTML entry files

### Fixed
- ESLint errors for setState in useEffect (refactored to initial state functions)
- All navigation links now scroll to valid anchors or route to existing pages
- No more 404s for Privacy/Terms pages

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
