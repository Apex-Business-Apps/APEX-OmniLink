# OMNILINK-APEX OPS RUNBOOK

**Version:** 1.0
**Last Updated:** December 21, 2025
**System:** OmniLink Agentic RAG with Ops Pack

## Overview

This runbook provides operational procedures for the OmniLink Agentic RAG system with complete Ops Pack instrumentation, evaluation, and governance capabilities.

## System Architecture

### Core Components
- **omnilink-agent**: Main agent runtime with dynamic skill loading
- **omnilink-eval**: Automated evaluation system
- **Database**: PostgreSQL with pgvector and telemetry tables
- **Telemetry**: Comprehensive observability and performance tracking

### Ops Pack Features
- **Telemetry Tables**: agent_runs, skill_matches, tool_invocations
- **Evaluation System**: eval_cases, eval_results with automated scoring
- **Governance**: Version control, activation flags, tenant scoping
- **Performance Tuning**: HNSW ef_search parameter support

## Deployment Procedures

### Initial Deployment

1. **Database Migration**
   ```bash
   supabase db reset
   # This applies all migrations including the Ops Pack
   ```

2. **Edge Functions**
   ```bash
   supabase functions deploy omnilink-agent
   supabase functions deploy omnilink-eval
   ```

3. **Environment Variables**
   ```bash
   # Required for Supabase AI and service operations
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

### Rollback Procedures

#### Emergency Rollback (Complete System)
```bash
# Disable all agent functions
supabase functions delete omnilink-agent
supabase functions delete omnilink-eval

# Revert database to previous migration
supabase db reset --linked
```

#### Selective Rollback (Ops Pack Only)
```sql
-- Disable telemetry collection
UPDATE agent_skills SET is_active = false WHERE name = 'telemetry-dependent-skills';

-- Mark evaluation system as inactive
UPDATE eval_cases SET is_active = false;
```

## Monitoring & Observability

### Key Metrics to Monitor

#### Agent Performance
```sql
-- Average response time
SELECT AVG(total_duration_ms) as avg_response_time
FROM agent_runs
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Success rate
SELECT
  COUNT(*) as total_runs,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_runs,
  ROUND(
    COUNT(CASE WHEN status = 'completed' THEN 1 END)::decimal /
    COUNT(*)::decimal * 100, 2
  ) as success_rate
FROM agent_runs
WHERE created_at > NOW() - INTERVAL '24 hours';
```

#### Skill Usage Analytics
```sql
-- Most used skills
SELECT
  skill_name,
  COUNT(*) as usage_count,
  AVG(score) as avg_score
FROM skill_matches
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY skill_name
ORDER BY usage_count DESC;
```

#### Tool Performance
```sql
-- Tool execution success rates
SELECT
  tool_name,
  COUNT(*) as total_invocations,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
  AVG(duration_ms) as avg_duration
FROM tool_invocations
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY tool_name;
```

### Alerting Thresholds

- **Agent Success Rate**: < 95% → Alert
- **Average Response Time**: > 5000ms → Alert
- **Tool Failure Rate**: > 10% → Alert
- **Evaluation Score**: < 80% → Alert

## Evaluation System

### Running Evaluations

#### Single Evaluation Case
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/omnilink-eval" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-service-key" \
  -d '{"eval_case_id": "your-case-id"}'
```

#### All Active Evaluations
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/omnilink-eval" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-service-key" \
  -d '{"run_all_active": true}'
```

#### Custom Evaluation
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/omnilink-eval" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-service-key" \
  -d '{"custom_message": "What is my credit score?"}'
```

### Evaluation Results Analysis

```sql
-- Recent evaluation summary
SELECT
  eval_case_id,
  COUNT(*) as total_runs,
  AVG(score) as avg_score,
  MIN(score) as min_score,
  MAX(score) as max_score,
  AVG(performance_ms) as avg_performance
FROM eval_results
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY eval_case_id
ORDER BY avg_score DESC;
```

