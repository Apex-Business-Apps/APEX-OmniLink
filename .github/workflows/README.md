# GitHub Actions CI/CD Workflows

## Overview

This repository uses GitHub Actions for automated testing, building, and deployment.

## Workflows

### 1. CI/CD Pipeline (`ci-cd.yml`)

**Triggers:**
- Push to `main`, `develop`, or `staging` branches
- Pull requests to `main` or `develop`

**Jobs:**
- **Lint**: ESLint + TypeScript type checking
- **Security**: npm audit for vulnerabilities
- **Build**: Production build with artifact upload
- **Lighthouse**: Performance audit (90+ score target)
- **Deploy Production**: Auto-deploy to production (main branch only)
- **Deploy Staging**: Auto-deploy to staging (develop branch)
- **Deploy Functions**: Deploy Supabase Edge Functions

### 2. PR Checks (`pr-checks.yml`)

**Triggers:**
- Pull request opened, synchronized, or reopened

**Jobs:**
- **Validate**: Check PR title follows semantic format
- **Size Limit**: Ensure bundle size < 5MB
- **Quality**: Code quality checks, linting
- **Dependency Review**: Check for vulnerable dependencies
- **Comment**: Post build info to PR

## Required Secrets

Configure these in **Settings → Secrets and variables → Actions**:

### Supabase Secrets
```
VITE_SUPABASE_PROJECT_ID
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_URL
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_ID
```

### API Keys
```
OPENAI_API_KEY
RESEND_API_KEY
```

### Deployment Secrets (Optional)
```
VERCEL_TOKEN          # For Vercel deployment
NETLIFY_AUTH_TOKEN    # For Netlify deployment
AWS_ACCESS_KEY_ID     # For AWS S3/CloudFront
AWS_SECRET_ACCESS_KEY
```

## Branch Strategy

```
main (production)
  ← develop (staging)
    ← feature/* (development)
```

- **main**: Production-ready code, auto-deploys to production
- **develop**: Staging code, auto-deploys to staging
- **feature/***: Development branches, creates preview deployments

## PR Title Format

Use semantic commit format:

```
feat: Add new feature
fix: Fix bug in component
chore: Update dependencies
docs: Update documentation
style: Fix formatting
refactor: Refactor code
perf: Improve performance
test: Add tests
build: Update build config
ci: Update CI/CD pipeline
revert: Revert previous commit
```

## Local Testing

Test workflows locally using [act](https://github.com/nektos/act):

```bash
# Install act
brew install act  # macOS
choco install act # Windows
apt install act   # Linux

# Run workflows
act push                    # Test push workflow
act pull_request           # Test PR workflow
act -j lint                # Test specific job
```

## Deployment Setup

### Vercel

1. Install Vercel CLI: `npm install -g vercel`
2. Link project: `vercel link`
3. Get token: `vercel login`
4. Add `VERCEL_TOKEN` to GitHub Secrets
5. Uncomment Vercel deployment commands in `ci-cd.yml`

### Netlify

1. Install Netlify CLI: `npm install -g netlify-cli`
2. Link project: `netlify link`
3. Get auth token: `netlify login`
4. Add `NETLIFY_AUTH_TOKEN` to GitHub Secrets
5. Uncomment Netlify deployment commands in `ci-cd.yml`

### Custom Deployment

Replace deployment commands in `ci-cd.yml` with your custom deployment script.

## Monitoring

- **Build status**: Check Actions tab in GitHub
- **Performance**: Lighthouse reports in workflow artifacts
- **Security**: Dependency review in PR checks
- **Bundle size**: Automatically checked on PRs

## Troubleshooting

**Build failing?**
- Check Node version matches (20.x)
- Verify all secrets are configured
- Review workflow logs in Actions tab

**Deployment failing?**
- Verify deployment secrets
- Check deployment service status
- Review deployment logs

**Slow builds?**
- Enable caching (already configured)
- Reduce dependencies
- Split jobs for parallel execution

## Best Practices

1. **Always create PRs** - Don't push directly to main/develop
2. **Wait for checks** - Ensure all checks pass before merging
3. **Review Lighthouse** - Check performance metrics
4. **Monitor deployments** - Verify production deployments succeed
5. **Keep secrets updated** - Rotate API keys regularly

## Status Badges

Add to README.md:

```markdown
![CI/CD](https://github.com/Apex-Business-Apps/APEX-OmniLink/workflows/CI%2FCD%20Pipeline/badge.svg)
![PR Checks](https://github.com/Apex-Business-Apps/APEX-OmniLink/workflows/Pull%20Request%20Checks/badge.svg)
```

## Support

For issues with CI/CD:
1. Check workflow logs in Actions tab
2. Review this documentation
3. Contact DevOps team