## Skill Management

### Adding New Skills

1. **Register Skill**
```sql
INSERT INTO agent_skills (
  name, description, tool_definition, embedding, version, is_active
) VALUES (
  'NewSkill',
  'Description of new skill',
  '{"type":"object","properties":{}}'::jsonb,
  '[embedding_vector]'::vector,
  '1.0',
  true
);
```

2. **Update Governance**
```sql
UPDATE agent_skills
SET
  requires_strong_auth = true,
  tenant_scope = '{"allowed_tenants": ["tenant1", "tenant2"]}'::jsonb
WHERE name = 'NewSkill';
```

### Skill Governance

```sql
-- View active skills by version
SELECT name, version, is_active, deprecated_at
FROM agent_skills
WHERE is_active = true
ORDER BY name, version DESC;

-- Deprecate old skill versions
UPDATE agent_skills
SET is_active = false, deprecated_at = NOW()
WHERE name = 'OldSkill' AND version < '2.0';
```

## Performance Tuning

### HNSW Index Optimization

```sql
-- Tune ef_search for specific queries
SELECT match_skills(
  '[query_embedding]'::vector,
  'search query',
  0.1,  -- threshold
  5,    -- count
  100   -- ef_search (higher = more accurate but slower)
);
```

### Query Performance Monitoring

```sql
-- Slow queries analysis
SELECT
  query,
  AVG(final_score) as avg_score,
  COUNT(*) as query_count,
  AVG(embedding_distance) as avg_distance
FROM skill_matches
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY query
HAVING COUNT(*) > 5
ORDER BY avg_score DESC;
```

## Troubleshooting

### Common Issues

#### Agent Not Responding
```bash
# Check agent runs
SELECT status, error_message, created_at
FROM agent_runs
ORDER BY created_at DESC
LIMIT 10;
```

#### Skills Not Found
```sql
# Check active skills
SELECT name, is_active, deprecated_at
FROM agent_skills
WHERE is_active = true;
```

#### Evaluation Failures
```sql
# Check eval results
SELECT eval_case_id, verdict, error_message
FROM eval_results
WHERE verdict = 'error'
ORDER BY created_at DESC
LIMIT 10;
```

### Recovery Procedures

#### Clear Stuck Agent Runs
```sql
UPDATE agent_runs
SET status = 'failed', error_message = 'Manually marked as failed'
WHERE status = 'running'
  AND created_at < NOW() - INTERVAL '1 hour';
```

#### Reset Evaluation State
```sql
-- Clear evaluation results for re-run
DELETE FROM eval_results
WHERE created_at > NOW() - INTERVAL '1 hour';
```

## Security Considerations

### Access Control
- Service role required for evaluation functions
- RLS policies protect user data isolation
- Strong authentication required for sensitive tools

### Data Protection
- PII redaction in all responses
- Encrypted sensitive data storage
- Audit logging for all operations

### Compliance
- GDPR compliance with data minimization
- SOC2 audit trails
- Zero-trust security model

## Automation & Scheduling

### Nightly Evaluations
- **Trigger**: GitHub Actions workflow at 2 AM UTC
- **Scope**: All active evaluation cases
- **Reporting**: Artifact generation with detailed results

### Health Checks
- **Frequency**: Continuous via GitHub Actions
- **Coverage**: Function availability, database connectivity
- **Alerts**: Automated notifications on failures

## Scaling Guidelines

### Database Scaling
- Monitor connection pool usage
- Consider read replicas for analytics
- Optimize vector index parameters based on workload

### Function Scaling
- Monitor cold start times
- Consider function optimization for frequently used skills
- Implement caching for repeated queries

### Monitoring Scaling
- Increase telemetry retention based on usage
- Implement data archiving for old records
- Consider separate analytics database for reporting

---

**End of OPS RUNBOOK**

For additional support, refer to system architecture documentation or contact the platform team.